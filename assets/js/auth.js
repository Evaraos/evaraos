import {
  auth,
  db,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  collection,
  query,
  where,
  serverTimestamp
} from "./firebase.js";

function normalizeUsername(value = "") {
  return String(value).trim().replace(/^@+/, "").toLowerCase();
}

function looksLikeEmail(value = "") {
  const raw = String(value).trim();
  return raw.includes("@") && raw.includes(".");
}

export function buildUserIdentity(username = "") {
  const clean = normalizeUsername(username);
  return {
    username: clean,
    displayUsername: clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : "",
    handle: clean ? `@${clean}` : ""
  };
}

function setText(id, message = "", isError = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "#ff9b8f" : "rgba(245,247,251,.72)";
}

function formatLoginError(error) {
  const code = error?.code || "";
  const message = error?.message || "";

  if (
    code.includes("requests-from-referer-are-blocked") ||
    message.includes("requests-from-referer")
  ) {
    return "This domain is being blocked by Firebase or Google Cloud restrictions.";
  }

  if (code.includes("permission-denied")) {
    return "Username lookup is blocked by Firestore rules. Try logging in with your email.";
  }

  if (
    code.includes("invalid-credential") ||
    code.includes("wrong-password") ||
    code.includes("user-not-found") ||
    code.includes("invalid-login-credentials")
  ) {
    return "Invalid email, username, or password.";
  }

  if (code.includes("too-many-requests")) {
    return "Too many login attempts. Please wait a bit and try again.";
  }

  return error?.message || "Login failed. Please try again.";
}

async function resolveEmailFromLoginIdentifier(identifier) {
  const raw = String(identifier || "").trim();
  if (!raw) throw new Error("Missing login identifier.");

  if (looksLikeEmail(raw)) {
    return raw.toLowerCase();
  }

  const normalized = normalizeUsername(raw);
  const usernameSnap = await getDoc(doc(db, "usernames", normalized));

  if (!usernameSnap.exists()) {
    throw new Error("No account found for that username.");
  }

  const data = usernameSnap.data();

  if (!data?.email) {
    throw new Error("Username record is missing an email.");
  }

  return String(data.email).toLowerCase();
}

export async function syncUsernameDirectoryByUserDoc(userId) {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    throw new Error("User document not found.");
  }

  const user = userSnap.data();
  const identity = buildUserIdentity(user.username || "");

  const existingEntriesQuery = query(collection(db, "usernames"), where("uid", "==", userId));
  const existingEntriesSnap = await getDocs(existingEntriesQuery);

  for (const entry of existingEntriesSnap.docs) {
    if (entry.id !== identity.username) {
      await deleteDoc(doc(db, "usernames", entry.id));
    }
  }

  if (!identity.username) return null;

  const payload = {
    uid: userId,
    username: identity.username,
    displayUsername: identity.displayUsername,
    handle: identity.handle,
    email: user.email || "",
    companyId: user.companyId || "",
    role: user.role || "",
    updatedAt: serverTimestamp()
  };

  const usernameRef = doc(db, "usernames", identity.username);
  const usernameSnap = await getDoc(usernameRef);

  if (!usernameSnap.exists()) {
    payload.createdAt = serverTimestamp();
  }

  await setDoc(usernameRef, payload, { merge: true });
  return payload;
}

export async function loginWithIdentifier(identifier, password) {
  const email = await resolveEmailFromLoginIdentifier(identifier);
  const credential = await signInWithEmailAndPassword(auth, email, password);

  const userRef = doc(db, "users", credential.user.uid);

  try {
    await updateDoc(userRef, {
      lastLogin: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.warn("Could not update lastLogin:", error);
  }

  try {
    await syncUsernameDirectoryByUserDoc(credential.user.uid);
  } catch (error) {
    console.warn("Could not sync username directory:", error);
  }

  return credential;
}

export async function sendReset(email) {
  return sendPasswordResetEmail(auth, email);
}

export async function updateOwnUsername(userId, newUsername) {
  const identity = buildUserIdentity(newUsername);

  if (!identity.username) {
    throw new Error("Username is required.");
  }

  const takenSnap = await getDoc(doc(db, "usernames", identity.username));
  if (takenSnap.exists() && takenSnap.data()?.uid !== userId) {
    throw new Error("That username is already taken.");
  }

  await updateDoc(doc(db, "users", userId), {
    username: identity.username,
    displayUsername: identity.displayUsername,
    handle: identity.handle,
    updatedAt: serverTimestamp()
  });

  await syncUsernameDirectoryByUserDoc(userId);
  return identity;
}

export async function updateOwnCustomerProfile(userId, payload) {
  const username = normalizeUsername(payload.username || "");

  await updateDoc(doc(db, "users", userId), {
    ...payload,
    username,
    displayUsername: username ? username.charAt(0).toUpperCase() + username.slice(1) : "",
    handle: username ? `@${username}` : "",
    updatedAt: serverTimestamp()
  });

  await syncUsernameDirectoryByUserDoc(userId);
}

export async function changeOwnPassword(currentPassword, newPassword) {
  if (!currentPassword || !newPassword) {
    throw new Error("Current and new password are required.");
  }

  throw new Error("Password change flow still needs re-auth wiring. We’ll wire that next.");
}

export async function fetchCustomerServices(user) {
  return [
    {
      name: "Supreme TrueClean Exterior Service",
      status: "active",
      billingType: "Monthly Subscription",
      cancellationPolicy: "Early cancellation may involve contract review.",
      canRequestChanges: true
    },
    {
      name: "Additional Service Slot",
      status: "inactive",
      billingType: "Not Active",
      cancellationPolicy: "Can be requested through account review.",
      canRequestChanges: true
    }
  ];
}

function setupPasswordToggle() {
  const passwordInput = document.getElementById("password");
  const toggleBtn = document.getElementById("togglePasswordBtn");
  const openIcon = document.getElementById("passwordIconOpen");
  const closedIcon = document.getElementById("passwordIconClosed");

  if (!passwordInput || !toggleBtn || !openIcon || !closedIcon) return;

  toggleBtn.addEventListener("click", () => {
    const shouldShow = passwordInput.type === "password";
    passwordInput.type = shouldShow ? "text" : "password";
    toggleBtn.setAttribute("aria-pressed", String(shouldShow));
    toggleBtn.setAttribute("aria-label", shouldShow ? "Hide password" : "Show password");
    openIcon.style.display = shouldShow ? "none" : "block";
    closedIcon.style.display = shouldShow ? "block" : "none";
  });
}

function setupResetPanel() {
  const openResetBtn = document.getElementById("openResetBtn");
  const closeResetBtn = document.getElementById("closeResetBtn");
  const resetPanel = document.getElementById("resetPanel");

  if (!resetPanel) return;

  openResetBtn?.addEventListener("click", () => {
    resetPanel.classList.remove("hidden");
  });

  closeResetBtn?.addEventListener("click", () => {
    resetPanel.classList.add("hidden");
  });
}

function setupLoginForm() {
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return;

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const identifier = document.getElementById("username")?.value?.trim() || "";
    const password = document.getElementById("password")?.value || "";
    const submitBtn = loginForm.querySelector('button[type="submit"]');

    setText("loginMessage", "");

    if (!identifier || !password) {
      setText("loginMessage", "Enter your email or username and password.", true);
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Signing In...";
      }

      const credential = await loginWithIdentifier(identifier, password);

      const userSnap = await getDoc(doc(db, "users", credential.user.uid));
      const userData = userSnap.exists() ? userSnap.data() : { role: "customer" };
      const role = userData?.role || "customer";

      window.location.href =
        role === "customer"
          ? "/evaraos/customer_dashboard.html"
          : "/evaraos/dashboard.html";
    } catch (error) {
      console.error("Login failed:", error);
      setText("loginMessage", formatLoginError(error), true);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Login";
      }
    }
  });
}

function setupResetForm() {
  const resetForm = document.getElementById("resetForm");
  if (!resetForm) return;

  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("resetEmail")?.value?.trim() || "";
    const submitBtn = resetForm.querySelector('button[type="submit"]');

    setText("resetMessage", "");

    if (!email) {
      setText("resetMessage", "Enter your account email.", true);
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending...";
      }

      await sendReset(email);
      setText("resetMessage", "Reset email sent. Check your inbox.");
    } catch (error) {
      console.error("Reset email failed:", error);
      setText("resetMessage", "Could not send reset email. Check the address and try again.", true);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Reset Email";
      }
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  setupPasswordToggle();
  setupResetPanel();
  setupLoginForm();
  setupResetForm();
});