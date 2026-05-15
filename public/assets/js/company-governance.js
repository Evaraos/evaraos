import {
  db,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from './firebase.js';

import {
  companyTypeToSplitModel,
  calculateSplit
} from './split-engine.js';

export const COMPANY_TYPES = Object.freeze({
  platform_vendor: Object.freeze({
    label: 'Platform Vendor',
    description: 'External company using Evaraos infrastructure for a platform fee.',
    defaultSplitModel: 'platform_vendor',
    relationshipType: 'software_platform'
  }),
  evara_expansion_partner: Object.freeze({
    label: 'Evara Expansion Partner',
    description: 'Operator developed through the Evara management and expansion program.',
    defaultSplitModel: 'evara_expansion_partner',
    relationshipType: 'managed_growth_partner'
  }),
  internal_subsidiary: Object.freeze({
    label: 'Internal Subsidiary',
    description: 'Company or category directly controlled by Evaraos.',
    defaultSplitModel: 'internal_subsidiary',
    relationshipType: 'internal_company'
  })
});

function normalizeCompanyType(companyType = '') {
  const safeType = String(companyType || '').trim().toLowerCase();
  return COMPANY_TYPES[safeType] ? safeType : 'platform_vendor';
}

export function getCompanyTypes() {
  return COMPANY_TYPES;
}

export function getCompanyTypeConfig(companyType = 'platform_vendor') {
  return COMPANY_TYPES[normalizeCompanyType(companyType)];
}

export function buildCompanyGovernanceConfig(company = {}, overrides = {}) {
  const companyType = normalizeCompanyType(overrides.companyType || company.companyType || company.type);
  const typeConfig = getCompanyTypeConfig(companyType);
  const splitModel = overrides.splitModel || company.splitModel || typeConfig.defaultSplitModel || companyTypeToSplitModel(companyType);

  return {
    companyId: company.id || company.companyId || overrides.companyId || '',
    companyName: company.name || company.companyName || overrides.companyName || '',
    companyType,
    companyTypeLabel: typeConfig.label,
    relationshipType: typeConfig.relationshipType,
    splitModel,
    active: overrides.active ?? company.active ?? true,
    allowCustomSplits: Boolean(overrides.allowCustomSplits ?? company.allowCustomSplits ?? false),
    territoryId: overrides.territoryId || company.territoryId || '',
    regionId: overrides.regionId || company.regionId || '',
    operatorUid: overrides.operatorUid || company.operatorUid || '',
    updatedAt: serverTimestamp()
  };
}

export async function getCompanyGovernance(companyId) {
  if (!companyId) return null;

  const snap = await getDoc(doc(db, 'company_governance', companyId));
  if (!snap.exists()) return null;

  return {
    id: snap.id,
    ...snap.data()
  };
}

export async function saveCompanyGovernance(companyId, config = {}) {
  if (!companyId) throw new Error('Missing companyId for governance save.');

  const payload = buildCompanyGovernanceConfig({ companyId }, config);

  await setDoc(doc(db, 'company_governance', companyId), {
    ...payload,
    updatedAt: serverTimestamp()
  }, { merge: true });

  return payload;
}

export async function calculateCompanySplit(company = {}, amount = 0, overrides = {}) {
  const companyId = company.id || company.companyId || overrides.companyId || '';
  const governance = companyId ? await getCompanyGovernance(companyId) : null;
  const config = governance || buildCompanyGovernanceConfig(company, overrides);

  return calculateSplit(amount, {
    splitModel: config.splitModel,
    platformPercent: overrides.platformPercent ?? config.platformPercent,
    vendorPercent: overrides.vendorPercent ?? config.vendorPercent,
    operatorPercent: overrides.operatorPercent ?? config.operatorPercent
  });
}

window.EvaraCompanyGovernance = {
  COMPANY_TYPES,
  getCompanyTypes,
  getCompanyTypeConfig,
  buildCompanyGovernanceConfig,
  getCompanyGovernance,
  saveCompanyGovernance,
  calculateCompanySplit
};
