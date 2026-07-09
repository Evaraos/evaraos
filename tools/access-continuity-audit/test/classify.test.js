'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyAccount } = require('../lib/classify');
const { normalizeRole } = require('../lib/policy');

const companies = new Map([
  ['company-a', { id: 'company-a', name: 'Company A' }]
]);

function authUser(overrides = {}) {
  return {
    uid: 'user-1',
    email: 'user@example.com',
    disabled: false,
    customClaims: {},
    ...overrides
  };
}

function profile(overrides = {}) {
  return {
    uid: 'user-1',
    id: 'user-1',
    email: 'user@example.com',
    role: 'technician',
    status: 'active',
    approvalStatus: 'approved',
    companyId: 'company-a',
    platformAccess: false,
    ...overrides
  };
}

test('explicit active approved technician with matching staff profile is ready', () => {
  const result = classifyAccount({
    authUser: authUser(),
    profile: profile(),
    staffProfile: { role: 'technician', companyId: 'company-a' },
    companies
  });

  assert.equal(result.classification, 'ready');
  assert.equal(result.automaticMigrationEligible, true);
  assert.equal(result.currentAccess.backend, true);
});

test('missing status exposes browser/backend access mismatch', () => {
  const result = classifyAccount({
    authUser: authUser(),
    profile: profile({ status: undefined }),
    staffProfile: { role: 'technician', companyId: 'company-a' },
    companies
  });

  assert.equal(result.classification, 'security_risk');
  assert.equal(result.currentAccess.browser, true);
  assert.equal(result.currentAccess.backend, false);
  assert.ok(
    result.findings.some(
      (finding) => finding.code === 'CLIENT_BACKEND_ACCESS_MISMATCH'
    )
  );
});

test('legacy role is mapped without overwriting the detailed role', () => {
  const normalized = normalizeRole('lead_technician');
  assert.equal(normalized.detailedRole, 'lead_technician');
  assert.equal(normalized.canonicalRole, 'technician');
  assert.equal(normalized.isAlias, true);

  const result = classifyAccount({
    authUser: authUser(),
    profile: profile({ role: 'lead_technician' }),
    staffProfile: { role: 'lead_technician', companyId: 'company-a' },
    companies
  });

  assert.equal(result.classification, 'compatibility_mapping');
  assert.equal(result.automaticMigrationEligible, true);
});

test('unknown role requires manual review and is never auto eligible', () => {
  const result = classifyAccount({
    authUser: authUser(),
    profile: profile({ role: 'regional_wizard' }),
    companies
  });

  assert.equal(result.classification, 'manual_review');
  assert.equal(result.automaticMigrationEligible, false);
});

test('disabled auth with active profile is a security risk', () => {
  const result = classifyAccount({
    authUser: authUser({ disabled: true }),
    profile: profile(),
    staffProfile: { role: 'technician', companyId: 'company-a' },
    companies
  });

  assert.equal(result.classification, 'security_risk');
  assert.ok(
    result.findings.some(
      (finding) => finding.code === 'AUTH_DISABLED_PROFILE_ACTIVE'
    )
  );
});

test('claim mismatch blocks automatic migration', () => {
  const result = classifyAccount({
    authUser: authUser({
      customClaims: { role: 'manager', companyId: 'company-b' }
    }),
    profile: profile(),
    staffProfile: { role: 'technician', companyId: 'company-a' },
    companies
  });

  assert.equal(result.classification, 'claims_mismatch');
  assert.equal(result.automaticMigrationEligible, false);
  assert.ok(
    result.findings.some((finding) => finding.code === 'CLAIMS_ROLE_MISMATCH')
  );
  assert.ok(
    result.findings.some((finding) => finding.code === 'CLAIMS_COMPANY_MISMATCH')
  );
});

test('tenant role without company is not automatically migrated', () => {
  const result = classifyAccount({
    authUser: authUser(),
    profile: profile({ role: 'sales_rep', companyId: '' }),
    staffProfile: { role: 'sales_rep', companyId: '' },
    companies
  });

  assert.equal(result.classification, 'missing_metadata');
  assert.equal(result.automaticMigrationEligible, false);
});

test('owner without company requires scope review', () => {
  const result = classifyAccount({
    authUser: authUser(),
    profile: profile({ role: 'owner', companyId: '' }),
    companies
  });

  assert.equal(result.classification, 'manual_review');
  assert.ok(
    result.findings.some((finding) => finding.code === 'OWNER_SCOPE_AMBIGUOUS')
  );
});

test('approved application with inactive user is flagged', () => {
  const result = classifyAccount({
    authUser: authUser(),
    profile: profile({ status: 'pending', approvalStatus: 'pending' }),
    application: { status: 'approved', finalRole: 'technician' },
    companies
  });

  assert.equal(result.classification, 'security_risk');
  assert.ok(
    result.findings.some(
      (finding) => finding.code === 'APPROVED_APPLICATION_USER_NOT_ACTIVE'
    )
  );
});

test('platform_admin registry drift is a security risk', () => {
  const result = classifyAccount({
    authUser: authUser({
      customClaims: { role: 'platform_admin', platformAccess: true }
    }),
    profile: profile({
      role: 'platform_admin',
      companyId: '',
      platformAccess: true
    }),
    companies
  });

  assert.equal(result.classification, 'security_risk');
  assert.ok(
    result.findings.some(
      (finding) => finding.code === 'PLATFORM_ADMIN_CLIENT_BACKEND_GAP'
    )
  );
});

test('tenant owner is held for global authority review', () => {
  const result = classifyAccount({
    authUser: authUser(),
    profile: profile({ role: 'owner', companyId: 'company-a' }),
    companies
  });

  assert.equal(result.classification, 'manual_review');
  assert.equal(result.automaticMigrationEligible, false);
  assert.ok(
    result.findings.some(
      (finding) => finding.code === 'OWNER_GLOBAL_AUTHORITY_REVIEW'
    )
  );
});

test('canonical claim and detailed profile role are compatible', () => {
  const result = classifyAccount({
    authUser: authUser({
      customClaims: { role: 'technician', companyId: 'company-a' }
    }),
    profile: profile({ role: 'lead_technician' }),
    staffProfile: { role: 'lead_technician', companyId: 'company-a' },
    companies
  });

  assert.equal(result.classification, 'compatibility_mapping');
  assert.ok(
    result.findings.some(
      (finding) => finding.code === 'CLAIMS_ROLE_COMPATIBILITY'
    )
  );
  assert.ok(
    !result.findings.some(
      (finding) => finding.code === 'CLAIMS_ROLE_MISMATCH'
    )
  );
});
