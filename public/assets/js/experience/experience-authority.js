import { getSavedUserProfile, getSavedUserRole, normalizeRole } from '../firebase.js';

function clean(value = '') {
  return String(value || '').trim().toLowerCase();
}

function activeProfile(profile = {}) {
  const status = clean(profile.status || 'active');
  const approval = clean(profile.approvalStatus || 'approved');
  return !['inactive', 'suspended', 'disabled', 'rejected'].includes(status)
    && !['rejected', 'denied', 'suspended'].includes(approval);
}

function permissionSet(profile = {}) {
  const result = new Set();
  [profile.permissions, profile.capabilities, profile.studioPermissions].forEach((value) => {
    if (Array.isArray(value)) value.forEach((item) => result.add(clean(item)));
    else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, enabled]) => {
        if (enabled === true) result.add(clean(key));
      });
    }
  });
  return result;
}

export function getExperiencePublisherProfile() {
  return getSavedUserProfile?.() || {};
}

export function canPublishExperience(profile = getExperiencePublisherProfile()) {
  if (!activeProfile(profile)) return false;
  const role = normalizeRole?.(profile.role || getSavedUserRole?.() || '') || '';
  if (role === 'owner' || role === 'platform_admin') return true;
  if (role !== 'admin') return false;
  const permissions = permissionSet(profile);
  return profile.studioPublisher === true
    || profile.publisherAuthority === true
    || permissions.has('studio.publish')
    || permissions.has('studio.publisher');
}

window.EvaraExperienceAuthority = Object.freeze({
  canPublish: canPublishExperience,
  getProfile: getExperiencePublisherProfile
});
