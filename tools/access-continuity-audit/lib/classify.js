'use strict';

const {
  STAFF_DETAIL_ROLES,
  TENANT_ROLES,
  backendWouldTreatAsActive,
  browserWouldTreatAsActive,
  normalizeRole,
  normalizeValue
} = require('./policy');

const SEVERITY = Object.freeze({
  ready: 0,
  compatibility_mapping: 1,
  missing_metadata: 2,
  claims_mismatch: 3,
  manual_review: 4,
  security_risk: 5
});

function sameString(left, right) {
  return normalizeValue(left) === normalizeValue(right);
}

function addFinding(findings, code, classification, message, details = {}) {
  findings.push({ code, classification, message, details });
}

function highestClassification(findings) {
  return findings.reduce((current, finding) => (
    SEVERITY[finding.classification] > SEVERITY[current]
      ? finding.classification
      : current
  ), 'ready');
}

function recommendedAction(classification, findings) {
  const codes = new Set(findings.map((finding) => finding.code));

  if (classification === 'ready') return 'No account change recommended.';
  if (classification === 'compatibility_mapping') {
    return 'Preserve the stored detailed role and apply only the reviewed canonical compatibility mapping.';
  }
  if (classification === 'missing_metadata') {
    return 'Complete missing metadata after human verification; do not infer privileged access.';
  }
  if (classification === 'claims_mismatch') {
    return 'Review Firestore and Authentication claims side by side before any claim synchronization.';
  }
  if (classification === 'security_risk') {
    return 'Freeze automatic migration for this account and require security-owner review.';
  }
  if (codes.has('OWNER_SCOPE_AMBIGUOUS')) {
    return 'Confirm whether this owner is platform-wide or tenant-scoped before migration.';
  }
  return 'Require manual account review before any migration or deployment.';
}

function classifyAccount(input = {}) {
  const authUser = input.authUser || null;
  const profile = input.profile || null;
  const staffProfile = input.staffProfile || null;
  const application = input.application || null;
  const companies = input.companies || new Map();
  const findings = [];

  const uid = authUser?.uid || profile?.uid || profile?.id || input.uid || '';

  if (authUser && !profile) {
    addFinding(
      findings,
      'AUTH_WITHOUT_PROFILE',
      'manual_review',
      'Firebase Authentication account has no matching user profile.'
    );
  }

  if (profile && !authUser) {
    addFinding(
      findings,
      'PROFILE_WITHOUT_AUTH',
      'manual_review',
      'User profile has no matching Firebase Authentication account.'
    );
  }

  if (!profile) {
    const classification = highestClassification(findings);
    return {
      uid,
      classification,
      automaticMigrationEligible: false,
      currentAccess: {
        browser: false,
        backend: false,
        canonicalRole: '',
        detailedRole: ''
      },
      findings,
      recommendedAction: recommendedAction(classification, findings)
    };
  }

  const role = normalizeRole(profile.role);
  const status = normalizeValue(profile.status);
  const approvalStatus = normalizeValue(profile.approvalStatus);
  const companyId = String(profile.companyId || '').trim();
  const platformAccess = profile.platformAccess === true;
  const browserAccess = browserWouldTreatAsActive(profile);
  const backendAccess = backendWouldTreatAsActive(profile);

  if (!role.detailedRole) {
    addFinding(findings, 'MISSING_ROLE', 'missing_metadata', 'User profile is missing a role.');
  } else if (!role.known) {
    addFinding(
      findings,
      'UNKNOWN_ROLE',
      'manual_review',
      'Stored role is not recognized by the canonical role registry.',
      { role: role.detailedRole }
    );
  } else if (role.isAlias) {
    addFinding(
      findings,
      'LEGACY_ROLE_ALIAS',
      'compatibility_mapping',
      'Stored detailed role requires a reviewed canonical compatibility mapping.',
      {
        detailedRole: role.detailedRole,
        canonicalRole: role.canonicalRole
      }
    );
  }

  if (!status) {
    addFinding(
      findings,
      'MISSING_STATUS',
      'missing_metadata',
      'User profile is missing an explicit account status.'
    );
  }

  if (!approvalStatus) {
    addFinding(
      findings,
      'MISSING_APPROVAL_STATUS',
      'missing_metadata',
      'User profile is missing an explicit approval status.'
    );
  }

  if (browserAccess !== backendAccess) {
    addFinding(
      findings,
      'CLIENT_BACKEND_ACCESS_MISMATCH',
      'security_risk',
      'The browser and backend would make different access decisions for this account.',
      {
        browserAccess,
        backendAccess,
        status: status || null,
        approvalStatus: approvalStatus || null
      }
    );
  }

  if (authUser?.disabled && backendAccess) {
    addFinding(
      findings,
      'AUTH_DISABLED_PROFILE_ACTIVE',
      'security_risk',
      'Authentication is disabled while the profile appears active and approved.'
    );
  }

  if (role.detailedRole === 'platform_admin') {
    addFinding(
      findings,
      'PLATFORM_ADMIN_CLIENT_BACKEND_GAP',
      'security_risk',
      'The stored platform_admin role is not consistently recognized by the current client and backend registries.'
    );
  }

  if (
    role.canonicalRole === 'platform_admin'
    && !platformAccess
    && role.detailedRole !== 'super_admin'
  ) {
    addFinding(
      findings,
      'PLATFORM_ACCESS_FLAG_MISSING',
      'security_risk',
      'Platform administrator role lacks explicit platformAccess approval.'
    );
  }

  if (role.detailedRole === 'owner' && companyId) {
    addFinding(
      findings,
      'OWNER_GLOBAL_AUTHORITY_REVIEW',
      'manual_review',
      'Current backend rules treat owner as platform-wide; confirm whether this account should instead be tenant-scoped.',
      { companyId }
    );
  }

  if (role.detailedRole === 'owner' && !companyId) {
    addFinding(
      findings,
      'OWNER_SCOPE_AMBIGUOUS',
      'manual_review',
      'Owner account has no company assignment, so platform versus tenant scope is ambiguous.'
    );
  }

  if (
    TENANT_ROLES.has(role.canonicalRole)
    && role.canonicalRole !== 'customer'
    && !companyId
  ) {
    addFinding(
      findings,
      'TENANT_ROLE_WITHOUT_COMPANY',
      'missing_metadata',
      'Tenant-scoped role has no company assignment.',
      { canonicalRole: role.canonicalRole }
    );
  }

  if (companyId && companies.size && !companies.has(companyId)) {
    addFinding(
      findings,
      'UNKNOWN_COMPANY',
      'manual_review',
      'Assigned company does not exist in the company registry.',
      { companyId }
    );
  }

  const claims = authUser?.customClaims || {};
  if (claims.role && !sameString(claims.role, profile.role)) {
    const claimRole = normalizeRole(claims.role);
    if (
      claimRole.known
      && role.known
      && claimRole.canonicalRole === role.canonicalRole
    ) {
      addFinding(
        findings,
        'CLAIMS_ROLE_COMPATIBILITY',
        'compatibility_mapping',
        'Authentication and profile roles differ in detail but resolve to the same canonical access role.',
        {
          claimRole: claims.role,
          profileRole: profile.role,
          canonicalRole: role.canonicalRole
        }
      );
    } else {
      addFinding(
        findings,
        'CLAIMS_ROLE_MISMATCH',
        'claims_mismatch',
        'Authentication role claim disagrees with the user profile.',
        {
          claimRole: claims.role,
          profileRole: profile.role
        }
      );
    }
  }

  if (claims.companyId && String(claims.companyId) !== companyId) {
    addFinding(
      findings,
      'CLAIMS_COMPANY_MISMATCH',
      'claims_mismatch',
      'Authentication company claim disagrees with the user profile.',
      {
        claimCompanyId: claims.companyId,
        profileCompanyId: companyId
      }
    );
  }

  if (
    typeof claims.platformAccess === 'boolean'
    && claims.platformAccess !== platformAccess
  ) {
    addFinding(
      findings,
      'CLAIMS_PLATFORM_ACCESS_MISMATCH',
      'claims_mismatch',
      'Authentication platformAccess claim disagrees with the user profile.',
      {
        claimPlatformAccess: claims.platformAccess,
        profilePlatformAccess: platformAccess
      }
    );
  }

  if (claims.accountStatus && !sameString(claims.accountStatus, profile.status)) {
    addFinding(
      findings,
      'CLAIMS_STATUS_MISMATCH',
      'claims_mismatch',
      'Authentication accountStatus claim disagrees with the user profile.',
      {
        claimStatus: claims.accountStatus,
        profileStatus: profile.status
      }
    );
  }

  if (
    claims.approvalStatus
    && !sameString(claims.approvalStatus, profile.approvalStatus)
  ) {
    addFinding(
      findings,
      'CLAIMS_APPROVAL_MISMATCH',
      'claims_mismatch',
      'Authentication approvalStatus claim disagrees with the user profile.',
      {
        claimApprovalStatus: claims.approvalStatus,
        profileApprovalStatus: profile.approvalStatus
      }
    );
  }

  if (STAFF_DETAIL_ROLES.has(role.detailedRole) && backendAccess && !staffProfile) {
    addFinding(
      findings,
      'MISSING_STAFF_PROFILE',
      'manual_review',
      'Active staff account has no matching staff profile.'
    );
  }

  if (staffProfile) {
    if (staffProfile.role && !sameString(staffProfile.role, profile.role)) {
      addFinding(
        findings,
        'STAFF_PROFILE_ROLE_MISMATCH',
        'manual_review',
        'Staff profile role disagrees with the user profile.',
        {
          userRole: profile.role,
          staffRole: staffProfile.role
        }
      );
    }
    if (staffProfile.companyId && String(staffProfile.companyId) !== companyId) {
      addFinding(
        findings,
        'STAFF_PROFILE_COMPANY_MISMATCH',
        'manual_review',
        'Staff profile company disagrees with the user profile.',
        {
          userCompanyId: companyId,
          staffCompanyId: staffProfile.companyId
        }
      );
    }
  }

  if (application) {
    const applicationStatus = normalizeValue(application.status);
    if (applicationStatus === 'approved' && !backendAccess) {
      addFinding(
        findings,
        'APPROVED_APPLICATION_USER_NOT_ACTIVE',
        'manual_review',
        'Application is approved but the user profile is not active and approved.'
      );
    }
    if (application.finalRole && !sameString(application.finalRole, profile.role)) {
      addFinding(
        findings,
        'APPLICATION_ROLE_MISMATCH',
        'manual_review',
        'Approved application role disagrees with the user profile.',
        {
          applicationRole: application.finalRole,
          userRole: profile.role
        }
      );
    }
  }

  if (
    authUser?.email
    && profile.email
    && !sameString(authUser.email, profile.email)
  ) {
    addFinding(
      findings,
      'EMAIL_MISMATCH',
      'manual_review',
      'Authentication email disagrees with the user profile email.'
    );
  }

  const classification = highestClassification(findings);
  const automaticMigrationEligible = [
    'ready',
    'compatibility_mapping'
  ].includes(classification)
    && backendAccess
    && role.known
    && !authUser?.disabled;

  return {
    uid,
    classification,
    automaticMigrationEligible,
    currentAccess: {
      browser: browserAccess,
      backend: backendAccess,
      detailedRole: role.detailedRole,
      canonicalRole: role.canonicalRole,
      companyId,
      platformAccess
    },
    findings,
    recommendedAction: recommendedAction(classification, findings)
  };
}

module.exports = {
  SEVERITY,
  classifyAccount,
  highestClassification
};
