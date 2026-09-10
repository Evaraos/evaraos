export const HOME_DRAFT_SCHEMA_VERSION = 'evaraos.home-text-draft.v1';
export const HOME_DRAFT_PAGE_ID = 'home';
export const HOME_DRAFT_SOURCE_FINGERPRINT = 'home-live-text-v1';
export const HOME_DRAFT_PREVIEW_MARKER_KEY = 'evaraos-studio-home-draft-preview-v1';

export const HOME_TEXT_DRAFT_SLOTS = Object.freeze({
  'home.hero.kicker': Object.freeze({ id: 'home.hero.kicker', maxLength: 180, experienceControlled: true, linePolicy: 'single' }),
  'home.hero.title': Object.freeze({ id: 'home.hero.title', maxLength: 260, experienceControlled: true, linePolicy: 'single' }),
  'home.hero.subtitle': Object.freeze({ id: 'home.hero.subtitle', maxLength: 1200, experienceControlled: true, linePolicy: 'single' }),
  'home.platform.heading': Object.freeze({ id: 'home.platform.heading', maxLength: 180, experienceControlled: false, linePolicy: 'single' }),
  'home.platform.copy': Object.freeze({ id: 'home.platform.copy', maxLength: 1200, experienceControlled: false, linePolicy: 'single' })
});

export const HOME_TEXT_DRAFT_SLOT_IDS = Object.freeze(Object.keys(HOME_TEXT_DRAFT_SLOTS));

export function homeDraftSlot(editId) {
  return HOME_TEXT_DRAFT_SLOTS[String(editId || '')] || null;
}

export function normalizeHomeDraftText(editId, value) {
  const slot = homeDraftSlot(editId);
  if (!slot) return null;
  const source = String(value ?? '');
  const normalized = slot.linePolicy === 'single'
    ? source
      .replace(/[\r\n\u2028\u2029]+/g, ' ')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    : source;
  return Array.from(normalized).slice(0, slot.maxLength).join('');
}

export function isValidHomeDraftText(editId, value) {
  return typeof value === 'string' && normalizeHomeDraftText(editId, value) === value;
}

export function isEligibleHomeDraftSession(session) {
  const role = String(session?.role || '').trim().toLowerCase();
  return Boolean(
    session?.authenticated
    && session?.lifecycle === 'active'
    && String(session?.userId || '').trim()
    && (role === 'owner' || role === 'admin')
  );
}

export function isVerifiedStudioHomeDraftSession(session) {
  return isEligibleHomeDraftSession(session)
    && session?.source === 'verified-route-guard'
    && session?.mode === 'private';
}

export function isVerifiedPublicHomeDraftSession(session) {
  return isEligibleHomeDraftSession(session)
    && session?.source === 'verified-public-home'
    && session?.mode === 'public';
}

export function homeDraftSelector(editId) {
  return homeDraftSlot(editId) ? `[data-evara-edit-id="${editId}"]` : '';
}
