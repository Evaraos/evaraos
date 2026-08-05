import { defaultRouteForRole, normalizeAccessRole } from './access-control.js';

export const ACCOUNT_STATUS_ROUTE = '/account-status.html';

export const ACCOUNT_LIFECYCLE_STATES = Object.freeze({
  ACTIVE: 'active',
  PENDING: 'pending',
  NEEDS_MORE_INFO: 'needs_more_info',
  SUSPENDED: 'suspended',
  DISABLED: 'disabled',
  REJECTED: 'rejected',
  MISSING_PROFILE: 'missing_profile',
  VERIFICATION_REQUIRED: 'verification_required'
});

const ACTIVE_STATUSES = new Set(['active', 'approved']);
const PENDING_VALUES = new Set(['pending', 'submitted', 'under_review', 'pending_review', 'reviewing']);
const MORE_INFO_VALUES = new Set(['needs_more_info', 'more_info_required']);
const DISABLED_VALUES = new Set(['disabled', 'inactive', 'archived', 'deleted']);
const REJECTED_VALUES = new Set(['rejected', 'denied']);

export function normalizeLifecycleValue(value = '') {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function resolveAccountLifecycle(profile = null) {
  const hasProfile = Boolean(
    profile
    && typeof profile === 'object'
    && String(profile.uid || profile.id || '').trim()
  );

  const role = normalizeAccessRole(profile?.role || '');
  const status = normalizeLifecycleValue(profile?.status || '');
  const approvalStatus = normalizeLifecycleValue(profile?.approvalStatus || '');

  let state = ACCOUNT_LIFECYCLE_STATES.VERIFICATION_REQUIRED;

  if (!hasProfile) {
    state = ACCOUNT_LIFECYCLE_STATES.MISSING_PROFILE;
  } else if (REJECTED_VALUES.has(status) || REJECTED_VALUES.has(approvalStatus)) {
    state = ACCOUNT_LIFECYCLE_STATES.REJECTED;
  } else if (status === ACCOUNT_LIFECYCLE_STATES.SUSPENDED) {
    state = ACCOUNT_LIFECYCLE_STATES.SUSPENDED;
  } else if (DISABLED_VALUES.has(status)) {
    state = ACCOUNT_LIFECYCLE_STATES.DISABLED;
  } else if (ACTIVE_STATUSES.has(status) && approvalStatus === 'approved' && role) {
    state = ACCOUNT_LIFECYCLE_STATES.ACTIVE;
  } else if (MORE_INFO_VALUES.has(status) || MORE_INFO_VALUES.has(approvalStatus)) {
    state = ACCOUNT_LIFECYCLE_STATES.NEEDS_MORE_INFO;
  } else if (PENDING_VALUES.has(status) || PENDING_VALUES.has(approvalStatus)) {
    state = ACCOUNT_LIFECYCLE_STATES.PENDING;
  }

  return Object.freeze({
    state,
    active: state === ACCOUNT_LIFECYCLE_STATES.ACTIVE,
    role,
    status,
    approvalStatus,
    hasProfile
  });
}

export function routeForAccountLifecycle(profileOrDecision = null) {
  const decision = profileOrDecision?.state
    ? profileOrDecision
    : resolveAccountLifecycle(profileOrDecision);

  if (decision.active && decision.role) {
    return defaultRouteForRole(decision.role);
  }

  return `${ACCOUNT_STATUS_ROUTE}?state=${encodeURIComponent(
    decision.state || ACCOUNT_LIFECYCLE_STATES.VERIFICATION_REQUIRED
  )}`;
}

export function accountLifecycleCopy(state = '') {
  const normalized = normalizeLifecycleValue(state);
  const copy = {
    [ACCOUNT_LIFECYCLE_STATES.PENDING]: {
      eyebrow: 'ACCOUNT REVIEW',
      title: 'Your account is pending approval.',
      body: 'Your profile was created successfully, but application access will remain locked until an authorized reviewer approves it.'
    },
    [ACCOUNT_LIFECYCLE_STATES.NEEDS_MORE_INFO]: {
      eyebrow: 'ACTION REQUIRED',
      title: 'More information is required.',
      body: 'An authorized reviewer needs additional information before this account can be approved. Review your application details or contact your Evaraos administrator.'
    },
    [ACCOUNT_LIFECYCLE_STATES.SUSPENDED]: {
      eyebrow: 'ACCESS SUSPENDED',
      title: 'This account is suspended.',
      body: 'Application access has been paused. Contact an authorized Evaraos administrator before attempting to continue.'
    },
    [ACCOUNT_LIFECYCLE_STATES.DISABLED]: {
      eyebrow: 'ACCESS DISABLED',
      title: 'This account is disabled.',
      body: 'Application access is not available for this account. Contact an authorized Evaraos administrator for assistance.'
    },
    [ACCOUNT_LIFECYCLE_STATES.REJECTED]: {
      eyebrow: 'REQUEST NOT APPROVED',
      title: 'This account request was not approved.',
      body: 'The submitted account or staff request was rejected. Contact an authorized Evaraos administrator if you believe this status is incorrect.'
    },
    [ACCOUNT_LIFECYCLE_STATES.MISSING_PROFILE]: {
      eyebrow: 'PROFILE VERIFICATION',
      title: 'Your account profile could not be verified.',
      body: 'Authentication succeeded, but the required Evaraos profile record is missing. Sign out and contact an authorized administrator before continuing.'
    },
    [ACCOUNT_LIFECYCLE_STATES.VERIFICATION_REQUIRED]: {
      eyebrow: 'VERIFICATION REQUIRED',
      title: 'Your account is not ready for application access.',
      body: 'Required role or approval information is incomplete. Application access will remain locked until the account record is corrected.'
    }
  };

  return Object.freeze(copy[normalized] || copy[ACCOUNT_LIFECYCLE_STATES.VERIFICATION_REQUIRED]);
}
