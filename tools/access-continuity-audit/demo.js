#!/usr/bin/env node
'use strict';

const { classifyAccount } = require('./lib/classify');

const companies = new Map([
  ['demo-company', { id: 'demo-company', name: 'Synthetic Demo Company' }]
]);

function auth(uid, overrides = {}) {
  return {
    uid,
    email: `${uid}@example.invalid`,
    disabled: false,
    customClaims: {},
    ...overrides
  };
}

function profile(uid, overrides = {}) {
  return {
    uid,
    id: uid,
    email: `${uid}@example.invalid`,
    role: 'technician',
    status: 'active',
    approvalStatus: 'approved',
    companyId: 'demo-company',
    platformAccess: false,
    ...overrides
  };
}

const scenarios = [
  {
    name: 'Ready technician',
    input: {
      authUser: auth('demo-ready'),
      profile: profile('demo-ready'),
      staffProfile: { role: 'technician', companyId: 'demo-company' }
    }
  },
  {
    name: 'Legacy lead technician compatibility',
    input: {
      authUser: auth('demo-legacy', {
        customClaims: { role: 'technician', companyId: 'demo-company' }
      }),
      profile: profile('demo-legacy', { role: 'lead_technician' }),
      staffProfile: { role: 'lead_technician', companyId: 'demo-company' }
    }
  },
  {
    name: 'Missing status partial-login risk',
    input: {
      authUser: auth('demo-missing-status'),
      profile: profile('demo-missing-status', { status: undefined }),
      staffProfile: { role: 'technician', companyId: 'demo-company' }
    }
  },
  {
    name: 'Claims mismatch',
    input: {
      authUser: auth('demo-claims', {
        customClaims: { role: 'manager', companyId: 'other-company' }
      }),
      profile: profile('demo-claims'),
      staffProfile: { role: 'technician', companyId: 'demo-company' }
    }
  },
  {
    name: 'Tenant role without company',
    input: {
      authUser: auth('demo-no-company'),
      profile: profile('demo-no-company', { role: 'sales_rep', companyId: '' }),
      staffProfile: { role: 'sales_rep', companyId: '' }
    }
  },
  {
    name: 'Ambiguous owner scope',
    input: {
      authUser: auth('demo-owner'),
      profile: profile('demo-owner', { role: 'owner', companyId: '' })
    }
  },
  {
    name: 'Platform administrator registry drift',
    input: {
      authUser: auth('demo-platform', {
        customClaims: { role: 'platform_admin', platformAccess: true }
      }),
      profile: profile('demo-platform', {
        role: 'platform_admin',
        companyId: '',
        platformAccess: true
      })
    }
  },
  {
    name: 'Disabled authentication with active profile',
    input: {
      authUser: auth('demo-disabled', { disabled: true }),
      profile: profile('demo-disabled'),
      staffProfile: { role: 'technician', companyId: 'demo-company' }
    }
  }
];

const results = scenarios.map((scenario) => {
  const result = classifyAccount({ ...scenario.input, companies });
  return {
    scenario: scenario.name,
    classification: result.classification,
    automaticMigrationEligible: result.automaticMigrationEligible,
    browserAccess: result.currentAccess.browser,
    backendAccess: result.currentAccess.backend,
    detailedRole: result.currentAccess.detailedRole,
    canonicalRole: result.currentAccess.canonicalRole,
    findings: result.findings.map((finding) => finding.code),
    recommendedAction: result.recommendedAction
  };
});

const classificationCounts = results.reduce((counts, result) => {
  counts[result.classification] = (counts[result.classification] || 0) + 1;
  return counts;
}, {});

console.log(JSON.stringify({
  demo: 'EvaraOS access continuity classification engine',
  syntheticOnly: true,
  productionDataRead: false,
  writesPerformed: 0,
  scenarioCount: results.length,
  classificationCounts,
  results
}, null, 2));
