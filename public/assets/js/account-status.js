import {
  auth,
  signOut,
  clearSavedUserRole,
  clearSavedUserProfile
} from './firebase.js';
import {
  ACCOUNT_LIFECYCLE_STATES,
  accountLifecycleCopy,
  normalizeLifecycleValue
} from './account-lifecycle.js';

function byId(id) {
  return document.getElementById(id);
}

function label(value = '') {
  return String(value || '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sessionForStatus(value = window.EvaraRouteSession) {
  if (value?.mode !== 'account-status' || value?.source !== 'verified-route-guard') return null;
  return value;
}

function renderStatus(session) {
  const state = normalizeLifecycleValue(
    session?.lifecycle || ACCOUNT_LIFECYCLE_STATES.VERIFICATION_REQUIRED
  );
  const copy = accountLifecycleCopy(state);

  document.documentElement.dataset.accountLifecycle = state;
  if (document.body) document.body.dataset.accountLifecycle = state;

  const eyebrow = byId('accountStatusEyebrow');
  const title = byId('accountStatusTitle');
  const body = byId('accountStatusBody');
  const stateValue = byId('accountStatusState');
  const roleValue = byId('accountStatusRole');
  const emailValue = byId('accountStatusEmail');
  const approvalValue = byId('accountStatusApproval');
  const statusValue = byId('accountStatusRecordStatus');

  if (eyebrow) eyebrow.textContent = copy.eyebrow;
  if (title) title.textContent = copy.title;
  if (body) body.textContent = copy.body;
  if (stateValue) stateValue.textContent = label(state || 'verification required');
  if (roleValue) roleValue.textContent = session?.role ? label(session.role) : 'Not verified';
  if (emailValue) emailValue.textContent = session?.email || 'Authenticated account';
  if (approvalValue) approvalValue.textContent = session?.approvalStatus ? label(session.approvalStatus) : 'Not verified';
  if (statusValue) statusValue.textContent = session?.status ? label(session.status) : 'Not verified';
}

async function handleSignOut() {
  const button = byId('accountStatusSignOut');
  if (button) {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Signing Out…';
  }

  try {
    await signOut(auth);
  } finally {
    clearSavedUserRole();
    clearSavedUserProfile();
    window.location.replace('/login.html');
  }
}

function init() {
  byId('accountStatusRefresh')?.addEventListener('click', () => window.location.reload());
  byId('accountStatusSignOut')?.addEventListener('click', handleSignOut);

  const current = sessionForStatus();
  if (current) renderStatus(current);
}

window.addEventListener('evara:session-ready', (event) => {
  const session = sessionForStatus(event.detail);
  if (session) renderStatus(session);
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
