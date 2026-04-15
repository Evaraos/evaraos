import {
  auth,
  db,
  applyUserToUi
} from "./firebase.js";

import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  getDoc,
  query,
  collection,
  where,
  getDocs,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const resetForm = document.getElementById("resetForm");

function setMessage(id, message, isError = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "#ff9f93" : "#94f3c4";
}

function normalizeUsername(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, "");
}

function pulse(el) {
  if (!el) return;
  el.classList.remove("active-glow");
  void el.offsetWidth;
  el.classList.add("active-glow");
  setTimeout(() => el.classList.remove("active-glow"), 220);
}

function bindPasswordToggle(toggleId, inputId) {
  const toggle = document.getElementById(toggleId);
  const input = document.getElementById(inputId);

  if (!toggle || !input || toggle.dataset.bound === "true") return;
  toggle.dataset.bound = "true";

  toggle.addEventListener("click", () => {
    const makeVisible = input.type === "password";
    input.type = makeVisible ? "text" : "password";
    toggle.classList.toggle("is-visible", makeVisible);
    toggle.setAttribute("aria-label", makeVisible ? "Hide password" : "Show password");
    pulse(toggle);
  });
}

function bindAllPasswordToggles() {
  bindPasswordToggle("loginPasswordToggle", "loginPassword");
  bindPasswordToggle("signupPasswordToggle", "signupPassword");
  bindPasswordToggle("signupPasswordConfirmToggle", "signupPasswordConfirm");
}

async function getEmailFromIdentifier(identifier) {
  const raw = String(identifier || "").trim();
  if (!raw) return null;

  if (raw.includes("@")) {
    return raw.toLowerCase();
  }

  const username = normalizeUsername(raw);
  if (!username) return null;

  const directRef = doc(db, "usernames", username);
  const directSnap = await getDoc(directRef);

  if (directSnap.exists()) {
    const data = directSnap.data() || {};
    if (data.email) return String(data.email).toLowerCase();
    if (data.uid) {
      const userRef = doc(db, "users", data.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data() || {};
        if (userData.email) return String(userData.email).toLowerCase();
      }
    }
  }

  const q = query(collection(db, "users"), where("username", "==", username));
  const querySnap = await getDocs(q);

  if (!querySnap.empty) {
    const userData = querySnap.docs[0].data() || {};
    if (userData.email) return String(userData.email).toLowerCase();
  }

  return null;
}

async function setSessionPersistence(remember) {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
}

async function handleLogin(event) {
  event.preventDefault();

  const identifier = document.getElementById("loginEmail")?.value.trim() || "";
  const password = document.getElementById("loginPassword")?.value || "";
  const remember = Boolean(document.getElementById("rememberDevice")?.checked);

  if (!identifier) {
    setMessage("loginMessage", "Enter your email or username.", true);
    return;
  }

  if (!password) {
    setMessage("loginMessage", "Enter your password.", true);
    return;
  }

  try {
    setMessage("loginMessage", "Signing in...");
    await setSessionPersistence(remember);

    const email = await getEmailFromIdentifier(identifier);
    if (!email) {
      setMessage("loginMessage", "We could not find that email or username.", true);
      return;
    }

    const result = await signInWithEmailAndPassword(auth, email, password);
    const user = result.user;

    applyUserToUi({
      displayName: user.displayName || email.split("@")[0],
      email: user.email || email,
      role: "owner"
    });

    setMessage("loginMessage", "Login successful.");
    window.location.href = "/evaraos/dashboard.html";
  } catch (error) {
    console.error("Login failed:", error);
    const code = error?.code || "";

    if (code.includes("invalid-credential") || code.includes("wrong-password")) {
      setMessage("loginMessage", "Incorrect password or account details.", true);
      return;
    }

    if (code.includes("too-many-requests")) {
      setMessage("loginMessage", "Too many login attempts. Try again later.", true);
      return;
    }

    if (code.includes("api-key-not-valid")) {
      setMessage("loginMessage", "Firebase API key is invalid in the current config.", true);
      return;
    }

    setMessage("loginMessage", error.message || "Unable to login right now.", true);
  }
}

async function handleSignup(event) {
  event.preventDefault();

  const fullName = document.getElementById("signupName")?.value.trim() || "";
  const usernameRaw = document.getElementById("signupUsername")?.value.trim() || "";
  const username = normalizeUsername(usernameRaw);
  const email = document.getElementById("signupEmail")?.value.trim().toLowerCase() || "";
  const password = document.getElementById("signupPassword")?.value || "";
  const confirmPassword = document.getElementById("signupPasswordConfirm")?.value || "";
  const remember = Boolean(document.getElementById("signupRememberDevice")?.checked);

  if (!fullName) {
    setMessage("signupMessage", "Enter your full name.", true);
    return;
  }

  if (!username || username.length < 2) {
    setMessage("signupMessage", "Choose a valid username.", true);
    return;
  }

  if (!email) {
    setMessage("signupMessage", "Enter your email.", true);
    return;
  }

  if (password.length < 6) {
    setMessage("signupMessage", "Password must be at least 6 characters.", true);
    return;
  }

  if (password !== confirmPassword) {
    setMessage("signupMessage", "Passwords do not match.", true);
    return;
  }

  try {
    setMessage("signupMessage", "Creating account...");

    const usernameRef = doc(db, "usernames", username);
    const existingUsername = await getDoc(usernameRef);

    if (existingUsername.exists()) {
      setMessage("signupMessage", "That username is already taken.", true);
      return;
    }

    await setSessionPersistence(remember);

    const result = await createUserWithEmailAndPassword(auth, email, password);
    const user = result.user;

    await updateProfile(user, {
      displayName: fullName
    });

    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email,
      fullName,
      displayName: fullName,
      username,
      role: "owner",
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    await setDoc(usernameRef, {
      uid: user.uid,
      email,
      username,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    applyUserToUi({
      displayName: fullName,
      email,
      role: "owner"
    });

    setMessage("signupMessage", "Account created successfully.");
    window.location.href = "/evaraos/dashboard.html";
  } catch (error) {
    console.error("Signup failed:", error);
    const code = error?.code || "";

    if (code.includes("email-already-in-use")) {
      setMessage("signupMessage", "That email is already in use.", true);
      return;
    }

    if (code.includes("weak-password")) {
      setMessage("signupMessage", "Use a stronger password.", true);
      return;
    }

    if (code.includes("permission-denied")) {
      setMessage("signupMessage", "Firestore rules are blocking account setup.", true);
      return;
    }

    if (code.includes("api-key-not-valid")) {
      setMessage("signupMessage", "Firebase API key is invalid in the current config.", true);
      return;
    }

    setMessage("signupMessage", error.message || "Unable to create account right now.", true);
  }
}

async function handleReset(event) {
  event.preventDefault();

  const email = document.getElementById("resetEmail")?.value.trim().toLowerCase() || "";
  if (!email) {
    setMessage("resetMessage", "Enter your account email.", true);
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    setMessage("resetMessage", "Password reset email sent.");
  } catch (error) {
    console.error("Reset failed:", error);
    const code = error?.code || "";

    if (code.includes("user-not-found")) {
      setMessage("resetMessage", "No account found for that email.", true);
      return;
    }

    if (code.includes("api-key-not-valid")) {
      setMessage("resetMessage", "Firebase API key is invalid in the current config.", true);
      return;
    }

    setMessage("resetMessage", error.message || "Unable to send reset email.", true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  bindAllPasswordToggles();

  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  if (signupForm) {
    signupForm.addEventListener("submit", handleSignup);
  }

  if (resetForm) {
    resetForm.addEventListener("submit", handleReset);
  }
});