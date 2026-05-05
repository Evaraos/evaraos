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

function byId(id) { return document.getElementById(id); }
function setMessage(el, message, type = "info") { if (el) { el.textContent = message || ""; el.dataset.state = type; } }
function normalizeUsername(value) { return String(value || "").trim().toLowerCase(); }
function safeProfileName(user) { return user?.displayName || user?.email || "User"; }

function navigateWithLoader(url, options = {}) {
  if (window.EvaraLoader?.beginNavigationLoad) window.EvaraLoader.beginNavigationLoad(options);
  requestAnimationFrame(() => window.location.assign(url));
}

function setFormBusy(form, isBusy, submitTextBusy, submitTextIdle) {
  const submit = form?.querySelector('button[type="submit"]');
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

function authErrorMessage(error, fallback = "Something went wrong. Try again.") {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "Login failed. Check your email and password.";
  if (code.includes("too-many-requests")) return "Too many attempts. Wait a moment, then try again.";
  if (code.includes("email-already-in-use")) return "That email already has an account. Use login or reset password.";
  if (code.includes("weak-password")) return "Password must be at least 6 characters.";
  if (code.includes("permission-denied")) return "You signed in, but profile access was blocked. Refresh and try again.";
  if (message.toLowerCase().includes("username")) return message;
  return error?.message || fallback;
}

function normalizeUserData(data = {}, user = {}) {
  const displayName = data.displayName || data.fullName || data.name || safeProfileName(user);
  return {
    uid: data.uid || user.uid || "",
    id: data.id || user.uid || "",
    email: data.email || user.email || "",
    username: data.username || "",
    usernameLower: data.usernameLower || normalizeUsername(data.username || ""),
    displayName,
    fullName: data.fullName || displayName,
    name: data.name || displayName,
    role: data.role || DEFAULT_PUBLIC_ROLE,
    status: data.status || DEFAULT_PUBLIC_STATUS,
    approvalStatus: data.approvalStatus || DEFAULT_PUBLIC_APPROVAL,
    companyId: typeof data.companyId === "string" ? data.companyId : "",
    companyName: typeof data.companyName === "string" ? data.companyName : "",
    companySlug: typeof data.companySlug === "string" ? data.companySlug : "",
    companyCategory: typeof data.companyCategory === "string" ? data.companyCategory : ""
  };
}

async function loadOrCreateUserProfile(user, preferredProfile = {}) {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) return normalizeUserData(snap.data() || {}, user);

  const fallbackName = preferredProfile.displayName || safeProfileName(user);
  const newProfile = {
    uid: user.uid,
    id: user.uid,
    email: user.email || "",
    username: preferredProfile.username || "",
    usernameLower: normalizeUsername(preferredProfile.username || ""),
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
  await setDoc(userRef, newProfile, { merge: true });
  return newProfile;
}

function syncSafeSession(user, extras = {}) {
  const profile = normalizeUserData(extras, user);
  syncUserSession(user, profile.role || DEFAULT_PUBLIC_ROLE, {
    displayName: profile.displayName,
    fullName: profile.fullName,
    name: profile.name,
    username: profile.username,
    companyId: profile.companyId,
    companyName: profile.companyName,
    approvalStatus: profile.approvalStatus,
    status: profile.status
  });
  return profile;
}

function redirectForRole(role = DEFAULT_PUBLIC_ROLE) {
  const normalized = String(role || DEFAULT_PUBLIC_ROLE).toLowerCase();
  if (normalized === "customer") {
    navigateWithLoader("/customer_dashboard.html", { title: "Opening portal", subtitle: "Loading your customer portal." });
    return;
  }
  navigateWithLoader("/dashboard.html", { title: "Opening dashboard", subtitle: "Loading your Evaraos workspace." });
}

async function findEmailFromUsername(usernameValue) {
  const raw = String(usernameValue || "").trim();
  const normalized = normalizeUsername(raw);
  if (!normalized) return null;

  const usersRef = collection(db, "users");
  const snap = await getDocs(query(usersRef, where("usernameLower", "==", normalized), limit(1)));
  if (!snap.empty) {
    const data = snap.docs[0].data() || {};
    return data.email || null;
  }
  return null;
}

async function resolveLoginEmail(loginValue) {
  const raw = String(loginValue || "").trim();
  if (!raw) return "";
  if (raw.includes("@")) return raw;

  const email = await findEmailFromUsername(raw);
  if (!email || !email.includes("@")) throw new Error("Username not found. Use your email or check the spelling.");
  return email;
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const form = byId("loginForm");
  const emailInput = byId("loginEmail");
  const passwordInput = byId("loginPassword");
  const rememberInput = byId("rememberDevice");
  const messageEl = byId("loginMessage");
  const email = emailInput?.value?.trim() || "";
  const password = passwordInput?.value || "";
  const rememberDevice = !!rememberInput?.checked;

  if (!email || !password) { setMessage(messageEl, "Enter your email and password.", "error"); return; }

  try {
    setFormBusy(form, true, "Signing In...", "Login");
    setMessage(messageEl, email.includes("@") ? "Signing you in securely..." : "Finding your username securely...", "info");
    await setAuthPersistence(rememberDevice);
    const resolvedEmail = await resolveLoginEmail(email);
    const result = await signInWithEmailAndPassword(auth, resolvedEmail, password);
    const user = result.user;
    let profile = syncSafeSession(user, { email: user.email || resolvedEmail, displayName: user.displayName || user.email || email, status: DEFAULT_PUBLIC_STATUS, approvalStatus: DEFAULT_PUBLIC_APPROVAL });
    try {
      profile = await loadOrCreateUserProfile(user);
      syncSafeSession(user, profile);
    } catch (profileError) { console.warn("Profile sync skipped after login:", profileError); }
    setMessage(messageEl, "Login successful. Redirecting...", "success");
    redirectForRole(profile.role);
  } catch (error) {
    console.error("Login failed:", error);
    setMessage(messageEl, authErrorMessage(error, "Login failed. Check your username/email and password."), "error");
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

  if (!fullName || !username || !email || !password || !confirmPassword) { setMessage(messageEl, "Fill out every field before creating your account.", "error"); return; }
  if (password !== confirmPassword) { setMessage(messageEl, "Passwords do not match.", "error"); return; }
  if (password.length < 6) { setMessage(messageEl, "Password must be at least 6 characters.", "error"); return; }

  try {
    setFormBusy(form, true, "Creating Account...", "Create Account");
    setMessage(messageEl, "Creating your customer account...", "info");
    await setAuthPersistence(rememberDevice);
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const user = result.user;
    await updateProfile(user, { displayName: fullName });
    const userDoc = { uid: user.uid, id: user.uid, email, username, usernameLower, displayName: fullName, fullName, name: fullName, role: DEFAULT_PUBLIC_ROLE, phone: "", bio: "", status: DEFAULT_PUBLIC_STATUS, approvalStatus: DEFAULT_PUBLIC_APPROVAL, companyId: "", companyName: "", companySlug: "", companyCategory: "", createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    await setDoc(doc(db, "users", user.uid), userDoc, { merge: true });
    syncUserSession(user, DEFAULT_PUBLIC_ROLE, { displayName: fullName, fullName, name: fullName, username, companyId: "", companyName: "", approvalStatus: DEFAULT_PUBLIC_APPROVAL, status: DEFAULT_PUBLIC_STATUS });
    setMessage(messageEl, "Account created. Your customer portal is opening while approval stays pending.", "success");
    navigateWithLoader("/customer_dashboard.html", { title: "Opening portal", subtitle: "Loading your customer account." });
  } catch (error) {
    console.error("Signup failed:", error);
    setMessage(messageEl, authErrorMessage(error, "Could not create account. Try again."), "error");
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
  if (!email) { setMessage(messageEl, "Enter your account email.", "error"); return; }
  try {
    setFormBusy(form, true, "Sending Reset Link...", "Send Reset Link");
    setMessage(messageEl, "Sending reset email...", "info");
    await sendPasswordResetEmail(auth, email);
    setMessage(messageEl, "Password reset email sent. Check your inbox.", "success");
  } catch (error) {
    console.error("Reset failed:", error);
    setMessage(messageEl, authErrorMessage(error, "Could not send reset email. Try again."), "error");
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
