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
} from './firebase.js';
import {
  resolveAccountLifecycle,
  routeForAccountLifecycle
} from './account-lifecycle.js';

const DEFAULT_PUBLIC_ROLE = 'customer';
const DEFAULT_PUBLIC_STATUS = 'pending';
const DEFAULT_PUBLIC_APPROVAL = 'pending';

function byId(id) {
  return document.getElementById(id);
}

function setMessage(el, message, type = 'info') {
  if (!el) return;
  el.textContent = message || '';
  el.dataset.state = type;
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function safeProfileName(user) {
  return user?.displayName || user?.email || 'User';
}

function navigateWithLoader(url, options = {}) {
  if (window.EvaraLoader?.beginNavigationLoad) {
    window.EvaraLoader.beginNavigationLoad(options);
  }
  requestAnimationFrame(() => window.location.assign(url));
}

function setFormBusy(form, isBusy, submitTextBusy, submitTextIdle) {
  const submit = form?.querySelector('button[type="submit"]');
  if (!submit) return;
  submit.disabled = isBusy;
  submit.setAttribute('aria-busy', String(isBusy));
  submit.textContent = isBusy ? submitTextBusy : submitTextIdle;
}

function bindPasswordToggle(buttonId, inputId) {
  const button = byId(buttonId);
  const input = byId(inputId);
  if (!button || !input) return;

  button.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.classList.toggle('is-open', show);
    button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
}

function authErrorMessage(error, fallback = 'Something went wrong. Try again.') {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  const normalized = `${code} ${message}`.toLowerCase();

  if (
    normalized.includes('securetoken.googleapis.com')
    || normalized.includes('granttoken-are-blocked')
    || normalized.includes('api-key-not-valid')
  ) {
    return 'Evaraos authentication is temporarily unavailable because the Firebase authentication API is blocked or misconfigured. Contact support and try again shortly.';
  }
  if (code.includes('invalid-email')) return 'Enter the full email address connected to the account.';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return 'The email or password is incorrect. Use Forgot password if needed.';
  }
  if (code.includes('user-disabled')) return 'This account has been disabled. Contact Evaraos support.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Wait a few minutes or reset the password.';
  if (code.includes('network-request-failed')) return 'The login request could not reach Firebase. Check the connection and try again.';
  if (code.includes('operation-not-allowed')) return 'Email/password login is not currently enabled in Firebase Authentication.';
  if (code.includes('email-already-in-use')) return 'That email already has an account. Log in or reset the password.';
  if (code.includes('weak-password')) return 'Password must be at least 6 characters.';
  if (code.includes('permission-denied')) return 'You signed in, but profile access was blocked. Refresh and try again.';
  return fallback;
}

function normalizeUserData(data = {}, user = {}) {
  const displayName = data.displayName || data.fullName || data.name || safeProfileName(user);
  return {
    uid: data.uid || user.uid || '',
    id: data.id || user.uid || '',
    email: data.email || user.email || '',
    username: data.username || '',
    usernameLower: data.usernameLower || normalizeUsername(data.username || ''),
    displayName,
    fullName: data.fullName || displayName,
    name: data.name || displayName,
    role: data.role || DEFAULT_PUBLIC_ROLE,
    status: data.status || DEFAULT_PUBLIC_STATUS,
    approvalStatus: data.approvalStatus || DEFAULT_PUBLIC_APPROVAL,
    companyId: typeof data.companyId === 'string' ? data.companyId : '',
    companyName: typeof data.companyName === 'string' ? data.companyName : '',
    companySlug: typeof data.companySlug === 'string' ? data.companySlug : '',
    companyCategory: typeof data.companyCategory === 'string' ? data.companyCategory : ''
  };
}

async function loadOrCreateUserProfile(user, preferredProfile = {}) {
  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) return normalizeUserData(snap.data() || {}, user);

  const fallbackName = preferredProfile.displayName || safeProfileName(user);
  const newProfile = {
    uid: user.uid,
    id: user.uid,
    email: user.email || '',
    username: preferredProfile.username || '',
    usernameLower: normalizeUsername(preferredProfile.username || ''),
    displayName: fallbackName,
    fullName: fallbackName,
    name: fallbackName,
    role: DEFAULT_PUBLIC_ROLE,
    phone: '',
    bio: '',
    status: DEFAULT_PUBLIC_STATUS,
    approvalStatus: DEFAULT_PUBLIC_APPROVAL,
    companyId: '',
    companyName: '',
    companySlug: '',
    companyCategory: '',
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

function redirectForProfile(profile) {
  const lifecycle = resolveAccountLifecycle(profile);
  const destination = routeForAccountLifecycle(lifecycle);

  if (lifecycle.active) {
    navigateWithLoader(destination, {
      title: lifecycle.role === 'customer' ? 'Opening portal' : 'Opening dashboard',
      subtitle: 'Loading your approved Evaraos workspace.'
    });
    return lifecycle;
  }

  navigateWithLoader(destination, {
    title: 'Opening account status',
    subtitle: 'Reviewing your current approval and access state.'
  });
  return lifecycle;
}

function resolveLoginEmail(loginValue) {
  const email = normalizeEmail(loginValue);
  if (!email) return '';
  if (!email.includes('@') || !email.includes('.')) {
    throw new Error('Enter the full email address connected to the account.');
  }
  return email;
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const form = byId('loginForm');
  const emailInput = byId('loginEmail');
  const passwordInput = byId('loginPassword');
  const rememberInput = byId('rememberDevice');
  const messageEl = byId('loginMessage');
  const email = normalizeEmail(emailInput?.value);
  const password = passwordInput?.value || '';
  const rememberDevice = Boolean(rememberInput?.checked);

  if (!email || !password) {
    setMessage(messageEl, 'Enter your account email and password.', 'error');
    return;
  }

  try {
    setFormBusy(form, true, 'Signing In…', 'Login');
    setMessage(messageEl, 'Signing you in securely…', 'info');
    await setAuthPersistence(rememberDevice);

    const resolvedEmail = resolveLoginEmail(email);
    const result = await signInWithEmailAndPassword(auth, resolvedEmail, password);
    const user = result.user;
    const profile = await loadOrCreateUserProfile(user, {
      email: user.email || resolvedEmail,
      displayName: user.displayName || user.email || email
    });

    syncSafeSession(user, profile);
    const lifecycle = resolveAccountLifecycle(profile);
    setMessage(
      messageEl,
      lifecycle.active ? 'Login successful. Redirecting…' : 'Login successful. Opening account status…',
      'success'
    );
    redirectForProfile(profile);
  } catch (error) {
    console.error('Login failed:', error);
    setMessage(
      messageEl,
      authErrorMessage(error, error?.message || 'Login failed. Check the email and password.'),
      'error'
    );
  } finally {
    setFormBusy(form, false, 'Signing In…', 'Login');
  }
}

async function handleSignupSubmit(event) {
  event.preventDefault();
  const form = byId('signupForm');
  const nameInput = byId('signupName');
  const usernameInput = byId('signupUsername');
  const emailInput = byId('signupEmail');
  const passwordInput = byId('signupPassword');
  const confirmInput = byId('signupPasswordConfirm');
  const rememberInput = byId('signupRememberDevice');
  const messageEl = byId('signupMessage');

  const fullName = nameInput?.value?.trim() || '';
  const username = usernameInput?.value?.trim() || '';
  const usernameLower = normalizeUsername(username);
  const email = normalizeEmail(emailInput?.value);
  const password = passwordInput?.value || '';
  const confirmPassword = confirmInput?.value || '';
  const rememberDevice = Boolean(rememberInput?.checked);

  if (!fullName || !username || !email || !password || !confirmPassword) {
    setMessage(messageEl, 'Fill out every field before creating your account.', 'error');
    return;
  }
  if (password !== confirmPassword) {
    setMessage(messageEl, 'Passwords do not match.', 'error');
    return;
  }
  if (password.length < 6) {
    setMessage(messageEl, 'Password must be at least 6 characters.', 'error');
    return;
  }

  try {
    setFormBusy(form, true, 'Creating Account…', 'Create Account');
    setMessage(messageEl, 'Creating your customer account…', 'info');
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
      phone: '',
      bio: '',
      status: DEFAULT_PUBLIC_STATUS,
      approvalStatus: DEFAULT_PUBLIC_APPROVAL,
      companyId: '',
      companyName: '',
      companySlug: '',
      companyCategory: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, 'users', user.uid), userDoc, { merge: true });
    syncSafeSession(user, userDoc);
    setMessage(messageEl, 'Account created. Opening account status…', 'success');
    redirectForProfile(userDoc);
  } catch (error) {
    console.error('Signup failed:', error);
    setMessage(messageEl, authErrorMessage(error, 'Could not create account. Try again.'), 'error');
  } finally {
    setFormBusy(form, false, 'Creating Account…', 'Create Account');
  }
}

function initLoginPage() {
  const form = byId('loginForm');
  if (!form) return;
  bindPasswordToggle('loginPasswordToggle', 'loginPassword');
  form.addEventListener('submit', handleLoginSubmit);
}

function initSignupPage() {
  const form = byId('signupForm');
  if (!form) return;
  bindPasswordToggle('signupPasswordToggle', 'signupPassword');
  bindPasswordToggle('signupPasswordConfirmToggle', 'signupPasswordConfirm');
  form.addEventListener('submit', handleSignupSubmit);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initLoginPage();
    initSignupPage();
  }, { once: true });
} else {
  initLoginPage();
  initSignupPage();
}
