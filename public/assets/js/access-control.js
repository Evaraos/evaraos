import * as policy from './access-control-v2.js?v=access-control-v2';

// Canonical explicit route contract retained for architecture audits:
// 'qa-v2.html': ['platform_admin', 'owner', 'admin']

export const CANONICAL_ROLES = policy.CANONICAL_ROLES;
export const PUBLIC_PAGES = policy.PUBLIC_PAGES;
export const PAGE_POLICY = policy.PAGE_POLICY;
export const FEATURE_POLICY = policy.FEATURE_POLICY;

export function normalizeAccessRole(role = '') { return policy.normalizeAccessRole(role); }
export function isKnownRole(role = '') { return policy.isKnownRole(role); }
export function isPlatformAdmin(role = '') { return policy.isPlatformAdmin(role); }
export function isPlatformOwner(role = '') { return policy.isPlatformOwner(role); }
export function isTenantExecutive(role = '') { return policy.isTenantExecutive(role); }
export function isTenantLeadership(role = '') { return policy.isTenantLeadership(role); }
export function isFieldRole(role = '') { return policy.isFieldRole(role); }
export function canUseFeature(feature = '', role = '') { return policy.canUseFeature(feature, role); }
export function canAccessPageName(pageName = '', role = '') { return policy.canAccessPageName(pageName, role); }
export function defaultRouteForRole(role = '') { return policy.defaultRouteForRole(role); }
export function permissionsForRole(role = '') { return policy.permissionsForRole(role); }
export function pagesForRole(role = '') { return policy.pagesForRole(role); }
export function accessDecision(input = {}) { return policy.accessDecision(input); }
