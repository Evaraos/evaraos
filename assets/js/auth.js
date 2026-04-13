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
  serverTimestamp,
  collection,
  getDocs,
  query,
  where,
  limit
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
  signupUsername: document.getElementById("signupUsername"),
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
  return String(value || "").trim().toLowerCase();
}

function normalizeUsername(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, "");
}

function normalizeHandle(value = "") {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  return raw.startsWith("@") ? raw : `@${raw}`;
}

function inferRoleFromEmail(email = "") {
  const value = normalizeEmail(email);
  if (value.includes("admin")) return "admin";
  if (value.includes("manager")) return "manager";
  if (value.includes("sales")) return "sales";
  if (value.includes("tech")) return "technician";
  if (value.includes("customer")) return "customer";
  return "customer";
}

function getFriendlyAuthError(error, context = "login") {
  const code = error?.code || "";
  const detail = String(error?.message || "").toLowerCase();

  if (context === "username_lookup") {
    return "That username was not found. Try your email instead or check your spelling.";
  }

  if (context === "username_taken") {
    return "That username is already taken. Please choose another one.";
  }

  switch (code) {
    case "auth/user-not-found":
      return "No account was found for that email. Try signing up first.";
    case "auth/wrong-password":
    case "auth/invalid-login-credentials":
    case "auth/invalid-credential":
      return "Incorrect login details. Check your email or username and password, then try again.";
    case "auth/too-many-requests":
      return "Too many login attempts. Wait a bit, then try again or reset your password.";
    case "auth/network-request-failed":
      return "Network error. Check your internet connection and try again.";
    case "auth/email-already-in-use":
      return "That email is already in use. Log in instead or use password reset.";
    case "auth/invalid-email":
      return "That email format looks invalid. Please enter a valid email address.";
    case "auth/weak-password":
      return "Password is too weak. Use at least 8 characters.";
    case "auth/missing-password":
      return "Please enter your password.";
    case "auth/operation-not-allowed":
      return "Email/password sign-in is not enabled in Firebase Authentication settings.";
    default:
      if (detail.includes("permission")) {
        return "A Firestore permission issue occurred. Check your Firebase rules.";
      }
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

async function usernameExists(username) {
  const normalized = normalizeUsername(username);
  if (!normalized) return false;

  try {
    const usernameRef = doc(db, "usernames", normalized);
    const snap = await getDoc(usernameRef);
    if (snap.exists()) return true;
  } catch (error) {
    console.warn("Primary usernameExists lookup failed:", error);
  }

  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", normalized), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) return true;
  } catch (error) {
    console.warn("Fallback usernameExists query failed:", error);
  }

  return false;
}

async function lookupEmailByUsername(usernameInput) {
  const normalized = normalizeUsername(usernameInput);
  const handle = normalizeHandle(usernameInput);

  if (!normalized) return null;

  // 1) Preferred: usernames/{username}
  try {
    const usernameRef = doc(db, "usernames", normalized);
    const snap = await getDoc(usernameRef);

    if (snap.exists()) {
      const data = snap.data() || {};
      if (data.email) return normalizeEmail(data.email);
    }
  } catch (error) {
    console.warn("Primary usernames lookup failed:", error);
  }

  // 2) Fallback: users.username
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", normalized), limit(1));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const data = snap.docs[0].data() || {};
      if (data.email) return normalizeEmail(data.email);
    }
  } catch (error) {
    console.warn("Fallback users.username lookup failed:", error);
  }

  // 3) Fallback: users.handle
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("handle", "==", handle), limit(1));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const data = snap.docs[0].data() || {};
      if (data.email) return normalizeEmail(data.email);
    }
  } catch (error) {
    console.warn("Fallback users.handle lookup failed:", error);
  }

  // 4) Fallback: users.displayUsername exact raw or upper/lower variations
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("displayUsername", "==", usernameInput), limit(1));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const data = snap.docs[0].data() || {};
      if (data.email) return normalizeEmail(data.email);
    }
  } catch (error) {
    console.warn("Fallback users.displayUsername raw lookup failed:", error);
  }

  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("displayUsername", "==", normalized), limit(1));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const data = snap.docs[0].data() || {};
      if (data.email) return normalizeEmail(data.email);
    }
  } catch (error) {
    console.warn("Fallback users.displayUsername normalized lookup failed:", error);
  }

  return null;
}

async function createUserDocument({ uid, fullName, username, email, role = "customer" }) {
  const normalizedUsername = normalizeUsername(username);
  const userRef = doc(db, "users", uid);
  const usernameRef = doc(db, "usernames", normalizedUsername);

  await setDoc(
    userRef,
    {
      uid,
      fullName: fullName.trim(),
      name: fullName.trim(),
      displayName: fullName.trim(),
      username: normalizedUsername,
      displayUsername: normalizedUsername,
      handle: normalizeHandle(normalizedUsername),
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

  await setDoc(
    usernameRef,
    {
      uid,
      email: normalizeEmail(email),
      username: normalizedUsername,
      displayUsername: normalizedUsername,
      handle: normalizeHandle(normalizedUsername),
      updatedAt: serverTimestamp()
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

  const loginInput = String(els.loginEmail?.value || "").trim();
  const password = els.loginPassword?.value || "";
  const rememberDevice = Boolean(els.rememberDevice?.checked);

  if (!loginInput || !password) {
    setMessage(els.loginMessage, "Please enter your email or username and password.", true);
    return;
  }

  let resolvedEmail = "";

  try {
    await setAuthPersistence(rememberDevice);

    if (looksLikeEmail(loginInput)) {
      resolvedEmail = normalizeEmail(loginInput);
    } else {
      resolvedEmail = await lookupEmailByUsername(loginInput);

      if (!resolvedEmail) {
        setMessage(els.loginMessage, getFriendlyAuthError({}, "username_lookup"), true);
        return;
      }
    }

    const credential = await signInWithEmailAndPassword(auth, resolvedEmail, password);
    const user = credential.user;
    const role = await getUserRoleFromFirestore(user.uid, user.email || resolvedEmail);

    saveUserRole(role);
    syncUserSession(user, role);
    await safelyUpdateLastLogin(user.uid);

    window.location.href = ROUTES.dashboard;
  } catch (error) {
    console.error("Login failed:", error);

    if (resolvedEmail && looksLikeEmail(resolvedEmail)) {
      setMessage(
        els.loginMessage,
        getFriendlyAuthError(error, "login"),
        true
      );
      return;
    }

    setMessage(els.loginMessage, getFriendlyAuthError(error, "login"), true);
  }
}

async function handleSignupSubmit(event) {
  event.preventDefault();
  clearMessages();

  const fullName = String(els.signupName?.value || "").trim();
  const username = normalizeUsername(els.signupUsername?.value || "");
  const email = normalizeEmail(els.signupEmail?.value || "");
  const password = els.signupPassword?.value || "";
  const confirmPassword = els.signupPasswordConfirm?.value || "";
  const rememberDevice = Boolean(els.signupRememberDevice?.checked);

  if (!fullName || !username || !email || !password || !confirmPassword) {
    setMessage(els.signupMessage, "Please complete every field, including a username.", true);
    return;
  }

  if (!looksLikeEmail(email)) {
    setMessage(els.signupMessage, "Please enter a valid email address.", true);
    return;
  }

  if (username.length < 1) {
    setMessage(els.signupMessage, "Username is required.", true);
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

    const taken = await usernameExists(username);
    if (taken) {
      setMessage(els.signupMessage, getFriendlyAuthError({}, "username_taken"), true);
      return;
    }

    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const user = credential.user;
    const role = inferRoleFromEmail(email);

    await updateProfile(user, {
      displayName: fullName
    });

    await createUserDocument({
      uid: user.uid,
      fullName,
      username,
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
    setMessage(els.signupMessage, getFriendlyAuthError(error, "signup"), true);
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
    setMessage(els.resetMessage, getFriendlyAuthError(error, "reset"), true);
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