import {
  requireAuth,
  hasPermission,
  loadCompany,
  saveUserProfile
} from './app.js';
import { db, collection, query, where, getDocs } from './firebase.js';
import { iconSvg } from './ui/icons.js';

const state = {
  user: null,
  records: [],
  companies: new Map(),
  editing: false,
  accessFailures: []
};

function clean(value = '') {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalize(value = '') { return String(value || '').trim().toLowerCase(); }
function first(...values) { return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '') ?? ''; }
function displayName(user = {}) { return first(user.displayName, user.fullName, user.name, user.username, user.email, 'Customer'); }
function initials(name = '') { return String(name).trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'C'; }
function timestamp(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function formatDate(value, options = {}) {
  const date = timestamp(value);
  if (!date) return 'Not recorded';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', ...options }).format(date);
}
function statusOf(record = {}) { return normalize(first(record.status, record.state, record.jobStatus, 'requested')); }
function serviceName(record = {}) { return first(record.serviceName, record.name, record.title, record.jobType, record.type, 'Service visit'); }
function staffId(record = {}) { return first(record.acceptedBy, record.acceptedByUid, record.assignedTo, record.assigneeId, record.staffId, record.technicianId, record.cleanerId); }
function companyId(record = {}) { return first(record.serviceCompanyId, record.vendorCompanyId, record.companyId, record.organizationId, record.providerCompanyId); }
function addressOf(record = {}) { return first(record.serviceAddress, record.address, record.customerAddress, record.location?.address, record.propertyAddress, 'Address pending'); }
function photos(record = {}, type = 'before') {
  const candidates = type === 'before'
    ? [record.beforePhotos, record.beforeImages, record.photosBefore, record.beforePhoto]
    : [record.afterPhotos, record.afterImages, record.photosAfter, record.afterPhoto];
  return candidates.flatMap((value) => Array.isArray(value) ? value : value ? [value] : []).filter(Boolean);
}

function identityFilters(user) {
  const uid = first(user.uid, user.id);
  const email = normalize(user.email);
  const filters = [];
  if (uid) {
    ['customerId', 'customerUid', 'userId', 'clientId', 'ownerId'].forEach((field) => filters.push([field, uid]));
  }
  if (email) {
    ['customerEmail', 'clientEmail', 'email'].forEach((field) => filters.push([field, email]));
  }
  return filters;
}

async function queryOwnedCollection(collectionName, user) {
  const unique = new Map();
  let successfulQueries = 0;
  const failures = [];

  for (const [field, value] of identityFilters(user)) {
    try {
      const snapshot = await getDocs(query(collection(db, collectionName), where(field, '==', value)));
      successfulQueries += 1;
      snapshot.docs.forEach((item) => unique.set(item.id, { id: item.id, ...item.data(), sourceCollection: collectionName }));
    } catch (error) {
      failures.push(error);
    }
  }

  if (!successfulQueries && failures.length) {
    state.accessFailures.push({ collectionName, error: failures[0] });
  }
  return [...unique.values()];
}

async function loadRecords(user) {
  const sources = ['jobs', 'customer_services', 'services', 'subscriptions'];
  const rows = [];
  for (const source of sources) rows.push(...await queryOwnedCollection(source, user));
  const unique = new Map(rows.map((row) => [`${row.sourceCollection}:${row.id}`, row]));
  return [...unique.values()].sort((a, b) => {
    const left = timestamp(first(a.scheduledAt, a.appointmentAt, a.createdAt, a.updatedAt))?.getTime() || 0;
    const right = timestamp(first(b.scheduledAt, b.appointmentAt, b.createdAt, b.updatedAt))?.getTime() || 0;
    return right - left;
  });
}

async function hydrateCompanies(records) {
  const ids = [...new Set(records.map(companyId).filter(Boolean))];
  await Promise.all(ids.map(async (id) => {
    const company = await loadCompany(id);
    if (company) state.companies.set(id, company);
  }));
}

function providerFor(record = {}) {
  const company = state.companies.get(companyId(record)) || {};
  return {
    name: first(record.acceptedByName, record.assigneeName, record.staffName, 'Awaiting staff acceptance'),
    role: first(record.staffRole, record.assigneeRole, record.providerRole, 'Service professional'),
    company: first(record.serviceCompanyName, record.vendorCompanyName, company.name, record.companyName, 'Company pending')
  };
}

function milestoneItems(record = {}) {
  const status = statusOf(record);
  return [
    ['Requested', first(record.requestedAt, record.createdAt), true],
    ['Accepted', first(record.acceptedAt, record.claimedAt, record.assignedAt), Boolean(staffId(record)) || ['accepted','assigned','en_route','arrived','in_progress','completed'].includes(status)],
    ['En route', first(record.enRouteAt, record.departedAt), ['en_route','arrived','in_progress','completed'].includes(status)],
    ['Arrived', first(record.arrivedAt, record.checkedInAt), ['arrived','in_progress','completed'].includes(status)],
    ['Work started', first(record.startedAt, record.inProgressAt), ['in_progress','completed'].includes(status)],
    ['Completed', first(record.completedAt, record.finishedAt), status === 'completed']
  ].map(([label, at, complete]) => ({ label, at, complete }));
}

function renderPhotoGroup(label, items) {
  return `<div class="customer-photo-group"><div class="customer-photo-head"><strong>${label}</strong><span>${items.length}</span></div>${items.length ? `<div class="customer-photo-grid">${items.map((src) => `<button type="button" class="customer-photo-button" data-photo-src="${clean(src)}"><img src="${clean(src)}" alt="${clean(label)} service documentation" loading="lazy" /></button>`).join('')}</div>` : `<p class="customer-empty-inline">No ${label.toLowerCase()} uploaded yet.</p>`}</div>`;
}

function renderRecord(record, index) {
  const provider = providerFor(record);
  const status = statusOf(record).replaceAll('_', ' ');
  const milestones = milestoneItems(record);
  const before = photos(record, 'before');
  const after = photos(record, 'after');
  const lat = first(record.latitude, record.lat, record.location?.lat);
  const lng = first(record.longitude, record.lng, record.location?.lng);
  const mapHref = lat && lng ? `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressOf(record))}`;
  return `<article class="customer-service-event glass-card" data-service-index="${index}">
    <div class="customer-event-top"><div><span class="customer-status-pill">${clean(status)}</span><h3>${clean(serviceName(record))}</h3><p>${clean(addressOf(record))}</p></div><time>${formatDate(first(record.scheduledAt, record.appointmentAt, record.createdAt))}</time></div>
    <div class="customer-provider-card"><span class="customer-provider-icon">${iconSvg('users')}</span><div><strong>${clean(provider.name)}</strong><p>${clean(provider.role)} · ${clean(provider.company)}</p></div><span class="customer-acceptance-note">First qualified staff member to accept</span></div>
    <div class="customer-event-grid">
      <section class="customer-job-timeline" aria-label="Service timeline">${milestones.map((item) => `<div class="customer-milestone ${item.complete ? 'is-complete' : ''}"><span></span><div><strong>${item.label}</strong><small>${item.at ? formatDate(item.at) : item.complete ? 'Confirmed' : 'Pending'}</small></div></div>`).join('')}</section>
      <section class="customer-location-card"><div class="customer-location-icon">${iconSvg('map')}</div><div><strong>Service location</strong><p>${clean(addressOf(record))}</p><small>${record.locationUpdatedAt ? `Location updated ${formatDate(record.locationUpdatedAt)}` : 'Live location appears when staff is en route.'}</small></div><a href="${mapHref}" target="_blank" rel="noopener">Open map</a></section>
    </div>
    <div class="customer-photo-sections">${renderPhotoGroup('Before', before)}${renderPhotoGroup('After', after)}</div>
    <footer class="customer-record-footer"><span>${clean(provider.company)}</span><span>Record ID ${clean(record.id || 'pending')}</span><span>Last updated ${formatDate(first(record.updatedAt, record.completedAt, record.createdAt))}</span></footer>
  </article>`;
}

function renderNotice() {
  const notice = document.getElementById('customerActiveNotice');
  if (!notice) return;
  if (state.accessFailures.length) {
    const collections = state.accessFailures.map((item) => item.collectionName).join(', ');
    notice.hidden = false;
    notice.innerHTML = `<span class="customer-live-dot"></span><div><strong>Your portal loaded, but some service records are permission-blocked</strong><p>Firestore denied customer-scoped reads for: ${clean(collections)}. Your profile remains available while access is repaired.</p></div><button type="button" data-retry-customer>Retry</button>`;
    return;
  }
  const active = state.records.find((record) => ['accepted','assigned','en_route','arrived','in_progress'].includes(statusOf(record)));
  if (!active) { notice.hidden = true; return; }
  const provider = providerFor(active);
  notice.hidden = false;
  notice.innerHTML = `<span class="customer-live-dot"></span><div><strong>${clean(provider.name)} is handling your service</strong><p>${clean(provider.role)} with ${clean(provider.company)} · ${clean(statusOf(active).replaceAll('_', ' '))}</p></div><button type="button" data-scroll-service="0">View progress</button>`;
}

function renderPortal() {
  const user = state.user || {};
  const name = displayName(user);
  document.getElementById('customerWelcomeName').textContent = name;
  document.getElementById('customerAvatar').innerHTML = user.photoURL ? `<img src="${clean(user.photoURL)}" alt="${clean(name)}" />` : `<span>${clean(initials(name))}</span>`;
  document.getElementById('customerPortalEmail').textContent = user.email || 'No email';
  document.getElementById('customerPortalPhone').textContent = user.phone || 'Add phone';
  document.getElementById('customerProfileName').textContent = name;
  document.getElementById('customerProfilePhone').textContent = user.phone || 'Add phone';
  document.getElementById('customerProfileNotes').textContent = user.notes || 'No notes added';
  document.getElementById('customerPortalCount').textContent = String(state.records.length);
  document.getElementById('customerPortalCompleted').textContent = String(state.records.filter((record) => statusOf(record) === 'completed').length);
  const root = document.getElementById('customerServiceTimeline');
  if (state.records.length) root.innerHTML = state.records.map(renderRecord).join('');
  else if (state.accessFailures.length) root.innerHTML = `<div class="customer-empty-state glass-card">${iconSvg('shield')}<h3>Service history is temporarily permission-blocked</h3><p>The page is working. Firestore rejected the customer-scoped record query, so no records are being falsely reported as missing.</p></div>`;
  else root.innerHTML = `<div class="customer-empty-state glass-card">${iconSvg('history')}<h3>No service history yet</h3><p>Requested, accepted, active, and completed services will appear here automatically.</p></div>`;
  renderNotice();
}

function revealPortal() {
  document.documentElement.classList.remove('auth-pending', 'boot-pending');
  document.body.classList.remove('app-loading', 'auth-pending');
  document.body.classList.add('app-ready');
  window.EvaraLoader?.markAppReady?.();
}

function setEditMode(editing) {
  state.editing = editing;
  document.getElementById('customerProfileView').hidden = editing;
  document.getElementById('customerProfileForm').hidden = !editing;
  if (editing) {
    document.getElementById('customerEditName').value = displayName(state.user);
    document.getElementById('customerEditPhone').value = state.user?.phone || '';
    document.getElementById('customerEditNotes').value = state.user?.notes || '';
  }
}

async function saveProfile(event) {
  event.preventDefault();
  const button = document.getElementById('customerSaveProfile');
  button.disabled = true;
  button.textContent = 'Saving…';
  try {
    const fullName = document.getElementById('customerEditName').value.trim();
    const phone = document.getElementById('customerEditPhone').value.trim();
    const notes = document.getElementById('customerEditNotes').value.trim();
    await saveUserProfile(state.user.uid || state.user.id, { displayName: fullName, fullName, phone, notes });
    state.user = { ...state.user, displayName: fullName, fullName, phone, notes };
    renderPortal();
    setEditMode(false);
  } catch (error) {
    console.error('Customer profile save failed:', error);
    alert(error?.message || 'Profile changes could not be saved.');
  } finally {
    button.disabled = false;
    button.textContent = 'Save changes';
  }
}

async function loadPortalData(user) {
  state.user = user;
  state.accessFailures = [];
  state.records = await loadRecords(user);
  await hydrateCompanies(state.records);
  renderPortal();
}

function bind() {
  document.getElementById('customerEditProfile')?.addEventListener('click', () => setEditMode(true));
  document.getElementById('customerCancelEdit')?.addEventListener('click', () => setEditMode(false));
  document.getElementById('customerProfileForm')?.addEventListener('submit', saveProfile);
  document.addEventListener('click', async (event) => {
    const photo = event.target.closest('[data-photo-src]');
    if (photo) {
      const modal = document.getElementById('customerPhotoModal');
      modal.querySelector('img').src = photo.dataset.photoSrc;
      modal.hidden = false;
    }
    if (event.target.closest('[data-close-photo]')) document.getElementById('customerPhotoModal').hidden = true;
    if (event.target.closest('[data-scroll-service]')) document.querySelector('.customer-service-event')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (event.target.closest('[data-retry-customer]') && state.user) {
      event.target.disabled = true;
      try { await loadPortalData(state.user); } finally { event.target.disabled = false; }
    }
  });
}

function init() {
  bind();
  const blankScreenGuard = setTimeout(() => {
    if (document.body.classList.contains('auth-pending') || document.body.classList.contains('app-loading')) {
      const notice = document.getElementById('customerActiveNotice');
      if (notice) {
        notice.hidden = false;
        notice.innerHTML = '<span class="customer-live-dot"></span><div><strong>The portal took too long to verify Firestore access</strong><p>The page was unlocked so you are not left on a blank screen. Refresh or sign in again if your profile does not appear.</p></div>';
      }
      revealPortal();
    }
  }, 7000);

  requireAuth(async (user) => {
    try {
      if (!hasPermission(user, 'customer_dashboard')) { window.location.href = '/dashboard.html'; return; }
      await loadPortalData(user);
    } catch (error) {
      console.error('Customer portal initialization failed:', error);
      state.user = user;
      state.accessFailures = [{ collectionName: 'portal initialization', error }];
      renderPortal();
    } finally {
      clearTimeout(blankScreenGuard);
      revealPortal();
    }
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
