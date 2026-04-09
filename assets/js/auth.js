import { auth, db } from "./firebase.js";

import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  getMultiFactorResolver,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  updateProfile,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ROUTES = {
  home: "/evaraos/index.html",
  login: "/evaraos/login.html",
  signup: "/evaraos/signup.html",
  dashboard: "/evaraos/dashboard.html"
};

const TRUSTED_DEVICE_KEY_PREFIX = "evaraos_trusted_device_";

let recaptchaVerifier = null;
let mfaResolver = null;
let mfaVerificationId = null;

const els = {
  loginForm: document.getElementById("loginForm"),
  signupForm: document.getElementById("signupForm"),
  resetForm: document.getElementById("resetForm"),

  loginMessage: document.getElementById("loginMessage"),
  signupMessage: document.getElementById("signupMessage"),
  resetMessage: document.getElementById("resetMessage"),
  mfaChallengeMessage: document.getElementById("mfaChallengeMessage"),

  openResetBtn: document.getElementById("openResetBtn"),
  closeResetBtn: document.getElementById("closeResetBtn"),
  resetPanel: document.getElementById("resetPanel"),

  mfaChallengePanel: document.getElementById("mfaChallengePanel"),
  mfaChallengeForm: document.getElementById("mfaChallengeForm"),
  mfaCode: document.getElementById("mfaCode"),

  loginIdentifier: document.getElementById("username"),
  loginPassword: document.getElementById("password"),
  rememberTrustedDevice: document.getElementById("rememberTrustedDevice"),

  signupName: document.getElementById("signupName"),
  signupUsername: document.getElementById("signupUsername"),
  signupEmail: document.getElementById("signupEmail"),
  signupPassword: document.getElementById("signupPassword"),
  signupPasswordConfirm: document.getElementById("signupPasswordConfirm"),
  signupSecurityPhone: document.getElementById("signupSecurityPhone"),
  signupSmsProtection: document.getElementById("signupSmsProtection"),

  resetEmail: document.getElementById("resetEmail"),

  recaptchaContainer: document.getElementById("recaptcha-container")
};

function setText(idOrElement, text = "", isError = false) {
  const element =
    typeof idOrElement === "string"
      ? document.getElementById(idOrElement)
      : idOrElement;

  if (!element) return;
  element.textContent = text;
  element.style.color = isError ? "#ff9b8f" : "";
}

function clearMessages() {
  setText(els.loginMessage, "");
  setText(els.signupMessage, "");
  setText(els.resetMessage, "");
  setText(els.mfaChallengeMessage, "");
}

function sanitizeUsername(value = "") {
  return value.trim().toLowerCase().replace(/^@+/, "");
}

function looksLikeEmail(value = "") {
  return /\S+@\S+\.\S+/.test(value.trim());
}

function normalizePhone(value = "") {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) return trimmed.replace(/[^\d+]/g, "");
  const digits = trimmed.replace(/\D/g, "");
  return digits ? `+1${digits}` : "";
}

function passwordStrongEnough(password = "") {
  return typeof password === "string" && password.length >= 8;
}

function trustedDeviceKey(uid) {
  return `${TRUSTED_DEVICE_KEY_PREFIX}${uid}`;
}

function rememberTrustedDevice(uid) {
  if (!uid) return;
  localStorage.setItem(trustedDeviceKey(uid), "true");
}

function getFriendlyAuthError(error) {
  const code = error?.code || "";

  switch (code) {
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-login-credentials":
    case "auth/invalid-credential":
      return "Invalid email, username, or password.";
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
    case "auth/code-expired":
      return "That verification code expired. Try again.";
    case "auth/invalid-verification-code":
      return "That verification code is invalid.";
    default:
      return "Something went wrong. Please try again.";
  }
}

async function resolveEmailFromIdentifier(identifier) {
  const clean = identifier.trim();

  if (!clean) {
    throw new Error("Missing login identifier.");
  }

  if (looksLikeEmail(clean)) {
    return clean;
  }

  const normalizedUsername = sanitizeUsername(clean);
  const usernameRef = doc(db, "usernames", normalizedUsername);
  const usernameSnap = await getDoc(usernameRef);

  if (!usernameSnap.exists()) {
    throw new Error("Username not found.");
  }

  const usernameData = usernameSnap.data() || {};
  if (!usernameData.email) {
    throw new Error("Username record missing email.");
  }

  return usernameData.email;
}

async function usernameExists(username) {
  const usernameRef = doc(db, "usernames", sanitizeUsername(username));
  const snap = await getDoc(usernameRef);
  return snap.exists();
}

async function createUserDocuments({
  uid,
  fullName,
  username,
  email,
  securityPhone,
  smsProtection
}) {
  const normalizedUsername = sanitizeUsername(username);
  const normalizedPhone = normalizePhone(securityPhone);

  const userRef = doc(db, "users", uid);
  const usernameRef = doc(db, "usernames", normalizedUsername);

  await setDoc(userRef, {
    uid,
    fullName: fullName.trim(),
    displayName: fullName.trim(),
    displayUsername: username.trim(),
    username: normalizedUsername,
    email: email.trim().toLowerCase(),
    role: "customer",
    active: true,
    approvalStatus: "approved",
    companyAccessLevel: "standard",
    smsProtection: smsProtection === "on",
    securityPhone: normalizedPhone || "",
    mfaPhone: normalizedPhone || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLogin: serverTimestamp()
  });

  await setDoc(usernameRef, {
    uid,
    username: normalizedUsername,
    email: email.trim().toLowerCase(),
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

function createRecaptchaIfNeeded() {
  if (recaptchaVerifier || !els.recaptchaContainer) return recaptchaVerifier;

  recaptchaVerifier = new RecaptchaVerifier(
    auth,
    els.recaptchaContainer,
    {
      size: "invisible"
    }
  );

  return recaptchaVerifier;
}

async function beginMfaChallenge(mfaError) {
  try {
    mfaResolver = getMultiFactorResolver(auth, mfaError);
    const hint = mfaResolver.hints?.[0];

    if (!hint) {
      throw new Error("No MFA hint available.");
    }

    createRecaptchaIfNeeded();

    const phoneAuthProvider = new PhoneAuthProvider(auth);
    mfaVerificationId = await phoneAuthProvider.verifyPhoneNumber(
      {
        multiFactorHint: hint,
        session: mfaResolver.session
      },
      recaptchaVerifier
    );

    if (els.mfaChallengePanel) {
      els.mfaChallengePanel.classList.remove("hidden");
    }

    setText(
      els.mfaChallengeMessage,
      `Verification code sent to ${hint.phoneNumber || "your phone"}.`,
      false
    );
  } catch (error) {
    console.error("MFA challenge start failed:", error);
    setText(
      els.loginMessage,
      "Could not start number verification. Try again.",
      true
    );
  }
}

async function finishMfaChallenge(code) {
  if (!mfaResolver || !mfaVerificationId) {
    throw new Error("Missing MFA state.");
  }

  const credential = PhoneAuthProvider.credential(
    mfaVerificationId,
    code.trim()
  );
  const assertion = PhoneMultiFactorGenerator.assertion(credential);
  const result = await mfaResolver.resolveSignIn(assertion);

  if (els.rememberTrustedDevice?.checked && result?.user?.uid) {
    rememberTrustedDevice(result.user.uid);
  }

  await safelyUpdateLastLogin(result.user?.uid);
  window.location.href = ROUTES.dashboard;
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

function wirePasswordToggle(buttonId, inputId, openIconId, closedIconId) {
  const button = document.getElementById(buttonId);
  const input = document.getElementById(inputId);
  const openIcon = document.getElementById(openIconId);
  const closedIcon = document.getElementById(closedIconId);

  if (!button || !input) return;

  button.addEventListener("click", () => {
    const nextType = input.type === "password" ? "text" : "password";
    const isVisible = nextType === "text";

    input.type = nextType;
    button.setAttribute("aria-pressed", String(isVisible));
    button.setAttribute(
      "aria-label",
      isVisible ? "Hide password" : "Show password"
    );

    if (openIcon) openIcon.style.display = isVisible ? "none" : "";
    if (closedIcon) closedIcon.style.display = isVisible ? "" : "none";
  });
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  clearMessages();

  const identifier = els.loginIdentifier?.value?.trim() || "";
  const password = els.loginPassword?.value || "";

  if (!identifier || !password) {
    setText(els.loginMessage, "Please enter your email or username and password.", true);
    return;
  }

  try {
    const resolvedEmail = await resolveEmailFromIdentifier(identifier);

    await setPersistence(
      auth,
      els.rememberTrustedDevice?.checked
        ? browserLocalPersistence
        : browserSessionPersistence
    );

    const result = await signInWithEmailAndPassword(auth, resolvedEmail, password);

    if (els.rememberTrustedDevice?.checked && result?.user?.uid) {
      rememberTrustedDevice(result.user.uid);
    }

    await safelyUpdateLastLogin(result.user?.uid);
    window.location.href = ROUTES.dashboard;
  } catch (error) {
    console.error("Login failed:", error);

    if (error?.code === "auth/multi-factor-auth-required") {
      await beginMfaChallenge(error);
      return;
    }

    setText(els.loginMessage, "Invalid email, username, or password.", true);
  }
}

async function handleSignupSubmit(event) {
  event.preventDefault();
  clearMessages();

  const fullName = els.signupName?.value?.trim() || "";
  const username = els.signupUsername?.value?.trim() || "";
  const email = els.signupEmail?.value?.trim() || "";
  const password = els.signupPassword?.value || "";
  const confirmPassword = els.signupPasswordConfirm?.value || "";
  const securityPhone = els.signupSecurityPhone?.value?.trim() || "";
  const smsProtection = els.signupSmsProtection?.value || "off";

  if (!fullName || !username || !email || !password || !confirmPassword) {
    setText(els.signupMessage, "Please fill out all required fields.", true);
    return;
  }

  if (!passwordStrongEnough(password)) {
    setText(els.signupMessage, "Use at least 8 characters for your password.", true);
    return;
  }

  if (password !== confirmPassword) {
    setText(els.signupMessage, "Passwords do not match.", true);
    return;
  }

  if (!looksLikeEmail(email)) {
    setText(els.signupMessage, "Please enter a valid email address.", true);
    return;
  }

  if (sanitizeUsername(username).length < 2) {
    setText(els.signupMessage, "Username must be at least 2 characters.", true);
    return;
  }

  try {
    const taken = await usernameExists(username);
    if (taken) {
      setText(els.signupMessage, "That username is already taken.", true);
      return;
    }

    await setPersistence(auth, browserLocalPersistence);

    const credential = await createUserWithEmailAndPassword(
      auth,
      email.trim().toLowerCase(),
      password
    );

    await updateProfile(credential.user, {
      displayName: fullName.trim()
    });

    await createUserDocuments({
      uid: credential.user.uid,
      fullName,
      username,
      email,
      securityPhone,
      smsProtection
    });

    setText(els.signupMessage, "Account created successfully. Redirecting...");
    window.location.href = ROUTES.dashboard;
  } catch (error) {
    console.error("Signup failed:", error);
    setText(els.signupMessage, getFriendlyAuthError(error), true);
  }
}

async function handleResetSubmit(event) {
  event.preventDefault();
  clearMessages();

  const email = els.resetEmail?.value?.trim() || "";

  if (!looksLikeEmail(email)) {
    setText(els.resetMessage, "Enter a valid email address.", true);
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    setText(els.resetMessage, "Reset email sent. Check your inbox.");
  } catch (error) {
    console.error("Reset failed:", error);
    setText(els.resetMessage, getFriendlyAuthError(error), true);
  }
}

async function handleMfaSubmit(event) {
  event.preventDefault();
  clearMessages();

  const code = els.mfaCode?.value?.trim() || "";

  if (!code) {
    setText(els.mfaChallengeMessage, "Enter the verification code.", true);
    return;
  }

  try {
    await finishMfaChallenge(code);
  } catch (error) {
    console.error("MFA verify failed:", error);
    setText(els.mfaChallengeMessage, getFriendlyAuthError(error), true);
  }
}

function bindResetPanel() {
  if (els.openResetBtn && els.resetPanel) {
    els.openResetBtn.addEventListener("click", () => {
      els.resetPanel.classList.remove("hidden");
      setText(els.resetMessage, "");
    });
  }

  if (els.closeResetBtn && els.resetPanel) {
    els.closeResetBtn.addEventListener("click", () => {
      els.resetPanel.classList.add("hidden");
      setText(els.resetMessage, "");
    });
  }
}

function guardAuthPages() {
  const path = window.location.pathname;

  if (
    !path.endsWith("/login.html") &&
    !path.endsWith("/signup.html")
  ) {
    return;
  }

  onAuthStateChanged(auth, (user) => {
    if (user) {
      window.location.href = ROUTES.dashboard;
    }
  });
}

function init() {
  wirePasswordToggle(
    "togglePasswordBtn",
    "password",
    "passwordIconOpen",
    "passwordIconClosed"
  );

  wirePasswordToggle(
    "toggleSignupPasswordBtn",
    "signupPassword",
    "signupPasswordIconOpen",
    "signupPasswordIconClosed"
  );

  wirePasswordToggle(
    "toggleSignupPasswordConfirmBtn",
    "signupPasswordConfirm",
    "signupPasswordConfirmIconOpen",
    "signupPasswordConfirmIconClosed"
  );

  if (els.loginForm) {
    els.loginForm.addEventListener("submit", handleLoginSubmit);
  }

  if (els.signupForm) {
    els.signupForm.addEventListener("submit", handleSignupSubmit);
  }

  if (els.resetForm) {
    els.resetForm.addEventListener("submit", handleResetSubmit);
  }

  if (els.mfaChallengeForm) {
    els.mfaChallengeForm.addEventListener("submit", handleMfaSubmit);
  }

  bindResetPanel();
  guardAuthPages();
}

window.addEventListener("DOMContentLoaded", init);