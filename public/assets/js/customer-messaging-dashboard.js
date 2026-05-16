import {
  auth,
  onAuthStateChanged,
  getSavedUserProfile
} from './firebase.js';

import {
  createDashboardRuntime,
  startDashboardRuntime,
  stopDashboardRuntime,
  registerRuntimeCleanup
} from './dashboard-runtime.js';

import {
  getCustomerMessageThreads,
  getCustomerThreadMessages,
  summarizeCustomerMessages,
  subscribeCustomerMessages,
  unsubscribeCustomerMessages,
  markCustomerThreadRead,
  addCustomerMessage
} from './customer-messaging-center.js';

const statusNode = document.getElementById('customerMessagingStatus');
const totalNode = document.getElementById('messageThreadTotal');
const openNode = document.getElementById('messageThreadOpen');
const urgentNode = document.getElementById('messageThreadUrgent');
const unreadNode = document.getElementById('messageThreadUnread');
const threadRoot = document.getElementById('customerThreadRoot');
const messageRoot = document.getElementById('customerMessageRoot');
const composerForm = document.getElementById('customerMessageComposer');
const composerInput = document.getElementById('customerMessageInput');

const runtime = createDashboardRuntime({
  id: 'customer-messaging-dashboard-runtime',
  name: 'Customer Messaging Dashboard Runtime',
  metadata: { page: 'customer-messaging.html' }
});

let listenerId = null;
let activeThreadId = '';
let activeCustomerId = '';

function clean(value = '') {
  return String(value || '').replace(/[<>]/g, '');
}

function label(value = '') {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function status(message = '') {
  if (statusNode) statusNode.textContent = message;
}

function profile() {
  return getSavedUserProfile() || {};
}

function currentRole() {
  return String(profile().role || 'customer').toLowerCase();
}

function isTeamRole() {
  return ['owner', 'super_admin', 'admin', 'manager', 'operations_manager', 'operations_coordinator', 'staff', 'technician', 'cleaner', 'sales_rep'].includes(currentRole());
}

function resolveCustomerId() {
  const saved = profile();
  return isTeamRole() ? '' : (saved.uid || saved.id || auth.currentUser?.uid || '');
}

function visibleThreads() {
  if (isTeamRole()) return getCustomerMessageThreads();
  return getCustomerMessageThreads({ customerId: activeCustomerId });
}

function renderStats(rows = visibleThreads()) {
  const summary = summarizeCustomerMessages(rows);
  if (totalNode) totalNode.textContent = String(summary.total || 0);
  if (openNode) openNode.textContent = String(summary.open || 0);
  if (urgentNode) urgentNode.textContent = String(summary.urgent || 0);
  if (unreadNode) unreadNode.textContent = String(isTeamRole() ? summary.unreadForTeam : summary.unreadForCustomer);
}

function renderThreads() {
  if (!threadRoot) return;

  const rows = visibleThreads();
  renderStats(rows);

  if (!rows.length) {
    threadRoot.innerHTML = '<div class="item muted">No conversations yet.</div>';
    renderMessages(null);
    return;
  }

  if (!activeThreadId || !rows.some((thread) => thread.id === activeThreadId)) {
    activeThreadId = rows[0].id;
  }

  threadRoot.innerHTML = rows.map((thread) => {
    const active = thread.id === activeThreadId ? ' active' : '';
    const unread = isTeamRole() ? thread.unreadForTeam : thread.unreadForCustomer;

    return '<article class="item message-thread' + active + '" data-thread-id="' + clean(thread.id) + '"><h3>' + clean(thread.subject) + '</h3><p class="muted">' + clean(thread.customerName || 'Customer') + ' • ' + clean(label(thread.status)) + '</p><p class="muted">' + clean(thread.lastMessagePreview || 'No messages yet.') + '</p><div class="row"><span class="pill">' + clean(label(thread.priority)) + '</span><span class="pill">Unread: ' + clean(String(unread || 0)) + '</span><span class="pill">' + clean(label(thread.relatedType || 'account')) + '</span></div></article>';
  }).join('');

  renderMessages(activeThreadId);
}

function renderMessages(threadId) {
  if (!messageRoot) return;

  if (!threadId) {
    messageRoot.innerHTML = '<div class="item muted">Select a conversation to view messages.</div>';
    return;
  }

  const rows = getCustomerThreadMessages(threadId);

  if (!rows.length) {
    messageRoot.innerHTML = '<div class="item muted">No messages in this conversation yet.</div>';
    return;
  }

  messageRoot.innerHTML = rows.map((message) => {
    return '<article class="item"><h3>' + clean(message.senderName || 'User') + '</h3><p class="muted">' + clean(label(message.senderRole || 'customer')) + ' • ' + clean(new Date(message.createdAtMs).toLocaleString()) + '</p><p>' + clean(message.body) + '</p></article>';
  }).join('');
}

function bindEvents() {
  threadRoot?.addEventListener('click', (event) => {
    const item = event.target.closest('[data-thread-id]');
    if (!item) return;
    activeThreadId = item.getAttribute('data-thread-id') || '';
    markCustomerThreadRead(activeThreadId, isTeamRole() ? 'team' : 'customer');
    renderThreads();
  });

  composerForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!activeThreadId || !composerInput?.value?.trim()) return;

    const saved = profile();
    addCustomerMessage(activeThreadId, {
      senderId: saved.uid || saved.id || auth.currentUser?.uid || '',
      senderName: saved.displayName || saved.fullName || saved.name || auth.currentUser?.email || 'User',
      senderRole: currentRole(),
      body: composerInput.value.trim()
    });

    composerInput.value = '';
    renderThreads();
  });
}

async function startCustomerMessagingDashboard() {
  stopCustomerMessagingDashboard();
  activeCustomerId = resolveCustomerId();

  await startDashboardRuntime(runtime.id, [
    {
      label: 'Subscribe customer messaging renderer',
      run() {
        listenerId = subscribeCustomerMessages(() => {
          renderThreads();
          status('Customer messaging synced.');
        });

        return () => {
          if (listenerId) unsubscribeCustomerMessages(listenerId);
          listenerId = null;
        };
      }
    }
  ]);

  renderThreads();
}

function stopCustomerMessagingDashboard() {
  if (listenerId) unsubscribeCustomerMessages(listenerId);
  listenerId = null;
  stopDashboardRuntime(runtime.id);
}

function init() {
  bindEvents();
  registerRuntimeCleanup(runtime.id, stopCustomerMessagingDashboard);
  window.EvaraPageLifecycle?.registerCleanup?.(stopCustomerMessagingDashboard);
  window.addEventListener('pagehide', stopCustomerMessagingDashboard);

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      stopCustomerMessagingDashboard();
      window.location.assign('/login.html');
      return;
    }

    startCustomerMessagingDashboard().catch((error) => {
      console.error(error);
      status('Customer messaging failed to start.');
    });
  });
}

window.EvaraCustomerMessagingDashboard = {
  startCustomerMessagingDashboard,
  stopCustomerMessagingDashboard,
  renderThreads,
  renderMessages
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
