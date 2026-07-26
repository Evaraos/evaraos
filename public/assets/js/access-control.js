export {
  CANONICAL_ROLES,
  PUBLIC_PAGES,
  PAGE_POLICY,
  FEATURE_POLICY,
  normalizeAccessRole,
  isKnownRole,
  isPlatformAdmin,
  isPlatformOwner,
  isTenantExecutive,
  isTenantLeadership,
  isFieldRole,
  canUseFeature,
  canAccessPageName,
  defaultRouteForRole,
  permissionsForRole,
  pagesForRole,
  accessDecision
} from './access-control-v2.js?v=access-control-v2';
