import {
  auth,
  db,
  doc,
  getDoc,
  signOut,
  clearSavedUserRole,
  clearSavedUserProfile
} from './firebase.js';
import {
  ACCOUNT_LIFECYCLE_STATES,
  accountLifecycleCopy,
  normalizeLifecycleValue
} from './account-lifecycle.js';

const APPLICATION_STATES = Object.freeze({
  submitted: 'Submitted',
  assigned: 'Assigned for review',
  needs_more_info: 'More information needed',
  approved: 'Approved',
  rejected: 'Not approved'
});

let loadedApplicationUserId = '';

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

function applicationState(application = {}) {
  const status = normalizeLifecycleValue(application.status);
  if (['approved', 'rejected', 'needs_more_info'].includes(status)) return status;
  if (normalizeLifecycleValue(application.assignmentStatus) === 'assigned' || application.companyId) return 'assigned';
  return 'submitted';
}

function timestampDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = timestampDate(value);
  if (!date) return 'Not available';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function setApplicationText(id, value, fallback = 'Not available') {
  const element = byId(id);
  if (element) element.textContent = String(value || '').trim() || fallback;
}

function renderStaffApplication(application = {}) {
  const state = applicationState(application);
  const stateLabel = APPLICATION_STATES[state] || label(state);
  const panel = byId('staffApplicationStatusPanel');

  if (panel) panel.hidden = false;
  setApplicationText('staffApplicationStatusBadge', stateLabel);
  setApplicationText('staffApplicationState', stateLabel);
  setApplicationText('staffApplicationRole', application.roleRequested || application.desiredRole);
  setApplicationText('staffApplicationPreference', application.desiredCompany);
  setApplicationText('staffApplicationCompany', application.companyName, 'Not assigned');
  setApplicationText('staffApplicationSubmittedAt', formatDate(application.submittedAt || application.createdAt));
}

async function loadStaffApplication(session) {
  const userId = String(session?.userId || '').trim();
  if (!userId || loadedApplicationUserId === userId) return;
  loadedApplicationUserId = userId;

  try {
    const snapshot = await getDoc(doc(db, 'staff_applications', userId));
    if (!snapshot.exists()) return;
    renderStaffApplication(snapshot.data() || {});
  } catch (error) {
    loadedApplicationUserId = '';
    console.warn('Staff application status could not be loaded:', error);
  }
}

function renderVerifiedStatus(session) {
  renderStatus(session);
  loadStaffApplication(session);
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
  if (current) renderVerifiedStatus(current);
}

window.addEventListener('evara:session-ready', (event) => {
  const session = sessionForStatus(event.detail);
  if (session) renderVerifiedStatus(session);
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
