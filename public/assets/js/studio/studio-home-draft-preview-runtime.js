import {
  HOME_DRAFT_PAGE_ID,
  HOME_DRAFT_PREVIEW_MARKER_KEY,
  HOME_DRAFT_SCHEMA_VERSION,
  HOME_DRAFT_SOURCE_FINGERPRINT,
  HOME_TEXT_DRAFT_SLOT_IDS,
  HOME_TEXT_DRAFT_SLOTS,
  homeDraftSelector,
  isVerifiedPublicHomeDraftSession
} from './studio-home-draft-contract.js';
import { loadHomeDraft, validateHomeDraft } from './studio-home-draft-store.js';

const params = new URLSearchParams(window.location.search);
const isStudioIframe = params.get('studioPreview') === 'edit';
const baseline = new Map();
let overlayActive = false;
let evaluationSequence = 0;

function readMarker() {
  try {
    const marker = JSON.parse(sessionStorage.getItem(HOME_DRAFT_PREVIEW_MARKER_KEY) || 'null');
    if (!marker || typeof marker !== 'object'
      || marker.schemaVersion !== HOME_DRAFT_SCHEMA_VERSION
      || marker.sourceFingerprint !== HOME_DRAFT_SOURCE_FINGERPRINT
      || marker.pageId !== HOME_DRAFT_PAGE_ID
      || typeof marker.ownerUid !== 'string' || !marker.ownerUid.trim()
      || typeof marker.draftId !== 'string' || !marker.draftId.trim()) return null;
    return marker;
  } catch {
    return null;
  }
}

function clearMarker() {
  try { sessionStorage.removeItem(HOME_DRAFT_PREVIEW_MARKER_KEY); } catch {}
}

function slotElement(editId) {
  const selector = homeDraftSelector(editId);
  return selector ? document.querySelector(selector) : null;
}

function captureBaseline({ experienceOnly = false, force = false } = {}) {
  for (const editId of HOME_TEXT_DRAFT_SLOT_IDS) {
    const slot = HOME_TEXT_DRAFT_SLOTS[editId];
    if (experienceOnly && !slot.experienceControlled) continue;
    if (!force && baseline.has(editId)) continue;
    const element = slotElement(editId);
    if (element) baseline.set(editId, element.textContent || '');
  }
}

function restoreCurrentHome() {
  for (const editId of HOME_TEXT_DRAFT_SLOT_IDS) {
    const element = slotElement(editId);
    if (element && baseline.has(editId)) element.textContent = baseline.get(editId);
  }
  overlayActive = false;
}

function applyDraft(record, refreshExperienceBaseline = false) {
  captureBaseline({ force: refreshExperienceBaseline, experienceOnly: true });
  captureBaseline();
  for (const editId of HOME_TEXT_DRAFT_SLOT_IDS) {
    const value = record.slots[editId]?.value;
    const element = slotElement(editId);
    if (element && typeof value === 'string') element.textContent = value;
  }
  overlayActive = true;
}

async function evaluatePreview({ experienceApplied = false } = {}) {
  const sequence = ++evaluationSequence;
  const marker = readMarker();
  if (!marker) {
    if (overlayActive) restoreCurrentHome();
    return;
  }

  const session = window.EvaraRouteSession;
  if (!session) return;
  if (!isVerifiedPublicHomeDraftSession(session)) {
    clearMarker();
    if (overlayActive) restoreCurrentHome();
    return;
  }
  if (marker.ownerUid !== session.userId) {
    clearMarker();
    if (overlayActive) restoreCurrentHome();
    return;
  }

  try {
    const record = await loadHomeDraft(session.userId);
    if (sequence !== evaluationSequence) return;
    if (!record || !validateHomeDraft(record, session.userId) || record.draftId !== marker.draftId) {
      clearMarker();
      if (overlayActive) restoreCurrentHome();
      return;
    }
    applyDraft(record, experienceApplied);
  } catch {
    clearMarker();
    if (overlayActive) restoreCurrentHome();
  }
}

if (!isStudioIframe) {
  window.addEventListener('evara:session-ready', () => evaluatePreview());
  window.addEventListener('evara:experience-applied', () => evaluatePreview({ experienceApplied: true }));
  window.addEventListener('pageshow', () => evaluatePreview());
  evaluatePreview();
}
