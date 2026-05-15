import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
  getSavedUserProfile
} from './firebase.js';

import {
  getCompanyTypes,
  buildCompanyGovernanceConfig
} from './company-governance.js';

const root = document.getElementById('governanceRoot');
const form = document.getElementById('governanceForm');
const companySelect = document.getElementById('governanceCompany');
const companyTypeSelect = document.getElementById('governanceCompanyType');
const operatorInput = document.getElementById('governanceOperatorUid');
const territoryInput = document.getElementById('governanceTerritoryId');
const regionInput = document.getElementById('governanceRegionId');
const saveButton = document.getElementById('governanceSave');
const statusNode = document.getElementById('governanceStatus');

let companies = [];
let governanceRows = [];

function clean(value = '') {
  return String(value || '').replace(/[<>]/g, '');
}

function status(message = '') {
  if (statusNode) statusNode.textContent = message;
}

function ensureCompanyFallbacks() {
  if (companies.length) return;

  companies = [
    { id: 'evaraos', companyName: 'Evaraos Inc' },
    { id: 'supreme-true-clean', companyName: 'Supreme True Clean' },
    { id: 'oneofone-cleaning', companyName: 'OneofOne Cleaning' }
  ];
}

function renderCompanyOptions() {
  if (!companySelect) return;
  ensureCompanyFallbacks();

  companySelect.innerHTML = companies.map((company) => {
    return '<option value="' + clean(company.id) + '">' + clean(company.companyName || company.name || company.id) + '</option>';
  }).join('');
}

function renderCompanyTypeOptions() {
  if (!companyTypeSelect) return;

  const types = getCompanyTypes();
  companyTypeSelect.innerHTML = Object.entries(types).map(([key, config]) => {
    return '<option value="' + clean(key) + '">' + clean(config.label) + '</option>';
  }).join('');
}

function selectedCompany() {
  const companyId = companySelect?.value || '';
  return companies.find((company) => company.id === companyId || company.companyId === companyId) || {
    id: companyId,
    companyName: companyId
  };
}

function renderRows() {
  if (!root) return;

  if (!governanceRows.length) {
    root.innerHTML = '<div class="item muted">No governance records yet. Save a company governance profile to activate this layer.</div>';
    return;
  }

  root.innerHTML = governanceRows.map((row) => {
    return '<article class="item"><h3>' + clean(row.companyName || row.companyId || 'Company') + '</h3><p class="muted">' + clean(row.companyTypeLabel || row.companyType || 'Platform Vendor') + '</p><p class="muted">Split: ' + clean(row.splitModel || 'platform_vendor') + '</p><div class="row"><span class="pill">' + clean(row.relationshipType || 'software_platform') + '</span><span class="pill">' + clean(row.active === false ? 'inactive' : 'active') + '</span></div></article>';
  }).join('');
}

async function loadCompanies() {
  try {
    const snap = await getDocs(collection(db, 'companies'));
    companies = snap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
  } catch (error) {
    console.warn('Company list fallback used:', error);
    companies = [];
  }

  ensureCompanyFallbacks();
  renderCompanyOptions();
}

async function loadGovernanceRows() {
  const snap = await getDocs(collection(db, 'company_governance'));
  governanceRows = snap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
  renderRows();
}

async function saveGovernance() {
  const company = selectedCompany();
  const companyId = company.id || company.companyId;

  if (!companyId) {
    status('Select a company first.');
    return;
  }

  const payload = buildCompanyGovernanceConfig(company, {
    companyId,
    companyName: company.companyName || company.name || companyId,
    companyType: companyTypeSelect?.value || 'platform_vendor',
    operatorUid: operatorInput?.value || '',
    territoryId: territoryInput?.value || '',
    regionId: regionInput?.value || '',
    active: true
  });

  await setDoc(doc(db, 'company_governance', companyId), {
    ...payload,
    updatedAt: serverTimestamp()
  }, { merge: true });

  status('Governance profile saved.');
  await loadGovernanceRows();
}

function bindEvents() {
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      if (saveButton) saveButton.disabled = true;
      status('Saving governance profile...');
      await saveGovernance();
    } catch (error) {
      console.error(error);
      status(error.message || 'Governance save failed.');
    } finally {
      if (saveButton) saveButton.disabled = false;
    }
  });
}

function isGovernanceAdmin() {
  const profile = getSavedUserProfile() || {};
  const role = String(profile.role || '').toLowerCase();
  return ['owner', 'super_admin', 'admin', 'manager', 'operations_manager'].includes(role);
}

function init() {
  bindEvents();
  renderCompanyTypeOptions();

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.assign('/login.html');
      return;
    }

    if (!isGovernanceAdmin()) {
      status('Governance access requires admin permissions.');
      if (root) root.innerHTML = '<div class="item muted">You do not have access to company governance.</div>';
      return;
    }

    try {
      await loadCompanies();
      await loadGovernanceRows();
      status('Governance ready.');
    } catch (error) {
      console.error(error);
      status('Governance dashboard failed to load.');
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
