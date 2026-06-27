import { auth, sendPasswordResetEmail } from './firebase.js';

const form = document.getElementById('resetForm');
const emailInput = document.getElementById('resetEmail');
const message = document.getElementById('resetMessage');

function show(text, state = 'info') {
  if (!message) return;
  message.textContent = text;
  message.dataset.state = state;
}

async function handleReset(event) {
  event.preventDefault();
  const email = emailInput?.value?.trim() || '';
  const button = form?.querySelector('button[type="submit"]');
  if (!email) {
    show('Enter the email connected to the account.', 'error');
    emailInput?.focus();
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = 'Sending...';
  }

  try {
    await sendPasswordResetEmail(auth, email);
    show('Reset email sent. Check the inbox and spam folder for the newest Evaraos email.', 'success');
  } catch (error) {
    const code = String(error?.code || '');
    let text = error?.message || 'The reset email could not be sent.';
    if (code.includes('invalid-email')) text = 'Enter a valid email address.';
    if (code.includes('user-not-found')) text = 'No account was found for that email.';
    if (code.includes('too-many-requests')) text = 'Too many attempts. Wait a few minutes and try again.';
    if (code.includes('unauthorized-domain')) text = 'This website domain is not authorized in Firebase Authentication.';
    show(text, 'error');
  } finally {
    if (button) {
      button.disabled = false;
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
