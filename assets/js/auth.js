// assets/js/auth.js

import {
  auth,
  db,
  setAuthPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  syncUserSession
} from "./firebase.js";

import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function byId(id) {
  return document.getElementById(id);
}

function setMessage(el, message, type = "info") {
  if (!el) return;
  el.textContent = message || "";
  el.dataset.state = type;
}

function bindPasswordToggle(buttonId, inputId) {
  const button = byId(buttonId);
  const input = byId(inputId);
  if (!button || !input) return;

  button.addEventListener("click", () => {
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    button.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
    button.classList.toggle("is-visible", isPassword);
  });
}

async function findEmailFromLogin(loginValue) {
  const raw = String(loginValue || "").trim();
  if (!raw) return null;

  if (raw.includes("@")) {
    return raw;
  }

  const usersRef = collection(db, "users");
  const usernameQuery = query(usersRef, where("username", "==", raw), limit(1));
  const usernameSnap = await getDocs(usernameQuery);

  if (!usernameSnap.empty) {
    const userData = usernameSnap.docs[0].data() || {};
    return userData.email || null;
  }

  return raw;
}

async function handleLoginSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const emailInput = byId("loginEmail");
  const passwordInput = byId("loginPassword");
  const rememberInput = byId("rememberDevice");
  const messageEl = byId("loginMessage");

  const loginValue = emailInput?.value?.trim() || "";
  const passwordValue = passwordInput?.value || "";
  const rememberDevice = !!rememberInput?.checked;

  if (!loginValue || !passwordValue) {
    setMessage(messageEl, "Enter your email or username and password.", "error");
    return;
  }

  try {
    setMessage(messageEl, "Signing you in...", "info");
    await setAuthPersistence(rememberDevice);

    const resolvedEmail = await findEmailFromLogin(loginValue);
    const result = await signInWithEmailAndPassword(auth, resolvedEmail, passwordValue);
    const user = result.user;

    let role = "customer";
    try {
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data() || {};
        role = data.role || "customer";
      }
    } catch {}

    syncUserSession(user, role);
    setMessage(messageEl, "Login successful. Redirecting...", "success");
    window.location.replace("/evaraos/dashboard.html");
  } catch (error) {
    console.error("Login failed:", error);
    setMessage(messageEl, "Login failed. Check your credentials and try again.", "error");
  }
}

async function handleSignupSubmit(event) {
  event.preventDefault();

  const nameInput = byId("signupName");
  const usernameInput = byId("signupUsername");
  const emailInput = byId("signupEmail");
  const passwordInput = byId("signupPassword");
  const confirmInput = byId("signupPasswordConfirm");
  const rememberInput = byId("signupRememberDevice");
  const messageEl = byId("signupMessage");

  const fullName = nameInput?.value?.trim() || "";
  const username = usernameInput?.value?.trim() || "";
  const email = emailInput?.value?.trim() || "";
  const password = passwordInput?.value || "";
  const confirmPassword = confirmInput?.value || "";
  const rememberDevice = !!rememberInput?.checked;

  if (!fullName || !username || !email || !password || !confirmPassword) {
    setMessage(messageEl, "Fill out every field before creating your account.", "error");
    return;
  }

  if (password !== confirmPassword) {
    setMessage(messageEl, "Passwords do not match.", "error");
    return;
  }

  if (password.length < 6) {
    setMessage(messageEl, "Password must be at least 6 characters.", "error");
    return;
  }

  try {
    setMessage(messageEl, "Creating your account...", "info");
    await setAuthPersistence(rememberDevice);

    const existingUsernameQuery = query(
      collection(db, "users"),
      where("username", "==", username),
      limit(1)
    );
    const existingUsernameSnap = await getDocs(existingUsernameQuery);

    if (!existingUsernameSnap.empty) {
      setMessage(messageEl, "That username is already taken.", "error");
      return;
    }

    const result = await createUserWithEmailAndPassword(auth, email, password);
    const user = result.user;

    await updateProfile(user, {
      displayName: fullName
    });

    const userDoc = {
      uid: user.uid,
      email,
      username,
      displayName: fullName,
      fullName,
      role: "customer",
      phone: "",
      bio: "",
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, "users", user.uid), userDoc, { merge: true });

    syncUserSession(user, "customer");
    setMessage(messageEl, "Account created successfully. Redirecting...", "success");
    window.location.replace("/evaraos/dashboard.html");
  } catch (error) {
    console.error("Signup failed:", error);
    setMessage(messageEl, "Could not create account. Try again.", "error");
  }
}

async function handleResetSubmit(event) {
  event.preventDefault();

  const emailInput = byId("resetEmail");
  const messageEl = byId("resetMessage");
  const email = emailInput?.value?.trim() || "";

  if (!email) {
    setMessage(messageEl, "Enter your account email.", "error");
    return;
  }

  try {
    setMessage(messageEl, "Sending reset email...", "info");
    await sendPasswordResetEmail(auth, email);
    setMessage(messageEl, "Password reset email sent. Check your inbox.", "success");
  } catch (error) {
    console.error("Reset failed:", error);
    setMessage(messageEl, "Could not send reset email. Try again.", "error");
  }
}

function initLoginPage() {
  const form = byId("loginForm");
  if (!form) return;

  bindPasswordToggle("loginPasswordToggle", "loginPassword");
  form.addEventListener("submit", handleLoginSubmit);
}

function initSignupPage() {
  const form = byId("signupForm");
  if (!form) return;

  bindPasswordToggle("signupPasswordToggle", "signupPassword");
  bindPasswordToggle("signupPasswordConfirmToggle", "signupPasswordConfirm");
  form.addEventListener("submit", handleSignupSubmit);
}

function initResetPage() {
  const form = byId("resetForm");
  if (!form) return;

  form.addEventListener("submit", handleResetSubmit);
}

document.addEventListener("DOMContentLoaded", () => {
  initLoginPage();
  initSignupPage();
  initResetPage();
});