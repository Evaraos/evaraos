import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
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
  const username = normalizeUsername(user.username || "");
  const handle = username ? `@${username}` : "";
  const displayUsername = username
    ? username.charAt(0).toUpperCase() + username.slice(1)
    : "";

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
    handle,
    displayUsername,
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
      callback(null);
      return;
    }

    try {
      const userRef = doc(db, "users", firebaseUser.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        callback({
          id: firebaseUser.uid,
          uid: firebaseUser.uid,
          email: firebaseUser.email || "",
          approvalStatus: "pending",
          role: "customer"
        });
        return;
      }

      const userData = userSnap.data();

      callback({
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        email: firebaseUser.email || userData.email || "",
        ...userData
      });
    } catch (error) {
      console.error("listenAuth failed:", error);
      callback(null);
    }
  });
}

export async function logout() {
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