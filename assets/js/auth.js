// assets/js/auth.js

import {
  auth,
  db,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  setAuthPersistence,
  syncUserSession,
  saveUserRole,
  protectRoute
} from "./firebase.js";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const ROUTES = {
  login: "/evaraos/login.html",
  signup: "/evaraos/signup.html",
  reset: "/evaraos/reset.html",
  dashboard: "/evaraos/dashboard.html"
};

const els = {
  loginForm: document.getElementById("loginForm"),
  signupForm: document.getElementById("signupForm"),
  resetForm: document.getElementById("resetForm"),

  loginMessage: document.getElementById("loginMessage"),
  signupMessage: document.getElementById("signupMessage"),
  resetMessage: document.getElementById("resetMessage"),

  loginEmail: document.getElementById("loginEmail"),
  loginPassword: document.getElementById("loginPassword"),
  rememberDevice: document.getElementById("rememberDevice"),

  signupName: document.getElementById("signupName"),
  signupEmail: document.getElementById("signupEmail"),
  signupPassword: document.getElementById("signupPassword"),
  signupPasswordConfirm: document.getElementById("signupPasswordConfirm"),
  signupRememberDevice: document.getElementById("signupRememberDevice"),

  resetEmail: document.getElementById("resetEmail"),

  loginPasswordToggle: document.getElementById("loginPasswordToggle"),
  signupPasswordToggle: document.getElementById("signupPasswordToggle"),
  signupPasswordConfirmToggle: document.getElementById("signupPasswordConfirmToggle")
};

function setMessage(element, text = "", isError = false) {
  if (!element) return;
  element.textContent = text;
  element.style.color = isError ? "#ff9b8f" : "";
}

function clearMessages() {
  setMessage(els.loginMessage, "");
  setMessage(els.signupMessage, "");
  setMessage(els.resetMessage, "");
}

function looksLikeEmail(value = "") {
  return /\S+@\S+\.\S+/.test(String(value).trim());
}

function passwordStrongEnough(password = "") {
  return typeof password === "string" && password.length >= 8;
}

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function inferRoleFromEmail(email = "") {
  const value = normalizeEmail(email);
  if (value.includes("admin")) return "admin";
  if (value.includes("manager")) return "manager";
  if (value.includes("sales")) return "sales";
  if (value.includes("tech")) return "technician";
  if (value.includes("customer")) return "customer";
  return "owner";
}

function getFriendlyAuthError(error) {
  const code = error?.code || "";

  switch (code) {
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-login-credentials":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again in a little bit.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/email-already-in-use":
      return "That email is already in use.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Password is too weak. Use at least 8 characters.";
    case "auth/missing-password":
      return "Please enter your password.";
    default:
      return "Something went wrong. Please try again.";
  }
}

function updatePasswordToggleVisual(button, isVisible, showLabel = "Show password", hideLabel = "Hide password") {
  if (!button) return;

  button.classList.toggle("is-visible", isVisible);
  button.setAttribute("aria-label", isVisible ? hideLabel : showLabel);

  const eyeOpen = button.querySelector(".eye-open");
  const eyeClosed = button.querySelector(".eye-closed");

  if (eyeOpen) eyeOpen.style.opacity = isVisible ? "0" : "1";
  if (eyeClosed) eyeClosed.style.opacity = isVisible ? "1" : "0";
}

function togglePasswordVisibility(input, button, showLabel = "Show password", hideLabel = "Hide password") {
  if (!input || !button) return;

  const reveal = input.type === "password";
  input.type = reveal ? "text" : "password";

  updatePasswordToggleVisual(button, reveal, showLabel, hideLabel);

  button.classList.add("active-glow");
  setTimeout(() => button.classList.remove("active-glow"), 220);
}

function wirePasswordToggles() {
  if (els.loginPassword && els.loginPasswordToggle) {
    updatePasswordToggleVisual(els.loginPasswordToggle, false);
    els.loginPasswordToggle.addEventListener("click", () => {
      togglePasswordVisibility(els.loginPassword, els.loginPasswordToggle);
    });
  }

  if (els.signupPassword && els.signupPasswordToggle) {
    updatePasswordToggleVisual(els.signupPasswordToggle, false);
    els.signupPasswordToggle.addEventListener("click", () => {
      togglePasswordVisibility(els.signupPassword, els.signupPasswordToggle);
    });
  }

  if (els.signupPasswordConfirm && els.signupPasswordConfirmToggle) {
    updatePasswordToggleVisual(
      els.signupPasswordConfirmToggle,
      false,
      "Show password confirmation",
      "Hide password confirmation"
    );

    els.signupPasswordConfirmToggle.addEventListener("click", () => {
      togglePasswordVisibility(
        els.signupPasswordConfirm,
        els.signupPasswordConfirmToggle,
        "Show password confirmation",
        "Hide password confirmation"
      );
    });
  }
}

async function safelyUpdateLastLogin(uid) {
  if (!uid) return;

  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
      lastLogin: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.warn("Could not update lastLogin:", error);
  }
}

async function createUserDocument({ uid, fullName, email, role = "owner" }) {
  const userRef = doc(db, "users", uid);

  await setDoc(
    userRef,
    {
      uid,
      fullName: fullName.trim(),
      displayName: fullName.trim(),
      email: normalizeEmail(email),
      role,
      active: true,
      approvalStatus: "approved",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    },
    { merge: true }
  );
}

async function getUserRoleFromFirestore(uid, email = "") {
  if (!uid) return inferRoleFromEmail(email);

  try {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) return inferRoleFromEmail(email);

    const data = snap.data() || {};
    return data.role || inferRoleFromEmail(email);
  } catch (error) {
    console.warn("Could not read user role:", error);
    return inferRoleFromEmail(email);
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  clearMessages();

  const email = normalizeEmail(els.loginEmail?.value || "");
  const password = els.loginPassword?.value || "";
  const rememberDevice = Boolean(els.rememberDevice?.checked);

  if (!email || !password) {
    setMessage(els.loginMessage, "Please enter your email and password.", true);
    return;
  }

  if (!looksLikeEmail(email)) {
    setMessage(els.loginMessage, "Please enter a valid email address.", true);
    return;
  }

  try {
    await setAuthPersistence(rememberDevice);

    const credential = await signInWithEmailAndPassword(auth, email, password);
    const user = credential.user;
    const role = await getUserRoleFromFirestore(user.uid, user.email || email);

    saveUserRole(role);
    syncUserSession(user, role);
    await safelyUpdateLastLogin(user.uid);

    window.location.href = ROUTES.dashboard;
  } catch (error) {
    console.error("Login failed:", error);
    setMessage(els.loginMessage, getFriendlyAuthError(error), true);
  }
}

async function handleSignupSubmit(event) {
  event.preventDefault();
  clearMessages();

  const fullName = String(els.signupName?.value || "").trim();
  const email = normalizeEmail(els.signupEmail?.value || "");
  const password = els.signupPassword?.value || "";
  const confirmPassword = els.signupPasswordConfirm?.value || "";
  const rememberDevice = Boolean(els.signupRememberDevice?.checked);

  if (!fullName || !email || !password || !confirmPassword) {
    setMessage(els.signupMessage, "Please complete every field.", true);
    return;
  }

  if (!looksLikeEmail(email)) {
    setMessage(els.signupMessage, "Please enter a valid email address.", true);
    return;
  }

  if (!passwordStrongEnough(password)) {
    setMessage(els.signupMessage, "Use at least 8 characters for your password.", true);
    return;
  }

  if (password !== confirmPassword) {
    setMessage(els.signupMessage, "Passwords do not match.", true);
    return;
  }

  try {
    await setAuthPersistence(rememberDevice);

    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const user = credential.user;
    const role = inferRoleFromEmail(email);

    await updateProfile(user, {
      displayName: fullName
    });

    await createUserDocument({
      uid: user.uid,
      fullName,
      email,
      role
    });

    saveUserRole(role);
    syncUserSession(
      {
        ...user,
        displayName: fullName
      },
      role
    );

    window.location.href = ROUTES.dashboard;
  } catch (error) {
    console.error("Signup failed:", error);
    setMessage(els.signupMessage, getFriendlyAuthError(error), true);
  }
}

async function handleResetSubmit(event) {
  event.preventDefault();
  clearMessages();

  const email = normalizeEmail(els.resetEmail?.value || "");

  if (!looksLikeEmail(email)) {
    setMessage(els.resetMessage, "Please enter a valid email address.", true);
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    setMessage(els.resetMessage, "Reset email sent. Check your inbox.");
  } catch (error) {
    console.error("Password reset failed:", error);
    setMessage(els.resetMessage, getFriendlyAuthError(error), true);
  }
}

function guardCurrentPage() {
  const path = window.location.pathname;

  if (
    path.endsWith("/login.html") ||
    path.endsWith("/signup.html") ||
    path.endsWith("/reset.html")
  ) {
    protectRoute({
      requireAuth: false,
      redirectAuthedTo: ROUTES.dashboard
    });
    return;
  }

  if (
    path.endsWith("/dashboard.html") ||
    path.endsWith("/profile.html") ||
    path.endsWith("/settings.html") ||
    path.endsWith("/security.html") ||
    path.endsWith("/companies.html") ||
    path.endsWith("/users.html") ||
    path.endsWith("/leads.html") ||
    path.endsWith("/jobs.html") ||
    path.endsWith("/qa.html")
  ) {
    protectRoute({
      requireAuth: true,
      redirectGuestTo: ROUTES.login
    });
  }
}

function init() {
  wirePasswordToggles();
  guardCurrentPage();

  if (els.loginForm) {
    els.loginForm.addEventListener("submit", handleLoginSubmit);
  }

  if (els.signupForm) {
    els.signupForm.addEventListener("submit", handleSignupSubmit);
  }

  if (els.resetForm) {
    els.resetForm.addEventListener("submit", handleResetSubmit);
  }
}

window.addEventListener("DOMContentLoaded", init);