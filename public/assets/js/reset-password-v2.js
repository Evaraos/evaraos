import { auth, sendPasswordResetEmail } from './firebase.js';

const form = document.getElementById('resetForm');
const emailInput = document.getElementById('resetEmail');
const message = document.getElementById('resetMessage');

function show(text, state = 'info') {
  if (!message) return;
  message.textContent = text;
  message.dataset.state = state;
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function resetError(error) {
  const code = String(error?.code || '');
  const text = `${code} ${error?.message || ''}`.toLowerCase();
  if (code.includes('invalid-email')) return 'Enter the full email address connected to the account.';
  if (code.includes('too-many-requests')) return 'Too many reset attempts. Wait a few minutes and try again.';
  if (code.includes('unauthorized-domain')) return 'Password recovery is blocked because this website domain is not authorized in Firebase Authentication.';
  if (code.includes('network-request-failed')) return 'The reset request could not reach Firebase. Check the connection and try again.';
  if (code.includes('operation-not-allowed')) return 'Email/password recovery is not enabled in Firebase Authentication.';
  if (text.includes('api-key-not-valid') || text.includes('securetoken.googleapis.com') || text.includes('granttoken-are-blocked')) return 'Password recovery is temporarily unavailable because the Firebase authentication API is blocked or misconfigured.';
  return 'The reset email could not be sent. Try again or contact Evaraos support.';
}

async function handleReset(event) {
  event.preventDefault();
  const email = normalizeEmail(emailInput?.value);
  const button = form?.querySelector('button[type="submit"]');

  if (!email || !email.includes('@') || !email.includes('.')) {
    show('Enter the full email address connected to the account.', 'error');
    emailInput?.focus();
    return;
  }

  if (button) {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Sending…';
  }
  show('Requesting a secure password-reset email…', 'info');

  try {
    auth.useDeviceLanguage?.();
    await sendPasswordResetEmail(auth, email);
    show('If an account uses that email, a reset link has been sent. Check the inbox, spam, and promotions folders.', 'success');
    form?.reset();
  } catch (error) {
    console.error('Password reset failed:', error);
    show(resetError(error), 'error');
  } finally {
    if (button) {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.textContent = 'Send Reset Link';
    }
  }
}

function init() {
  form?.addEventListener('submit', handleReset);
  document.documentElement.classList.remove('auth-pending', 'boot-pending');
  document.body?.classList.remove('auth-pending', 'app-loading');
  document.body?.classList.add('app-ready');
  window.EvaraLoader?.markAppReady?.();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
