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
  serverTimestamp
} from "./firebase.js";

const DEFAULT_PUBLIC_ROLE = "customer";
const DEFAULT_PUBLIC_STATUS = "pending";
const DEFAULT_PUBLIC_APPROVAL = "pending";

function byId(id) { return document.getElementById(id); }
function setMessage(el, message, type = "info") { if (el) { el.textContent = message || ""; el.dataset.state = type; } }
function normalizeUsername(value) { return String(value || "").trim().toLowerCase(); }
function normalizeEmail(value) { return String(value || "").trim().toLowerCase(); }
function safeProfileName(user) { return user?.displayName || user?.email || "User"; }

function navigateWithLoader(url, options = {}) {
  if (window.EvaraLoader?.beginNavigationLoad) window.EvaraLoader.beginNavigationLoad(options);
  requestAnimationFrame(() => window.location.assign(url));
}

function setFormBusy(form, isBusy, submitTextBusy, submitTextIdle) {
  const submit = form?.querySelector('button[type="submit"]');
  if (!submit) return;
  submit.disabled = isBusy;
  submit.setAttribute("aria-busy", String(isBusy));
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
  const normalized = `${code} ${message}`.toLowerCase();
  if (normalized.includes("securetoken.googleapis.com") || normalized.includes("granttoken-are-blocked") || normalized.includes("api-key-not-valid")) {
    return "Evaraos authentication is temporarily unavailable because the Firebase authentication API is blocked or misconfigured. Contact support and try again shortly.";
  }
  if (code.includes("invalid-email")) return "Enter the full email address connected to the account.";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "The email or password is incorrect. Use Forgot password if needed.";
  if (code.includes("user-disabled")) return "This account has been disabled. Contact Evaraos support.";
  if (code.includes("too-many-requests")) return "Too many attempts. Wait a few minutes or reset the password.";
  if (code.includes("network-request-failed")) return "The login request could not reach Firebase. Check the connection and try again.";
  if (code.includes("operation-not-allowed")) return "Email/password login is not currently enabled in Firebase Authentication.";
  if (code.includes("email-already-in-use")) return "That email already has an account. Log in or reset the password.";
  if (code.includes("weak-password")) return "Password must be at least 6 characters.";
  if (code.includes("permission-denied")) return "You signed in, but profile access was blocked. Refresh and try again.";
  return fallback;
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
    uid: user.uid,id: user.uid,email: user.email || "",username: preferredProfile.username || "",usernameLower: normalizeUsername(preferredProfile.username || ""),displayName: fallbackName,fullName: fallbackName,name: fallbackName,role: DEFAULT_PUBLIC_ROLE,phone: "",bio: "",status: DEFAULT_PUBLIC_STATUS,approvalStatus: DEFAULT_PUBLIC_APPROVAL,companyId: "",companyName: "",companySlug: "",companyCategory: "",createdAt: serverTimestamp(),updatedAt: serverTimestamp()
  };
  await setDoc(userRef, newProfile, { merge: true });
  return newProfile;
}

function syncSafeSession(user, extras = {}) {
  const profile = normalizeUserData(extras, user);
  syncUserSession(user, profile.role || DEFAULT_PUBLIC_ROLE, {displayName: profile.displayName,fullName: profile.fullName,name: profile.name,username: profile.username,companyId: profile.companyId,companyName: profile.companyName,approvalStatus: profile.approvalStatus,status: profile.status});
  return profile;
}

function redirectForRole(role = DEFAULT_PUBLIC_ROLE) {
  const normalized = String(role || DEFAULT_PUBLIC_ROLE).toLowerCase();
  if (normalized === "customer") { navigateWithLoader("/customer_dashboard.html", { title: "Opening portal", subtitle: "Loading your customer portal." }); return; }
  navigateWithLoader("/dashboard.html", { title: "Opening dashboard", subtitle: "Loading your Evaraos workspace." });
}

function resolveLoginEmail(loginValue) {
  const email = normalizeEmail(loginValue);
  if (!email) return "";
  if (!email.includes("@") || !email.includes(".")) throw new Error("Enter the full email address connected to the account.");
  return email;
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const form = byId("loginForm"), emailInput = byId("loginEmail"), passwordInput = byId("loginPassword"), rememberInput = byId("rememberDevice"), messageEl = byId("loginMessage");
  const email = normalizeEmail(emailInput?.value), password = passwordInput?.value || "", rememberDevice = !!rememberInput?.checked;
  if (!email || !password) { setMessage(messageEl, "Enter your account email and password.", "error"); return; }
  try {
    setFormBusy(form, true, "Signing In…", "Login");
    setMessage(messageEl, "Signing you in securely…", "info");
    await setAuthPersistence(rememberDevice);
    const resolvedEmail = resolveLoginEmail(email);
    const result = await signInWithEmailAndPassword(auth, resolvedEmail, password);
    const user = result.user;
    let profile = syncSafeSession(user, { email: user.email || resolvedEmail, displayName: user.displayName || user.email || email, status: DEFAULT_PUBLIC_STATUS, approvalStatus: DEFAULT_PUBLIC_APPROVAL });
    try { profile = await loadOrCreateUserProfile(user); syncSafeSession(user, profile); } catch (profileError) { console.warn("Profile sync skipped after login:", profileError); }
    setMessage(messageEl, "Login successful. Redirecting…", "success");
    redirectForRole(profile.role);
  } catch (error) {
    console.error("Login failed:", error);
    setMessage(messageEl, authErrorMessage(error, error?.message || "Login failed. Check the email and password."), "error");
  } finally { setFormBusy(form, false, "Signing In…", "Login"); }
}

async function handleSignupSubmit(event) {
  event.preventDefault();
  const form=byId("signupForm"),nameInput=byId("signupName"),usernameInput=byId("signupUsername"),emailInput=byId("signupEmail"),passwordInput=byId("signupPassword"),confirmInput=byId("signupPasswordConfirm"),rememberInput=byId("signupRememberDevice"),messageEl=byId("signupMessage");
  const fullName=nameInput?.value?.trim()||"",username=usernameInput?.value?.trim()||"",usernameLower=normalizeUsername(username),email=normalizeEmail(emailInput?.value),password=passwordInput?.value||"",confirmPassword=confirmInput?.value||"",rememberDevice=!!rememberInput?.checked;
  if (!fullName||!username||!email||!password||!confirmPassword){setMessage(messageEl,"Fill out every field before creating your account.","error");return;}
  if(password!==confirmPassword){setMessage(messageEl,"Passwords do not match.","error");return;}
  if(password.length<6){setMessage(messageEl,"Password must be at least 6 characters.","error");return;}
  try{
    setFormBusy(form,true,"Creating Account…","Create Account");setMessage(messageEl,"Creating your customer account…","info");await setAuthPersistence(rememberDevice);
    const result=await createUserWithEmailAndPassword(auth,email,password),user=result.user;await updateProfile(user,{displayName:fullName});
    const userDoc={uid:user.uid,id:user.uid,email,username,usernameLower,displayName:fullName,fullName,name:fullName,role:DEFAULT_PUBLIC_ROLE,phone:"",bio:"",status:DEFAULT_PUBLIC_STATUS,approvalStatus:DEFAULT_PUBLIC_APPROVAL,companyId:"",companyName:"",companySlug:"",companyCategory:"",createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
    await setDoc(doc(db,"users",user.uid),userDoc,{merge:true});syncUserSession(user,DEFAULT_PUBLIC_ROLE,{displayName:fullName,fullName,name:fullName,username,companyId:"",companyName:"",approvalStatus:DEFAULT_PUBLIC_APPROVAL,status:DEFAULT_PUBLIC_STATUS});
    setMessage(messageEl,"Account created. Opening your customer portal…","success");navigateWithLoader("/customer_dashboard.html",{title:"Opening portal",subtitle:"Loading your customer account."});
  }catch(error){console.error("Signup failed:",error);setMessage(messageEl,authErrorMessage(error,"Could not create account. Try again."),"error");}finally{setFormBusy(form,false,"Creating Account…","Create Account");}
}

function initLoginPage(){const form=byId("loginForm");if(!form)return;bindPasswordToggle("loginPasswordToggle","loginPassword");form.addEventListener("submit",handleLoginSubmit);}
function initSignupPage(){const form=byId("signupForm");if(!form)return;bindPasswordToggle("signupPasswordToggle","signupPassword");bindPasswordToggle("signupPasswordConfirmToggle","signupPasswordConfirm");form.addEventListener("submit",handleSignupSubmit);}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{initLoginPage();initSignupPage();},{once:true});else{initLoginPage();initSignupPage();}
