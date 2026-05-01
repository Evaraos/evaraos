import {
  auth,
  db,
  setAuthPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  syncUserSession,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
  serverTimestamp
} from "./firebase.js";

const DEFAULT_PUBLIC_ROLE = "customer";
const DEFAULT_PUBLIC_STATUS = "pending";
const DEFAULT_PUBLIC_APPROVAL = "pending";

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

function safeProfileName(user) {
  return user?.displayName || user?.email || "User";
}

async function backfillLegacyUserDoc(user) {
  if (!user?.uid) {
    return {
      role: DEFAULT_PUBLIC_ROLE,
      username: "",
      status: DEFAULT_PUBLIC_STATUS,
      approvalStatus: DEFAULT_PUBLIC_APPROVAL,
      companyId: ""
    };
  }

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    const fallbackName = safeProfileName(user);
    const userDoc = {
      uid: user.uid,
      id: user.uid,
      email: user.email || "",
      username: "",
      usernameLower: "",
      displayName: fallbackName,
      fullName: fallbackName,
      name: fallbackName,
      role: DEFAULT_PUBLIC_ROLE,
      phone: "",
      bio: "",
      status: DEFAULT_PUBLIC_STATUS,
      approvalStatus: DEFAULT_PUBLIC_APPROVAL,
      companyId: "",
      companyName: "",
      companySlug: "",
      companyCategory: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(userRef, userDoc, { merge: true });
    return userDoc;
  }

  const data = snap.data() || {};
  const username = String(data.username || "").trim();
  const patch = {};

  if (!data.displayName && data.fullName) patch.displayName = data.fullName;
  if (!data.fullName && data.displayName) patch.fullName = data.displayName;
  if (!data.name && (data.displayName || data.fullName)) patch.name = data.displayName || data.fullName;
  if (username && !data.usernameLower) patch.usernameLower = normalizeUsername(username);

  if (Object.keys(patch).length) {
    patch.updatedAt = serverTimestamp();
    try {
      await setDoc(userRef, patch, { merge: true });
    } catch (error) {
      console.warn("Legacy profile cleanup skipped by security rules:", error);
    }
  }

  return {
    ...data,
    ...patch,
    uid: data.uid || user.uid,
    id: data.id || user.uid,
    email: data.email || user.email || "",
    role: data.role || DEFAULT_PUBLIC_ROLE,
    status: data.status || DEFAULT_PUBLIC_STATUS,
    approvalStatus: data.approvalStatus || DEFAULT_PUBLIC_APPROVAL,
    companyId: typeof data.companyId === "string" ? data.companyId : "",
    companyName: typeof data.companyName === "string" ? data.companyName : "",
    companySlug: typeof data.companySlug === "string" ? data.companySlug : "",
    companyCategory: typeof data.companyCategory === "string" ? data.companyCategory : ""
  };
}

async function findEmailFromLogin(loginValue) {
  const raw = String(loginValue || "").trim();
  if (!raw) return null;
  if (raw.includes("@")) return raw;

  const normalized = normalizeUsername(raw);
  const usersRef = collection(db, "users");

  const exactUsernameQuery = query(usersRef, where("username", "==", raw), limit(1));
  const exactUsernameSnap = await getDocs(exactUsernameQuery);
  if (!exactUsernameSnap.empty) {
    const data = exactUsernameSnap.docs[0].data() || {};
    if (data.email) return data.email;
  }

  const normalizedUsernameQuery = query(usersRef, where("usernameLower", "==", normalized), limit(1));
  const normalizedUsernameSnap = await getDocs(normalizedUsernameQuery);
  if (!normalizedUsernameSnap.empty) {
    const data = normalizedUsernameSnap.docs[0].data() || {};
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

    if (!loginValue.includes("@")) {
      setMessage(messageEl, "For security, use your email address to sign in.", "error");
      return;
    }

    const result = await signInWithEmailAndPassword(auth, loginValue, passwordValue);
    const user = result.user;
    const userData = await backfillLegacyUserDoc(user);
    const role = String(userData.role || DEFAULT_PUBLIC_ROLE).toLowerCase();

    syncUserSession(user, role, {
      displayName: userData.displayName || userData.fullName || userData.name || user.displayName || user.email || "User",
      fullName: userData.fullName || userData.displayName || userData.name || user.displayName || "",
      name: userData.name || userData.fullName || userData.displayName || user.displayName || "",
      username: userData.username || "",
      companyId: userData.companyId || "",
      companyName: userData.companyName || "",
      approvalStatus: userData.approvalStatus || DEFAULT_PUBLIC_APPROVAL,
      status: userData.status || DEFAULT_PUBLIC_STATUS
    });

    setMessage(messageEl, "Login successful. Redirecting...", "success");
    navigateWithLoader(role === "customer" ? "/customer_dashboard.html" : "/dashboard.html", {
      title: role === "customer" ? "Opening portal" : "Opening dashboard",
      subtitle: role === "customer" ? "Loading your customer portal." : "Loading your Evaraos workspace."
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
    setMessage(messageEl, "Creating your customer account...", "info");
    await setAuthPersistence(rememberDevice);

    const result = await createUserWithEmailAndPassword(auth, email, password);
    const user = result.user;

    await updateProfile(user, { displayName: fullName });

    const userDoc = {
      uid: user.uid,
      id: user.uid,
      email,
      username,
      usernameLower,
      displayName: fullName,
      fullName,
      name: fullName,
      role: DEFAULT_PUBLIC_ROLE,
      phone: "",
      bio: "",
      status: DEFAULT_PUBLIC_STATUS,
      approvalStatus: DEFAULT_PUBLIC_APPROVAL,
      companyId: "",
      companyName: "",
      companySlug: "",
      companyCategory: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, "users", user.uid), userDoc, { merge: true });

    syncUserSession(user, DEFAULT_PUBLIC_ROLE, {
      displayName: fullName,
      fullName,
      name: fullName,
      username,
      companyId: "",
      companyName: "",
      approvalStatus: DEFAULT_PUBLIC_APPROVAL,
      status: DEFAULT_PUBLIC_STATUS
    });

    setMessage(messageEl, "Account created. Your customer portal is opening while approval stays pending.", "success");
    navigateWithLoader("/customer_dashboard.html", {
      title: "Opening portal",
      subtitle: "Loading your customer account."
    });
  } catch (error) {
    console.error("Signup failed:", error);
    setMessage(messageEl, error.message || "Could not create account. Try again.", "error");
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

function injectProtectionNote(form, anchorSelector = ".auth-actions") {
  if (!form || form.querySelector(".evaraos-app-check-note")) return;

  const note = document.createElement("p");
  note.className = "evaraos-app-check-note";
  note.textContent = "Protected by Evaraos App Check and reCAPTCHA Enterprise.";
  note.style.margin = "12px 0 0";
  note.style.fontSize = "12px";
  note.style.fontWeight = "800";
  note.style.opacity = "0.68";
  note.style.lineHeight = "1.4";

  const anchor = form.querySelector(anchorSelector) || form.lastElementChild;
  if (anchor?.parentElement) anchor.parentElement.insertBefore(note, anchor.nextSibling);
  else form.appendChild(note);
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
  injectProtectionNote(form);
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
