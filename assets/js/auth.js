import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
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
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

function normalizeUsername(value = "") {
  return String(value).trim().replace(/^@+/, "").toLowerCase();
}

export function buildUserIdentity(username = "") {
  const clean = normalizeUsername(username);
  return {
    username: clean,
    handle: clean ? `@${clean}` : "",
    displayUsername: clean
      ? clean.charAt(0).toUpperCase() + clean.slice(1)
      : ""
  };
}

function formatLoginError(error) {
  const code = error?.code || "";
  const message = error?.message || "";

  if (
    code.includes("requests-from-referer-are-blocked") ||
    message.includes("requests-from-referer")
  ) {
    return "This domain is still being blocked by Firebase or Google Cloud restrictions.";
  }

  if (
    code.includes("invalid-credential") ||
    code.includes("wrong-password") ||
    code.includes("user-not-found")
  ) {
    return "Invalid email, username, handle, or password.";
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

async function resolveEmailFromLoginIdentifier(identifier) {
  const raw = String(identifier || "").trim();
  if (!raw) throw new Error("Missing login identifier.");

  const normalized = normalizeUsername(raw);

  if (raw.includes("@") && raw.includes(".")) {
    return raw.toLowerCase();
  }

  const usernameDoc = await getDoc(doc(db, "usernames", normalized));
  if (usernameDoc.exists()) {
    const data = usernameDoc.data();

    if (data?.email) {
      return String(data.email).toLowerCase();
    }

    if (data?.uid) {
      const userSnap = await getDoc(doc(db, "users", data.uid));
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData?.email) {
          return String(userData.email).toLowerCase();
        }
      }
    }
  }

  const userQuery = query(collection(db, "users"), where("username", "==", normalized));
  const userSnap = await getDocs(userQuery);

  if (!userSnap.empty) {
    const userData = userSnap.docs[0].data();
    if (userData?.email) {
      return String(userData.email).toLowerCase();
    }
  }

  throw new Error("No account found for that username or handle.");
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
    handle: identity.handle,
    displayUsername: identity.displayUsername,
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

export async function getCurrentUserDoc(firebaseUser = auth.currentUser) {
  if (!firebaseUser) return null;

  const snap = await getDoc(doc(db, "users", firebaseUser.uid));
  if (!snap.exists()) {
    return {
      id: firebaseUser.uid,
      uid: firebaseUser.uid,
      email: firebaseUser.email || "",
      role: "customer",
      approvalStatus: "pending"
    };
  }

  return {
    id: firebaseUser.uid,
    uid: firebaseUser.uid,
    email: firebaseUser.email || snap.data().email || "",
    ...snap.data()
  };
}

export function listenAuth(callback) {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      callback(null);
      return;
    }

    try {
      const userData = await getCurrentUserDoc(firebaseUser);
      callback(userData);
    } catch (error) {
      console.error("listenAuth failed:", error);
      callback(null);
    }
  });
}

export async function logout() {
  await signOut(auth);
}

export async function updateOwnUsername(userId, nextUsername) {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser || !userId) {
    throw new Error("You must be logged in to update username.");
  }

  const identity = buildUserIdentity(nextUsername);
  if (!identity.username) {
    throw new Error("Username cannot be empty.");
  }

  const existing = await getDoc(doc(db, "usernames", identity.username));
  if (existing.exists()) {
    const existingData = existing.data();
    if (existingData?.uid && existingData.uid !== userId) {
      throw new Error("That username is already taken.");
    }
  }

  await updateDoc(doc(db, "users", userId), {
    username: identity.username,
    handle: identity.handle,
    displayUsername: identity.displayUsername,
    updatedAt: serverTimestamp()
  });

  await syncUsernameDirectoryByUserDoc(userId);
  return identity;
}

export async function changeOwnPassword(currentPassword, newPassword) {
  const firebaseUser = auth.currentUser;

  if (!firebaseUser || !firebaseUser.email) {
    throw new Error("You must be logged in to change password.");
  }

  if (!currentPassword || !newPassword) {
    throw new Error("Enter current password and new password.");
  }

  if (newPassword.length < 6) {
    throw new Error("New password must be at least 6 characters.");
  }

  const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
  await reauthenticateWithCredential(firebaseUser, credential);
  await updatePassword(firebaseUser, newPassword);

  try {
    await updateDoc(doc(db, "users", firebaseUser.uid), {
      updatedAt: serverTimestamp()
    });
  } catch (e) {
    console.warn("Password change updated auth but not Firestore timestamp:", e);
  }

  return true;
}

export async function updateOwnCustomerProfile(userId, payload = {}) {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser || !userId || firebaseUser.uid !== userId) {
    throw new Error("Unauthorized profile update.");
  }

  const currentSnap = await getDoc(doc(db, "users", userId));
  if (!currentSnap.exists()) {
    throw new Error("User profile not found.");
  }

  const current = currentSnap.data();
  const nextUsername = normalizeUsername(payload.username || current.username || "");
  const identity = buildUserIdentity(nextUsername);

  if (identity.username) {
    const existing = await getDoc(doc(db, "usernames", identity.username));
    if (existing.exists()) {
      const data = existing.data();
      if (data?.uid && data.uid !== userId) {
        throw new Error("That username is already taken.");
      }
    }
  }

  const updatePayload = {
    name: String(payload.name ?? current.name ?? "").trim(),
    username: identity.username,
    handle: identity.handle,
    displayUsername: identity.displayUsername,
    email: String(payload.email ?? current.email ?? "").trim(),
    phone: String(payload.phone ?? current.phone ?? "").trim(),
    preferredContactMethod: String(
      payload.preferredContactMethod ?? current.preferredContactMethod ?? ""
    ).trim(),
    address: String(payload.address ?? current.address ?? "").trim(),
    city: String(payload.city ?? current.city ?? "").trim(),
    state: String(payload.state ?? current.state ?? "").trim(),
    zip: String(payload.zip ?? current.zip ?? "").trim(),
    photoUrl: String(payload.photoUrl ?? current.photoUrl ?? "").trim(),
    updatedAt: serverTimestamp()
  };

  await updateDoc(doc(db, "users", userId), updatePayload);

  if (identity.username) {
    await syncUsernameDirectoryByUserDoc(userId);
  }

  return {
    ...current,
    ...updatePayload,
    updatedAt: new Date().toISOString()
  };
}

export async function fetchCustomerServices(user) {
  if (!user?.companyId) return [];

  try {
    const qRef = query(
      collection(db, "services"),
      where("companyId", "==", String(user.companyId).trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_"))
    );

    const snap = await getDocs(qRef);

    if (!snap.empty) {
      return snap.docs.map((docSnap) => {
        const item = docSnap.data();
        return {
          id: docSnap.id,
          name: item.name || "Service",
          status: item.active === false ? "inactive" : "active",
          billingType: item.pricingType || item.unit || "Custom",
          cancellationPolicy: item.description || "Contact support for service change details.",
          canRequestChanges: true
        };
      });
    }
  } catch (e) {
    console.warn("Could not load services collection, falling back:", e);
  }

  return [
    {
      id: "default_service",
      name: "Active Customer Service",
      status: "active",
      billingType: "Custom Plan",
      cancellationPolicy: "Contact support for service change details.",
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
      setText("loginMessage", "Enter your email, username, or handle, and password.", true);
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Signing In...";
      }

      const email = await resolveEmailFromLoginIdentifier(identifier);
      const credential = await signInWithEmailAndPassword(auth, email, password);

      try {
        await updateDoc(doc(db, "users", credential.user.uid), {
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

      const userSnap = await getDoc(doc(db, "users", credential.user.uid));
      const userData = userSnap.exists() ? userSnap.data() : {};
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