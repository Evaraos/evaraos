import {
  auth,
  db,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "./firebase.js";

function normalizeUsername(value = "") {
  return String(value).trim().replace(/^@+/, "").toLowerCase();
}

function looksLikeEmail(value = "") {
  const raw = String(value).trim();
  return raw.includes("@") && raw.includes(".");
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

  if (code.includes("network-request-failed")) {
    return "Network error. Check your internet connection and try again.";
  }

  return error?.message || "Login failed. Please try again.";
}

function setText(id, message = "", isError = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "#ff9b8f" : "rgba(245,247,251,.72)";
}

function showElement(el) {
  if (!el) return;
  el.classList.remove("hidden");
  el.style.display = "";
}

function hideElement(el) {
  if (!el) return;
  el.classList.add("hidden");
}

function setLegacySession(userData, firebaseUser) {
  const sessionUser = {
    uid: firebaseUser?.uid || "",
    email: firebaseUser?.email || userData?.email || "",
    name:
      userData?.name ||
      userData?.fullName ||
      userData?.username ||
      firebaseUser?.email ||
      "User",
    role: userData?.role || "customer",
    companyId: userData?.companyId || ""
  };

  localStorage.setItem("evaraos_user", JSON.stringify(sessionUser));
  localStorage.setItem("evaraos_role", sessionUser.role);

  return sessionUser;
}

function clearLegacySession() {
  localStorage.removeItem("evaraos_user");
  localStorage.removeItem("evaraos_role");
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
  const username = normalizeUsername(user.username || "");

  const existingEntriesQuery = query(collection(db, "usernames"), where("uid", "==", userId));
  const existingEntriesSnap = await getDocs(existingEntriesQuery);

  for (const entry of existingEntriesSnap.docs) {
    if (entry.id !== username) {
      await deleteDoc(doc(db, "usernames", entry.id));
    }
  }

  if (!username) return null;

  const payload = {
    uid: userId,
    username,
    email: user.email || "",
    companyId: user.companyId || "",
    role: user.role || "",
    updatedAt: serverTimestamp()
  };

  const usernameRef = doc(db, "usernames", username);
  const usernameSnap = await getDoc(usernameRef);

  if (!usernameSnap.exists()) {
    payload.createdAt = serverTimestamp();
  }

  await setDoc(usernameRef, payload, { merge: true });
  return payload;
}

export function listenAuth(callback) {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      clearLegacySession();
      callback(null);
      return;
    }

    try {
      const userRef = doc(db, "users", firebaseUser.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        const fallbackUser = {
          id: firebaseUser.uid,
          uid: firebaseUser.uid,
          email: firebaseUser.email || "",
          approvalStatus: "pending",
          role: "customer"
        };

        setLegacySession(fallbackUser, firebaseUser);
        callback(fallbackUser);
        return;
      }

      const userData = userSnap.data();

      const mergedUser = {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        email: firebaseUser.email || userData.email || "",
        ...userData
      };

      setLegacySession(mergedUser, firebaseUser);
      callback(mergedUser);
    } catch (error) {
      console.error("listenAuth failed:", error);
      callback(null);
    }
  });
}

export async function logout() {
  clearLegacySession();
  await signOut(auth);
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
    showElement(resetPanel);
  });

  closeResetBtn?.addEventListener("click", () => {
    hideElement(resetPanel);
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

      const email = await resolveEmailFromLoginIdentifier(identifier);
      const credential = await signInWithEmailAndPassword(auth, email, password);

      let userData = {
        role: "customer",
        email: credential.user.email || email
      };

      const userRef = doc(db, "users", credential.user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        userData = userSnap.data();
      }

      try {
        await updateDoc(userRef, {
          lastLogin: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.warn("Could not update lastLogin:", err);
      }

      try {
        await syncUsernameDirectoryByUserDoc(credential.user.uid);
      } catch (err) {
        console.warn("Could not sync username directory:", err);
      }

      const sessionUser = setLegacySession(userData, credential.user);
      const role = sessionUser.role || "customer";

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

    const resetEmail = document.getElementById("resetEmail")?.value?.trim() || "";
    const submitBtn = resetForm.querySelector('button[type="submit"]');

    setText("resetMessage", "");

    if (!resetEmail) {
      setText("resetMessage", "Enter your account email.", true);
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending...";
      }

      await sendPasswordResetEmail(auth, resetEmail);
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