const SPLIT_MODELS = Object.freeze({
  platform_vendor: Object.freeze({
    label: 'Platform Vendor',
    platformPercent: 30,
    vendorPercent: 70,
    operatorPercent: 0
  }),
  subsidiary_expansion_partner: Object.freeze({
    label: 'Evaraos Subsidiary Expansion Partner',
    platformPercent: 50,
    vendorPercent: 50,
    operatorPercent: 0
  })
});

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function normalizeModel(model = 'platform_vendor') {
  const aliases = {
    evara_expansion_partner: 'subsidiary_expansion_partner',
    expansion_partner: 'subsidiary_expansion_partner',
    internal_subsidiary: 'subsidiary_expansion_partner'
  };

  const normalized = aliases[model] || model;

  return SPLIT_MODELS[normalized] ? normalized : 'platform_vendor';
}

export function getSplitModels() {
  return SPLIT_MODELS;
}

export function getSplitModel(model = 'platform_vendor') {
  return SPLIT_MODELS[normalizeModel(model)];
}

export function calculateSplit(amount = 0, options = {}) {
  const modelKey = normalizeModel(options.splitModel || options.companyType || 'platform_vendor');
  const preset = SPLIT_MODELS[modelKey];
  const total = roundMoney(amount);

  const platformPercent = Number(options.platformPercent ?? preset.platformPercent ?? 0);
  const vendorPercent = Number(options.vendorPercent ?? preset.vendorPercent ?? 0);
  const operatorPercent = Number(options.operatorPercent ?? preset.operatorPercent ?? 0);

  const platformAmount = roundMoney(total * (platformPercent / 100));
  const vendorAmount = roundMoney(total * (vendorPercent / 100));
  const operatorAmount = roundMoney(total * (operatorPercent / 100));

  const allocatedAmount = roundMoney(platformAmount + vendorAmount + operatorAmount);
  const remainderAmount = roundMoney(total - allocatedAmount);

  return {
    splitModel: modelKey,
    splitLabel: preset.label,
    totalAmount: total,
    platformPercent,
    vendorPercent,
    operatorPercent,
    platformAmount,
    vendorAmount,
    companyAmount: vendorAmount,
    operatorAmount,
    allocatedAmount,
    remainderAmount
  };
}

export function companyTypeToSplitModel(companyType = '') {
  const type = String(companyType || '').trim().toLowerCase();

  if (type === 'platform_vendor') return 'platform_vendor';
  if (
    type === 'subsidiary_expansion_partner' ||
    type === 'evara_expansion_partner' ||
    type === 'expansion_partner' ||
    type === 'internal_subsidiary'
  ) {
    return 'subsidiary_expansion_partner';
  }

  return 'platform_vendor';
}

window.EvaraSplitEngine = {
  getSplitModels,
  getSplitModel,
  calculateSplit,
  companyTypeToSplitModel
};
