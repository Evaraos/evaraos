import {
  auth,
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  getSavedUserProfile
} from './firebase.js';

const DEFAULT_BOOKING_CONFIG = Object.freeze({
  leadHours: 24,
  horizonDays: 60,
  intervalMinutes: 30,
  openTime: '08:00',
  closeTime: '18:00'
});

const state = {
  profile: {},
  companies: [],
  services: [],
  cart: new Map(),
  selectedCompanyId: '',
  submitting: false,
  requestsUnsubscribe: null
};

function escapeHtml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalize(value = '') {
  return String(value || '').trim().toLowerCase();
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function money(cents = 0) {
  return '$' + (finiteNumber(cents) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function slug(value = '') {
  return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function titleCase(value = '') {
  return String(value || '')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function notify(title, message, tone = 'info') {
  window.dispatchEvent(new CustomEvent('evara:notify', {
    detail: { title, message, tone }
  }));
}

function currentUserProfile() {
  const saved = getSavedUserProfile?.() || {};
  const user = auth.currentUser || {};
  return {
    ...saved,
    uid: user.uid || saved.uid || saved.id || '',
    id: user.uid || saved.id || saved.uid || '',
    email: user.email || saved.email || '',
    displayName:
      saved.displayName ||
      saved.fullName ||
      saved.name ||
      user.displayName ||
      user.email ||
      'Customer',
    phone: saved.phone || ''
  };
}

async function hydrateFullProfile() {
  const profile = currentUserProfile();
  if (!profile.uid) return profile;

  try {
    const snap = await getDoc(doc(db, 'users', profile.uid));
    return snap.exists() ? { ...profile, ...snap.data(), uid: profile.uid, id: profile.uid } : profile;
  } catch (error) {
    console.warn('Marketplace profile hydration skipped:', error);
    return profile;
  }
}

function companyName(company = {}) {
  return company.name || company.companyName || company.brand || company.title || 'Service company';
}

function companyStates(company = {}) {
  const raw = company.serviceStates || company.states || company.operatingStates || company.coverageStates || company.markets || [];
  if (Array.isArray(raw)) return raw.map(normalize).filter(Boolean);
  if (typeof raw === 'string') return raw.split(',').map(normalize).filter(Boolean);
  return [];
}

function companyCities(company = {}) {
  const raw = company.serviceCities || company.cities || company.operatingCities || company.coverageCities || [];
  if (Array.isArray(raw)) return raw.map(normalize).filter(Boolean);
  if (typeof raw === 'string') return raw.split(',').map(normalize).filter(Boolean);
  return [];
}

function companyAvailable(company = {}, location = {}) {
  const status = normalize(company.status || company.health || 'active');
  if (['inactive', 'archived', 'deleted', 'paused', 'suspended'].includes(status)) return false;

  const states = companyStates(company);
  const cities = companyCities(company);
  const stateMatch = !states.length || states.includes(normalize(location.state));
  const cityMatch = !cities.length || !location.city || cities.includes(normalize(location.city));
  return stateMatch && cityMatch;
}

function normalizeAddOn(addOn = {}, index = 0) {
  const name = addOn.name || addOn.label || addOn.title || `Add-on ${index + 1}`;
  return {
    id: addOn.id || slug(name) || `addon-${index + 1}`,
    name,
    description: addOn.description || '',
    priceCents: Math.max(0, Math.round(finiteNumber(addOn.priceCents ?? addOn.amountCents ?? (finiteNumber(addOn.price) * 100)))),
    perUnit: Boolean(addOn.perUnit || addOn.perQuantity)
  };
}

function normalizeService(record = {}, sourceCollection = 'services') {
  const name = record.name || record.serviceName || record.title || record.service || 'Service';
  const basePriceCents = Math.max(0, Math.round(finiteNumber(
    record.basePriceCents ??
    record.priceCents ??
    record.amountCents ??
    (finiteNumber(record.basePrice ?? record.price ?? record.amount) * 100)
  )));
  const minimumPriceCents = Math.max(0, Math.round(finiteNumber(
    record.minimumPriceCents ?? record.minimumCents ?? basePriceCents
  )));

  return {
    ...record,
    id: record.id,
    sourceCollection,
    name,
    category: record.category || record.serviceCategory || record.type || 'general',
    description: record.description || record.summary || '',
    companyId: record.companyId || record.vendorCompanyId || record.serviceCompanyId || '',
    companyName: record.companyName || record.vendorCompanyName || record.serviceCompanyName || '',
    status: normalize(record.status || 'active'),
    pricingType: normalize(record.pricingType || record.priceType || 'flat'),
    basePriceCents,
    minimumPriceCents,
    unitLabel: record.unitLabel || record.unit || 'unit',
    estimatedDurationMinutes: Math.max(15, finiteNumber(record.estimatedDurationMinutes ?? record.durationMinutes, 60)),
    requiresQuote: Boolean(record.requiresQuote || record.quoteRequired),
    recurringEligible: Boolean(record.recurringEligible || record.subscriptionEligible),
    addOns: safeArray(record.addOns || record.addons).map(normalizeAddOn),
    fees: safeArray(record.fees)
  };
}

async function loadCollection(name) {
  try {
    const snap = await getDocs(collection(db, name));
    return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch (error) {
    console.warn(`Marketplace skipped ${name}:`, error);
    return [];
  }
}

async function loadMarketplaceData() {
  const [companies, services, customerServices] = await Promise.all([
    loadCollection('companies'),
    loadCollection('services'),
    loadCollection('customer_services')
  ]);

  state.companies = companies;

  const deduped = new Map();
  [...services.map((item) => normalizeService(item, 'services')),
    ...customerServices.map((item) => normalizeService(item, 'customer_services'))]
    .filter((service) => service.id && !['inactive', 'paused', 'archived', 'deleted'].includes(service.status))
    .forEach((service) => {
      const key = `${service.companyId || 'marketplace'}:${slug(service.name) || service.id}`;
      if (!deduped.has(key) || service.sourceCollection === 'services') deduped.set(key, service);
    });

  state.services = [...deduped.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function propertyOptions(profile = {}) {
  const candidates = [
    ...safeArray(profile.properties),
    ...safeArray(profile.addresses),
    ...safeArray(profile.serviceAddresses)
  ];

  const unique = new Map();
  candidates.forEach((item, index) => {
    const value = typeof item === 'string' ? { address: item } : item || {};
    const address = value.address || value.street || value.streetAddress || value.serviceAddress || '';
    if (!address) return;
    const key = normalize([address, value.city, value.state, value.zip].filter(Boolean).join('|'));
    unique.set(key, {
      id: value.id || `property-${index + 1}`,
      label: value.label || value.name || value.nickname || `Property ${index + 1}`,
      propertyType: value.propertyType || value.type || 'residential',
      address,
      city: value.city || '',
      state: value.state || '',
      zip: value.zip || value.postalCode || '',
      notes: value.notes || value.accessNotes || ''
    });
  });

  return [...unique.values()];
}

function selectedCompany() {
  return state.companies.find((company) => company.id === state.selectedCompanyId) || null;
}

function serviceCompany(service = {}) {
  return state.companies.find((company) => company.id === service.companyId) || null;
}

function cartCompanyId() {
  const ids = [...state.cart.values()]
    .map((item) => item.service.companyId)
    .filter(Boolean);
  return ids[0] || state.selectedCompanyId || '';
}

function calculateLine(item = {}) {
  const service = item.service || {};
  const quantity = Math.max(1, finiteNumber(item.quantity, 1));
  const pricingType = service.pricingType;
  const base = pricingType === 'flat'
    ? service.basePriceCents
    : service.basePriceCents * quantity;
  const selectedAddOns = service.addOns.filter((addOn) => item.addOnIds.has(addOn.id));
  const addOnTotalCents = selectedAddOns.reduce((sum, addOn) => {
    return sum + (addOn.perUnit ? addOn.priceCents * quantity : addOn.priceCents);
  }, 0);
  const feeTotalCents = service.fees.reduce((sum, fee) => {
    return sum + Math.max(0, Math.round(finiteNumber(fee.amountCents ?? fee.priceCents ?? (finiteNumber(fee.amount) * 100))));
  }, 0);
  const subtotalCents = Math.max(service.minimumPriceCents || 0, base + addOnTotalCents + feeTotalCents);

  return {
    serviceId: service.id,
    serviceName: service.name,
    companyId: service.companyId,
    pricingType,
    quantity,
    unitLabel: service.unitLabel,
    basePriceCents: service.basePriceCents,
    addOns: selectedAddOns,
    addOnTotalCents,
    feeTotalCents,
    subtotalCents,
    totalCents: subtotalCents,
    estimatedDurationMinutes: service.estimatedDurationMinutes,
    requiresQuote: service.requiresQuote
  };
}

function cartLines() {
  return [...state.cart.values()].map(calculateLine);
}

function cartTotalCents() {
  return cartLines().reduce((sum, line) => sum + line.totalCents, 0);
}

function totalDurationMinutes() {
  return cartLines().reduce((sum, line) => sum + line.estimatedDurationMinutes, 0);
}

function locationFromForm() {
  const value = (id) => String(document.getElementById(id)?.value || '').trim();
  return {
    propertyLabel: value('marketplacePropertyLabel'),
    propertyType: value('marketplacePropertyType'),
    address: value('marketplaceAddress'),
    city: value('marketplaceCity'),
    state: value('marketplaceState'),
    zip: value('marketplaceZip'),
    accessNotes: value('marketplaceAccessNotes')
  };
}

function bookingConfig(company = {}) {
  const config = company.bookingConfig || company.scheduling || company.availabilityConfig || {};
  return {
    leadHours: Math.max(0, finiteNumber(config.leadHours ?? company.bookingLeadHours, DEFAULT_BOOKING_CONFIG.leadHours)),
    horizonDays: Math.max(1, finiteNumber(config.horizonDays ?? company.bookingHorizonDays, DEFAULT_BOOKING_CONFIG.horizonDays)),
    intervalMinutes: Math.max(15, finiteNumber(config.intervalMinutes ?? company.slotIntervalMinutes, DEFAULT_BOOKING_CONFIG.intervalMinutes)),
    openTime: config.openTime || company.bookingOpenTime || DEFAULT_BOOKING_CONFIG.openTime,
    closeTime: config.closeTime || company.bookingCloseTime || DEFAULT_BOOKING_CONFIG.closeTime,
    businessHours: config.businessHours || company.businessHours || company.bookingHours || {},
    unavailableDates: safeArray(config.unavailableDates || company.unavailableDates || company.blackoutDates).map(String),
    slotAvailability: config.slotAvailability || company.slotAvailability || company.bookingAvailability || {}
  };
}

function parseMinutes(value = '00:00') {
  const [hours, minutes] = String(value || '00:00').split(':').map(Number);
  return Math.max(0, Math.min(24 * 60, (finiteNumber(hours) * 60) + finiteNumber(minutes)));
}

function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function dayHours(date, config) {
  const key = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const configured = config.businessHours?.[key] || config.businessHours?.[key.slice(0, 3)] || null;
  if (configured === false || configured?.closed) return null;
  if (Array.isArray(configured)) return { open: configured[0], close: configured[1] };
  return {
    open: configured?.open || configured?.start || config.openTime,
    close: configured?.close || configured?.end || config.closeTime
  };
}

function explicitSlotRemaining(config, dateKey, time) {
  const day = config.slotAvailability?.[dateKey];
  if (day == null) return null;
  if (typeof day === 'number') return day;
  if (Array.isArray(day)) return day.includes(time) ? 1 : 0;
  const value = day?.[time];
  if (value == null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return finiteNumber(value, 0);
}

function availableSlots(dateValue, company = {}) {
  if (!dateValue) return [];
  const selectedDate = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(selectedDate.getTime())) return [];

  const config = bookingConfig(company);
  const dateKey = dateValue;
  if (config.unavailableDates.includes(dateKey)) return [];

  const hours = dayHours(selectedDate, config);
  if (!hours) return [];

  const openMinutes = parseMinutes(hours.open);
  const closeMinutes = parseMinutes(hours.close);
  const duration = Math.max(15, totalDurationMinutes());
  const earliest = Date.now() + (config.leadHours * 60 * 60 * 1000);
  const horizon = Date.now() + (config.horizonDays * 24 * 60 * 60 * 1000);
  const slots = [];

  for (let minute = openMinutes; minute + duration <= closeMinutes; minute += config.intervalMinutes) {
    const time = minutesToTime(minute);
    const startsAt = new Date(`${dateKey}T${time}:00`);
    const startsAtMs = startsAt.getTime();
    if (startsAtMs < earliest || startsAtMs > horizon) continue;

    const remaining = explicitSlotRemaining(config, dateKey, time);
    if (remaining !== null && remaining <= 0) continue;

    slots.push({
      time,
      startsAtMs,
      remaining,
      capacityStatus: remaining === null ? 'pending_backend_validation' : 'validated_from_company_config'
    });
  }

  return slots;
}

function serviceCard(service) {
  const cartItem = state.cart.get(service.id);
  const company = serviceCompany(service);
  const lockedCompanyId = cartCompanyId();
  const companyConflict = Boolean(lockedCompanyId && service.companyId && lockedCompanyId !== service.companyId);
  const priceLabel = service.requiresQuote || !service.basePriceCents
    ? 'Custom quote'
    : `${money(service.basePriceCents)}${service.pricingType === 'flat' ? '' : ` / ${escapeHtml(service.unitLabel)}`}`;

  return `
    <article class="marketplace-service-card ${cartItem ? 'is-selected' : ''} ${companyConflict ? 'is-disabled' : ''}" data-service-card="${escapeHtml(service.id)}">
      <div class="marketplace-service-card-top">
        <span class="marketplace-category">${escapeHtml(titleCase(service.category))}</span>
        <span class="marketplace-price">${priceLabel}</span>
      </div>
      <h3>${escapeHtml(service.name)}</h3>
      <p>${escapeHtml(service.description || 'Professional service delivered by a verified EvaraOS provider.')}</p>
      <div class="marketplace-service-meta">
        <span>${escapeHtml(company ? companyName(company) : service.companyName || 'Marketplace provider')}</span>
        <span>${escapeHtml(String(service.estimatedDurationMinutes))} min</span>
        ${service.recurringEligible ? '<span>Subscription eligible</span>' : ''}
      </div>
      <button type="button" class="btn ${cartItem ? 'btn-theme-secondary' : 'btn-theme-primary'}" data-add-service="${escapeHtml(service.id)}" ${companyConflict ? 'disabled' : ''}>
        ${cartItem ? 'Remove from order' : 'Add service'}
      </button>
    </article>
  `;
}

function renderServices() {
  const root = document.getElementById('marketplaceServiceGrid');
  if (!root) return;

  const queryValue = normalize(document.getElementById('marketplaceServiceSearch')?.value);
  const category = normalize(document.getElementById('marketplaceCategoryFilter')?.value);
  const rows = state.services.filter((service) => {
    const haystack = normalize([service.name, service.description, service.category, service.companyName].join(' '));
    return (!queryValue || haystack.includes(queryValue)) && (!category || normalize(service.category) === category);
  });

  root.innerHTML = rows.length
    ? rows.map(serviceCard).join('')
    : '<div class="marketplace-empty">No active services match this search yet.</div>';
}

function renderCategoryOptions() {
  const select = document.getElementById('marketplaceCategoryFilter');
  if (!select) return;
  const categories = [...new Set(state.services.map((service) => service.category).filter(Boolean))].sort();
  select.innerHTML = '<option value="">All categories</option>' + categories
    .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(titleCase(category))}</option>`)
    .join('');
}

function renderCart() {
  const root = document.getElementById('marketplaceCartItems');
  const total = document.getElementById('marketplaceCartTotal');
  const count = document.getElementById('marketplaceCartCount');
  if (!root) return;

  const items = [...state.cart.values()];
  if (count) count.textContent = String(items.length);
  if (total) total.textContent = money(cartTotalCents());

  root.innerHTML = items.length
    ? items.map((item) => {
        const line = calculateLine(item);
        return `
          <article class="marketplace-cart-item">
            <div class="marketplace-cart-head">
              <div><strong>${escapeHtml(item.service.name)}</strong><span>${escapeHtml(item.service.companyName || companyName(serviceCompany(item.service) || {}))}</span></div>
              <strong>${money(line.totalCents)}</strong>
            </div>
            <div class="marketplace-quantity-control" aria-label="Quantity for ${escapeHtml(item.service.name)}">
              <button type="button" data-cart-quantity="decrease" data-service-id="${escapeHtml(item.service.id)}" aria-label="Decrease quantity">−</button>
              <span>${escapeHtml(String(item.quantity))} ${escapeHtml(item.service.unitLabel)}</span>
              <button type="button" data-cart-quantity="increase" data-service-id="${escapeHtml(item.service.id)}" aria-label="Increase quantity">+</button>
            </div>
            ${item.service.addOns.length ? `
              <div class="marketplace-addons">
                <span>Add-ons</span>
                ${item.service.addOns.map((addOn) => `
                  <label>
                    <input type="checkbox" data-cart-addon="${escapeHtml(addOn.id)}" data-service-id="${escapeHtml(item.service.id)}" ${item.addOnIds.has(addOn.id) ? 'checked' : ''}>
                    <span>${escapeHtml(addOn.name)} · ${money(addOn.priceCents)}${addOn.perUnit ? ' each' : ''}</span>
                  </label>
                `).join('')}
              </div>
            ` : ''}
          </article>
        `;
      }).join('')
    : '<div class="marketplace-empty">Add a service to begin your order.</div>';

  renderProviders();
  renderScheduleSlots();
  updateSubmitState();
}

function matchingCompanies() {
  const location = locationFromForm();
  const lockedCompanyId = [...state.cart.values()]
    .map((item) => item.service.companyId)
    .find(Boolean);

  return state.companies.filter((company) => {
    if (lockedCompanyId && company.id !== lockedCompanyId) return false;
    return companyAvailable(company, location);
  });
}

function renderProviders() {
  const root = document.getElementById('marketplaceProviderOptions');
  if (!root) return;
  const matches = matchingCompanies();

  if (state.selectedCompanyId && !matches.some((company) => company.id === state.selectedCompanyId)) {
    state.selectedCompanyId = '';
  }
  if (!state.selectedCompanyId && matches.length === 1) state.selectedCompanyId = matches[0].id;

  root.innerHTML = matches.length
    ? matches.map((company) => `
        <label class="marketplace-provider-option ${state.selectedCompanyId === company.id ? 'is-selected' : ''}">
          <input type="radio" name="marketplaceProvider" value="${escapeHtml(company.id)}" ${state.selectedCompanyId === company.id ? 'checked' : ''}>
          <span><strong>${escapeHtml(companyName(company))}</strong><small>${escapeHtml((company.serviceCities || company.serviceStates || company.markets || 'Local service area').toString())}</small></span>
        </label>
      `).join('')
    : '<div class="marketplace-empty">No provider is currently configured for this address. Your request can still enter dispatch review.</div>';

  renderScheduleSlots();
}

function renderPropertyOptions() {
  const select = document.getElementById('marketplaceSavedProperty');
  if (!select) return;
  const properties = propertyOptions(state.profile);
  select.innerHTML = '<option value="">Enter a new service address</option>' + properties
    .map((property, index) => `<option value="${index}">${escapeHtml(property.label)} · ${escapeHtml(property.address)}</option>`)
    .join('');
  select.dataset.properties = JSON.stringify(properties);
}

function applySavedProperty(indexValue) {
  const select = document.getElementById('marketplaceSavedProperty');
  if (!select || indexValue === '') return;
  const properties = JSON.parse(select.dataset.properties || '[]');
  const property = properties[Number(indexValue)];
  if (!property) return;

  const values = {
    marketplacePropertyLabel: property.label,
    marketplacePropertyType: property.propertyType,
    marketplaceAddress: property.address,
    marketplaceCity: property.city,
    marketplaceState: property.state,
    marketplaceZip: property.zip,
    marketplaceAccessNotes: property.notes
  };
  Object.entries(values).forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node) node.value = value || '';
  });
  renderProviders();
}

function renderScheduleSlots() {
  const select = document.getElementById('marketplaceTime');
  const message = document.getElementById('marketplaceSlotMessage');
  const dateValue = document.getElementById('marketplaceDate')?.value || '';
  if (!select) return;

  const company = selectedCompany() || matchingCompanies()[0] || {};
  const slots = availableSlots(dateValue, company);
  const previous = select.value;
  select.innerHTML = '<option value="">Select a time</option>' + slots
    .map((slot) => `<option value="${escapeHtml(slot.time)}" data-start-ms="${slot.startsAtMs}" data-capacity-status="${escapeHtml(slot.capacityStatus)}">${escapeHtml(new Date(slot.startsAtMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))}${slot.remaining !== null ? ` · ${escapeHtml(String(slot.remaining))} remaining` : ''}</option>`)
    .join('');
  if ([...select.options].some((option) => option.value === previous)) select.value = previous;

  if (message) {
    if (!dateValue) message.textContent = 'Choose a date to see available times.';
    else if (!slots.length) message.textContent = 'No configured time slots are available for this date.';
    else message.textContent = 'Availability is checked against provider hours. Final capacity is confirmed when the provider reviews the request.';
  }
  updateSubmitState();
}

function selectedSchedule() {
  const date = String(document.getElementById('marketplaceDate')?.value || '');
  const timeSelect = document.getElementById('marketplaceTime');
  const time = String(timeSelect?.value || '');
  const option = timeSelect?.selectedOptions?.[0];
  const requestedScheduleAtMs = date && time ? new Date(`${date}T${time}:00`).getTime() : 0;
  return {
    date,
    time,
    requestedScheduleAtMs,
    requestedScheduleAt: requestedScheduleAtMs ? new Date(requestedScheduleAtMs).toISOString() : '',
    capacityStatus: option?.dataset?.capacityStatus || 'pending_backend_validation'
  };
}

function updateSubmitState() {
  const button = document.getElementById('marketplaceSubmitOrder');
  if (!button) return;
  const location = locationFromForm();
  const schedule = selectedSchedule();
  const ready = state.cart.size > 0 && location.address && location.city && location.state && location.zip && schedule.requestedScheduleAtMs;
  button.disabled = state.submitting || !ready;
}

function addOrRemoveService(serviceId) {
  const service = state.services.find((item) => item.id === serviceId);
  if (!service) return;

  if (state.cart.has(serviceId)) {
    state.cart.delete(serviceId);
  } else {
    const lockedCompanyId = cartCompanyId();
    if (lockedCompanyId && service.companyId && lockedCompanyId !== service.companyId) {
      notify('One provider per order', 'Create a separate order for services supplied by another company.', 'warning');
      return;
    }
    state.cart.set(serviceId, { service, quantity: 1, addOnIds: new Set() });
    if (service.companyId) state.selectedCompanyId = service.companyId;
  }

  renderServices();
  renderCart();
}

function changeQuantity(serviceId, direction) {
  const item = state.cart.get(serviceId);
  if (!item) return;
  item.quantity = Math.max(1, Math.min(99, item.quantity + (direction === 'increase' ? 1 : -1)));
  renderCart();
}

function changeAddOn(serviceId, addOnId, checked) {
  const item = state.cart.get(serviceId);
  if (!item) return;
  if (checked) item.addOnIds.add(addOnId);
  else item.addOnIds.delete(addOnId);
  renderCart();
}

function validateOrderRequest() {
  const location = locationFromForm();
  const schedule = selectedSchedule();
  if (!state.cart.size) return 'Add at least one service.';
  if (!location.address || !location.city || !location.state || !location.zip) return 'Complete the service address.';
  if (!schedule.requestedScheduleAtMs) return 'Choose a service date and time.';
  if (schedule.requestedScheduleAtMs <= Date.now()) return 'Choose a future service time.';
  return '';
}

async function submitOrderRequest() {
  const errorMessage = validateOrderRequest();
  const statusNode = document.getElementById('marketplaceOrderMessage');
  if (errorMessage) {
    if (statusNode) statusNode.textContent = errorMessage;
    notify('Order details needed', errorMessage, 'warning');
    return;
  }

  const profile = state.profile;
  const location = locationFromForm();
  const schedule = selectedSchedule();
  const company = selectedCompany();
  const lines = cartLines();
  const notes = String(document.getElementById('marketplaceOrderNotes')?.value || '').trim();
  const recurring = Boolean(document.getElementById('marketplaceRecurring')?.checked);
  const firstService = lines[0];
  const estimatedPriceCents = cartTotalCents();

  state.submitting = true;
  updateSubmitState();
  const button = document.getElementById('marketplaceSubmitOrder');
  if (button) button.textContent = 'Submitting order request…';

  try {
    const payload = {
      marketplaceRequestVersion: 2,
      requestType: 'marketplace_order_request',
      orderStatus: 'quote_requested',
      quoteStatus: 'requested',
      paymentStatus: 'not_started',
      subscriptionRequested: recurring,
      lineItems: lines,
      selectedServiceIds: lines.map((line) => line.serviceId),
      selectedServiceNames: lines.map((line) => line.serviceName),
      service: firstService?.serviceName || 'Marketplace service',
      serviceName: firstService?.serviceName || 'Marketplace service',
      serviceCategory: state.cart.values().next().value?.service?.category || 'general',
      estimatedDurationMinutes: totalDurationMinutes(),
      estimatedPriceCents,
      estimatedPrice: estimatedPriceCents / 100,
      subtotalCents: estimatedPriceCents,
      totalCents: estimatedPriceCents,
      currency: 'usd',
      requiresQuote: lines.some((line) => line.requiresQuote),
      propertyLabel: location.propertyLabel,
      propertyType: location.propertyType,
      address: location.address,
      serviceAddress: location.address,
      customerAddress: location.address,
      city: location.city,
      state: location.state,
      zip: location.zip,
      accessNotes: location.accessNotes,
      notes,
      requestedScheduleAtMs: schedule.requestedScheduleAtMs,
      requestedScheduleAt: schedule.requestedScheduleAt,
      scheduleDate: schedule.date,
      preferredTime: schedule.time,
      schedulingStatus: 'requested',
      capacityValidationStatus: schedule.capacityStatus,
      priority: 'normal',
      companyId: company?.id || cartCompanyId(),
      companyName: company ? companyName(company) : state.cart.values().next().value?.service?.companyName || 'Dispatch Review',
      customerUid: profile.uid,
      customerId: profile.uid,
      customerName: profile.displayName,
      name: profile.displayName,
      phone: profile.phone || '',
      customerPhone: profile.phone || '',
      email: profile.email || '',
      customerEmail: profile.email || '',
      createdBy: profile.uid,
      createdByUid: profile.uid,
      createdByName: profile.displayName,
      createdByRole: 'customer',
      customerSubmitted: true,
      leadSource: 'customer_portal',
      source: 'customer_portal',
      status: company || cartCompanyId() ? 'new' : 'dispatch_review',
      automationStatus: company || cartCompanyId() ? 'company_routed' : 'needs_dispatch_review',
      routingState: location.state,
      routingCity: location.city,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      searchText: [
        profile.displayName,
        profile.phone,
        profile.email,
        location.address,
        location.city,
        location.state,
        location.zip,
        ...lines.map((line) => line.serviceName),
        notes,
        company ? companyName(company) : 'dispatch review'
      ].join(' ').toLowerCase()
    };

    const requestRef = await addDoc(collection(db, 'leads'), payload);
    if (statusNode) statusNode.textContent = `Request ${requestRef.id} submitted. Your provider will confirm the quote and time.`;
    notify('Order request submitted', 'Your services, address, and preferred time were sent for provider confirmation.', 'success');

    state.cart.clear();
    state.selectedCompanyId = '';
    document.getElementById('marketplaceOrderingForm')?.reset();
    prefillProfileFields();
    setDateBounds();
    renderServices();
    renderCart();
    renderProviders();
  } catch (error) {
    console.error('Marketplace order request failed:', error);
    if (statusNode) statusNode.textContent = error.message || 'The order request could not be submitted.';
    notify('Order request failed', 'Check the required details, your connection, or account permissions.', 'error');
  } finally {
    state.submitting = false;
    if (button) button.textContent = 'Request quote and time';
    updateSubmitState();
  }
}

function requestStatusLabel(request = {}) {
  const status = normalize(request.orderStatus || request.quoteStatus || request.status || 'requested');
  return titleCase(status);
}

function renderRecentRequests(rows = []) {
  const root = document.getElementById('marketplaceRecentRequests');
  if (!root) return;
  root.innerHTML = rows.length
    ? rows.slice(0, 6).map((request) => {
        const schedule = request.requestedScheduleAtMs
          ? new Date(request.requestedScheduleAtMs).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
          : 'Time pending';
        return `
          <article class="marketplace-request-row">
            <div><strong>${escapeHtml(request.serviceName || request.service || 'Service request')}</strong><span>${escapeHtml(request.companyName || 'Dispatch review')} · ${escapeHtml(schedule)}</span></div>
            <span class="marketplace-request-status">${escapeHtml(requestStatusLabel(request))}</span>
          </article>
        `;
      }).join('')
    : '<div class="marketplace-empty">No Marketplace order requests yet.</div>';
}

function subscribeRecentRequests() {
  if (state.requestsUnsubscribe) state.requestsUnsubscribe();
  if (!state.profile.uid) return;

  const feed = query(collection(db, 'leads'), where('customerUid', '==', state.profile.uid));
  state.requestsUnsubscribe = onSnapshot(feed, (snap) => {
    const rows = snap.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => item.requestType === 'marketplace_order_request')
      .sort((left, right) => finiteNumber(right.createdAtMs) - finiteNumber(left.createdAtMs));
    renderRecentRequests(rows);
  }, (error) => {
    console.warn('Recent Marketplace requests unavailable:', error);
    renderRecentRequests([]);
  });
}

function setDateBounds() {
  const input = document.getElementById('marketplaceDate');
  if (!input) return;
  const tomorrow = new Date(Date.now() + (24 * 60 * 60 * 1000));
  const horizon = new Date(Date.now() + (DEFAULT_BOOKING_CONFIG.horizonDays * 24 * 60 * 60 * 1000));
  input.min = tomorrow.toISOString().slice(0, 10);
  input.max = horizon.toISOString().slice(0, 10);
}

function prefillProfileFields() {
  const phone = document.getElementById('marketplaceContactPhone');
  if (phone) phone.value = state.profile.phone || '';
}

function marketplaceHtml() {
  return `
    <section class="customer-marketplace-panel glass-card" id="customerMarketplacePanel">
      <div class="marketplace-panel-head">
        <div>
          <p class="customer-kicker">BOOK A SERVICE</p>
          <h2>Build your service order</h2>
          <p>Choose services, quantities, add-ons, property details, and a preferred appointment. The provider confirms the final quote and capacity.</p>
        </div>
        <div class="marketplace-cart-badge"><strong id="marketplaceCartCount">0</strong><span>services</span></div>
      </div>

      <div class="marketplace-order-layout">
        <section class="marketplace-catalog-section">
          <div class="marketplace-toolbar">
            <input id="marketplaceServiceSearch" type="search" placeholder="Search services" aria-label="Search services">
            <select id="marketplaceCategoryFilter" aria-label="Filter service category"><option value="">All categories</option></select>
          </div>
          <div id="marketplaceServiceGrid" class="marketplace-service-grid"><div class="marketplace-empty">Loading services…</div></div>
        </section>

        <aside class="marketplace-cart-panel">
          <div class="marketplace-cart-title"><div><p class="customer-kicker">YOUR ORDER</p><h3>Cart</h3></div><strong id="marketplaceCartTotal">$0.00</strong></div>
          <div id="marketplaceCartItems" class="marketplace-cart-items"><div class="marketplace-empty">Add a service to begin your order.</div></div>
        </aside>
      </div>

      <form id="marketplaceOrderingForm" class="marketplace-order-form" novalidate>
        <section class="marketplace-form-section">
          <div class="marketplace-section-title"><span>1</span><div><h3>Property and access</h3><p>Select a saved property or enter a new service address.</p></div></div>
          <div class="marketplace-form-grid">
            <label class="full"><span>Saved property</span><select id="marketplaceSavedProperty"><option value="">Enter a new service address</option></select></label>
            <label><span>Property label</span><input id="marketplacePropertyLabel" type="text" placeholder="Home, rental, office…"></label>
            <label><span>Property type</span><select id="marketplacePropertyType"><option value="residential">Residential</option><option value="business">Business</option><option value="multifamily">Multifamily</option><option value="other">Other</option></select></label>
            <label class="full"><span>Street address</span><input id="marketplaceAddress" type="text" autocomplete="street-address" required></label>
            <label><span>City</span><input id="marketplaceCity" type="text" autocomplete="address-level2" required></label>
            <label><span>State</span><input id="marketplaceState" type="text" maxlength="2" autocomplete="address-level1" placeholder="FL" required></label>
            <label><span>ZIP code</span><input id="marketplaceZip" type="text" autocomplete="postal-code" required></label>
            <label><span>Contact phone</span><input id="marketplaceContactPhone" type="tel" autocomplete="tel"></label>
            <label class="full"><span>Access instructions</span><textarea id="marketplaceAccessNotes" rows="3" placeholder="Gate code, parking, pets, entry instructions…"></textarea></label>
          </div>
        </section>

        <section class="marketplace-form-section">
          <div class="marketplace-section-title"><span>2</span><div><h3>Provider</h3><p>Choose an available company. Company-specific services automatically lock the order to that provider.</p></div></div>
          <div id="marketplaceProviderOptions" class="marketplace-provider-options"><div class="marketplace-empty">Enter your location to find providers.</div></div>
        </section>

        <section class="marketplace-form-section">
          <div class="marketplace-section-title"><span>3</span><div><h3>Preferred appointment</h3><p>Choose a date and time inside the provider's configured operating hours.</p></div></div>
          <div class="marketplace-form-grid">
            <label><span>Date</span><input id="marketplaceDate" type="date" required></label>
            <label><span>Time</span><select id="marketplaceTime" required><option value="">Select a time</option></select></label>
            <p id="marketplaceSlotMessage" class="marketplace-field-message full">Choose a date to see available times.</p>
          </div>
        </section>

        <section class="marketplace-form-section">
          <div class="marketplace-section-title"><span>4</span><div><h3>Order preferences</h3><p>Add final instructions and tell the provider whether recurring service interests you.</p></div></div>
          <div class="marketplace-form-grid">
            <label class="full"><span>Order notes</span><textarea id="marketplaceOrderNotes" rows="4" placeholder="Describe the work, condition, priorities, or anything the provider should know."></textarea></label>
            <label class="marketplace-check full"><input id="marketplaceRecurring" type="checkbox"><span>Show me recurring or subscription options for eligible services.</span></label>
          </div>
        </section>

        <div class="marketplace-submit-row">
          <div><strong>Estimated order total</strong><span>Final pricing and capacity are confirmed by the provider.</span></div>
          <button id="marketplaceSubmitOrder" type="submit" class="btn btn-theme-primary" disabled>Request quote and time</button>
        </div>
        <p id="marketplaceOrderMessage" class="marketplace-order-message" aria-live="polite"></p>
      </form>

      <section class="marketplace-recent-section">
        <div class="marketplace-section-title"><span>✓</span><div><h3>Recent order requests</h3><p>Track requests submitted through this Marketplace flow.</p></div></div>
        <div id="marketplaceRecentRequests" class="marketplace-recent-requests"><div class="marketplace-empty">Loading recent requests…</div></div>
      </section>
    </section>
  `;
}

function mountMarketplace() {
  const summary = document.querySelector('.customer-summary-grid');
  if (!summary || document.getElementById('customerMarketplacePanel')) return false;
  summary.insertAdjacentHTML('afterend', marketplaceHtml());
  return true;
}

function bindEvents() {
  const panel = document.getElementById('customerMarketplacePanel');
  if (!panel) return;

  document.getElementById('marketplaceServiceSearch')?.addEventListener('input', renderServices);
  document.getElementById('marketplaceCategoryFilter')?.addEventListener('change', renderServices);
  document.getElementById('marketplaceSavedProperty')?.addEventListener('change', (event) => applySavedProperty(event.target.value));
  document.getElementById('marketplaceDate')?.addEventListener('change', renderScheduleSlots);
  document.getElementById('marketplaceTime')?.addEventListener('change', updateSubmitState);
  document.getElementById('marketplaceOrderingForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    submitOrderRequest();
  });

  ['marketplaceAddress', 'marketplaceCity', 'marketplaceState', 'marketplaceZip'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', () => {
      renderProviders();
      updateSubmitState();
    });
  });

  panel.addEventListener('click', (event) => {
    const addButton = event.target.closest('[data-add-service]');
    if (addButton) addOrRemoveService(addButton.dataset.addService);

    const quantityButton = event.target.closest('[data-cart-quantity]');
    if (quantityButton) changeQuantity(quantityButton.dataset.serviceId, quantityButton.dataset.cartQuantity);
  });

  panel.addEventListener('change', (event) => {
    const addOn = event.target.closest('[data-cart-addon]');
    if (addOn) changeAddOn(addOn.dataset.serviceId, addOn.dataset.cartAddon, addOn.checked);

    if (event.target.name === 'marketplaceProvider') {
      state.selectedCompanyId = event.target.value;
      renderProviders();
      renderScheduleSlots();
    }
  });
}

async function init() {
  if (!auth.currentUser) return;
  if (!mountMarketplace()) return;

  state.profile = await hydrateFullProfile();
  await loadMarketplaceData();

  renderCategoryOptions();
  renderPropertyOptions();
  prefillProfileFields();
  setDateBounds();
  bindEvents();
  renderServices();
  renderCart();
  renderProviders();
  subscribeRecentRequests();
}

function cleanup() {
  if (state.requestsUnsubscribe) state.requestsUnsubscribe();
  state.requestsUnsubscribe = null;
}

window.addEventListener('pagehide', cleanup);
window.addEventListener('beforeunload', cleanup);
window.addEventListener('evara:session-ready', () => init().catch((error) => console.error('Customer Marketplace failed:', error)), { once: true });

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (auth.currentUser) init().catch((error) => console.error('Customer Marketplace failed:', error));
  }, { once: true });
} else if (auth.currentUser) {
  init().catch((error) => console.error('Customer Marketplace failed:', error));
}
