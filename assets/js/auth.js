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

function navigateWithLoader(url, options = {}) {
  if (window.EvaraLoader && typeof window.EvaraLoader.beginNavigationLoad === "function") {
    window.EvaraLoader.beginNavigationLoad(options);
  }

  requestAnimationFrame(() => {
    window.location.assign(url);
  });
}

function setFormBusy(form, isBusy, submitTextBusy, submitTextIdle) {
  if (!form) return;
  const submit = form.querySelector('button[type="submit"]');
  if (!submit) return;

  submit.disabled = isBusy;
  submit.textContent = isBusy ? submitTextBusy : submitTextIdle;
}

function bindPasswordToggle(buttonId, inputId) {
  const button = byId(buttonId);
  const input = byId(inputId);
  if (!button || !input) return;

  button.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    button.classList.toggle("is-open", show);
    button.setAttribute("aria-label", show ? "Hide password" : "Show password");
  });
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

async function backfillLegacyUserDoc(user) {
  if (!user?.uid) return { role: "owner", username: "" };

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    const fallbackName = user.displayName || user.email || "User";
    const userDoc = {
      uid: user.uid,
      email: user.email || "",
      username: "",
      usernameLower: "",
      displayName: fallbackName,
      fullName: fallbackName,
      role: "owner",
      phone: "",
      bio: "",
      createdAt: new Date().toISOString()
    };
    await setDoc(userRef, userDoc, { merge: true });
    return userDoc;
  }

  const data = snap.data() || {};
  const username = String(data.username || "").trim();
  const patch = {};

  if (!data.displayName && data.fullName) {
    patch.displayName = data.fullName;
  }

  if (!data.fullName && data.displayName) {
    patch.fullName = data.displayName;
  }

  if (username && !data.usernameLower) {
    patch.usernameLower = normalizeUsername(username);
  }

  if (!data.role) {
    patch.role = "owner";
  }

  if (Object.keys(patch).length) {
    await setDoc(userRef, patch, { merge: true });
  }

  return {
    ...data,
    ...patch
  };
}

async function findEmailFromLogin(loginValue) {
  const raw = String(loginValue || "").trim();
  if (!raw) return null;

  if (raw.includes("@")) {
    return raw;
  }

  const normalized = normalizeUsername(raw);
  const usersRef = collection(db, "users");

  const q1 = query(usersRef, where("username", "==", raw), limit(1));
  const s1 = await getDocs(q1);
  if (!s1.empty) {
    const data = s1.docs[0].data() || {};
    if (data.email) return data.email;
  }

  const q2 = query(usersRef, where("usernameLower", "==", normalized), limit(1));
  const s2 = await getDocs(q2);
  if (!s2.empty) {
    const data = s2.docs[0].data() || {};
    if (data.email) return data.email;
  }

  return null;
}

async function handleLoginSubmit(event) {
  event.preventDefault();

  const form = byId("loginForm");
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
    setFormBusy(form, true, "Signing In...", "Login");
    setMessage(messageEl, "Signing you in...", "info");
    await setAuthPersistence(rememberDevice);

    let resolvedEmail = loginValue;
    if (!loginValue.includes("@")) {
      resolvedEmail = await findEmailFromLogin(loginValue);
      if (!resolvedEmail) {
        setMessage(messageEl, "Username not found.", "error");
        return;
      }
    }

    const result = await signInWithEmailAndPassword(auth, resolvedEmail, passwordValue);
    const user = result.user;

    const userData = await backfillLegacyUserDoc(user);
    const role = String(userData.role || "owner").toLowerCase();

    syncUserSession(user, role, {
      displayName: userData.displayName || userData.fullName || user.displayName || user.email || "User",
      fullName: userData.fullName || userData.displayName || user.displayName || "",
      username: userData.username || ""
    });

    setMessage(messageEl, "Login successful. Redirecting...", "success");
    navigateWithLoader("/evaraos/dashboard.html", {
      title: "Opening dashboard",
      subtitle: "Loading your Evaraos workspace."
    });
  } catch (error) {
    console.error("Login failed:", error);
    setMessage(messageEl, "Login failed. Check your credentials and try again.", "error");
  } finally {
    setFormBusy(form, false, "Signing In...", "Login");
  }
}

async function handleSignupSubmit(event) {
  event.preventDefault();

  const form = byId("signupForm");
  const nameInput = byId("signupName");
  const usernameInput = byId("signupUsername");
  const emailInput = byId("signupEmail");
  const passwordInput = byId("signupPassword");
  const confirmInput = byId("signupPasswordConfirm");
  const rememberInput = byId("signupRememberDevice");
  const messageEl = byId("signupMessage");

  const fullName = nameInput?.value?.trim() || "";
  const username = usernameInput?.value?.trim() || "";
  const usernameLower = normalizeUsername(username);
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
    setFormBusy(form, true, "Creating Account...", "Create Account");
    setMessage(messageEl, "Creating your account...", "info");
    await setAuthPersistence(rememberDevice);

    const existingUsernameQuery = query(
      collection(db, "users"),
      where("usernameLower", "==", usernameLower),
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
      usernameLower,
      displayName: fullName,
      fullName,
      role: "owner",
      phone: "",
      bio: "",
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, "users", user.uid), userDoc, { merge: true });

    syncUserSession(user, "owner", {
      displayName: fullName,
      fullName,
      username
    });

    setMessage(messageEl, "Account created successfully. Redirecting...", "success");
    navigateWithLoader("/evaraos/dashboard.html", {
      title: "Creating workspace",
      subtitle: "Opening your Evaraos dashboard."
    });
  } catch (error) {
    console.error("Signup failed:", error);
    setMessage(messageEl, "Could not create account. Try again.", "error");
  } finally {
    setFormBusy(form, false, "Creating Account...", "Create Account");
  }
}

async function handleResetSubmit(event) {
  event.preventDefault();

  const form = byId("resetForm");
  const emailInput = byId("resetEmail");
  const messageEl = byId("resetMessage");
  const email = emailInput?.value?.trim() || "";

  if (!email) {
    setMessage(messageEl, "Enter your account email.", "error");
    return;
  }

  try {
    setFormBusy(form, true, "Sending Reset Link...", "Send Reset Link");
    setMessage(messageEl, "Sending reset email...", "info");
    await sendPasswordResetEmail(auth, email);
    setMessage(messageEl, "Password reset email sent. Check your inbox.", "success");
  } catch (error) {
    console.error("Reset failed:", error);
    setMessage(messageEl, "Could not send reset email. Try again.", "error");
  } finally {
    setFormBusy(form, false, "Sending Reset Link...", "Send Reset Link");
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