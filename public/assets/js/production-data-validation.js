const VALIDATION_SCHEMAS = Object.freeze({
  quotes: {
    required: ['id', 'customerId', 'companyId', 'status', 'totalCents'],
    numbers: ['totalCents', 'createdAtMs', 'updatedAtMs'],
    strings: ['id', 'customerId', 'companyId', 'status']
  },
  subscriptions: {
    required: ['id', 'customerId', 'companyId', 'status', 'amountCents', 'interval'],
    numbers: ['amountCents', 'createdAtMs', 'updatedAtMs'],
    strings: ['id', 'customerId', 'companyId', 'status', 'interval']
  },
  invoices: {
    required: ['id', 'customerId', 'companyId', 'status', 'totalCents', 'balanceDueCents'],
    numbers: ['totalCents', 'balanceDueCents', 'paidCents', 'createdAtMs', 'updatedAtMs'],
    strings: ['id', 'customerId', 'companyId', 'status']
  },
  customer_message_threads: {
    required: ['id', 'customerId', 'status', 'subject'],
    numbers: ['lastMessageAtMs', 'createdAtMs', 'updatedAtMs'],
    strings: ['id', 'customerId', 'status', 'subject']
  },
  customer_service_history: {
    required: ['id', 'customerId', 'type', 'status', 'title', 'serviceDateMs'],
    numbers: ['serviceDateMs', 'createdAtMs', 'updatedAtMs', 'amountCents'],
    strings: ['id', 'customerId', 'type', 'status', 'title']
  },
  customer_notifications: {
    required: ['id', 'customerId', 'title', 'status', 'type'],
    numbers: ['createdAtMs', 'updatedAtMs'],
    strings: ['id', 'customerId', 'title', 'status', 'type']
  },
  revenue_analytics: {
    required: ['id', 'generatedAtMs', 'kpis', 'risk'],
    numbers: ['generatedAtMs', 'persistedAtMs', 'updatedAtMs'],
    strings: ['id']
  },
  stripe_webhook_events: {
    required: ['id', 'type', 'receivedAtMs', 'payload'],
    numbers: ['receivedAtMs', 'updatedAtMs', 'processedAtMs'],
    strings: ['id', 'type']
  },
  marketplace_payouts: {
    required: ['id', 'companyId', 'status', 'grossCents'],
    numbers: ['grossCents', 'platformCents', 'companyCents', 'serviceVendorCents', 'createdAtMs', 'updatedAtMs'],
    strings: ['id', 'companyId', 'status']
  },
  stripe_sessions: {
    required: ['id', 'status'],
    numbers: ['amountCents', 'createdAtMs', 'updatedAtMs'],
    strings: ['id', 'status']
  }
});

const validationListeners = new Map();
let listenerCounter = 0;
let latestValidationReport = null;

function nextListenerId() {
  listenerCounter += 1;
  return `production_validation_listener_${Date.now()}_${listenerCounter}`;
}

function isMissing(value) {
  return value === undefined || value === null || value === '';
}

function validateFieldTypes(record = {}, schema = {}) {
  const errors = [];

  (schema.strings || []).forEach((field) => {
    if (record[field] !== undefined && record[field] !== null && typeof record[field] !== 'string') {
      errors.push({ field, code: 'invalid_string', message: `${field} must be a string.` });
    }
  });

  (schema.numbers || []).forEach((field) => {
    if (record[field] !== undefined && record[field] !== null && typeof record[field] !== 'number') {
      errors.push({ field, code: 'invalid_number', message: `${field} must be a number.` });
    }
  });

  return errors;
}

export function validateProductionRecord(collectionName, record = {}, options = {}) {
  const schema = VALIDATION_SCHEMAS[collectionName];
  const errors = [];
  const warnings = [];

  if (!schema) {
    warnings.push({ code: 'missing_schema', message: `No validation schema exists for ${collectionName}.` });
    return { valid: true, collectionName, recordId: record.id || '', errors, warnings };
  }

  (schema.required || []).forEach((field) => {
    if (isMissing(record[field])) {
      errors.push({ field, code: 'required', message: `${field} is required.` });
    }
  });

  errors.push(...validateFieldTypes(record, schema));

  if (record.createdAtMs && record.updatedAtMs && record.updatedAtMs < record.createdAtMs) {
    warnings.push({ code: 'timestamp_order', message: 'updatedAtMs is earlier than createdAtMs.' });
  }

  if (options.requireCompanyId && isMissing(record.companyId)) {
    errors.push({ field: 'companyId', code: 'required_company', message: 'companyId is required for this validation run.' });
  }

  return {
    valid: errors.length === 0,
    collectionName,
    recordId: record.id || '',
    errors,
    warnings
  };
}

export function validateProductionCollection(collectionName, records = [], options = {}) {
  const results = records.map((record) => validateProductionRecord(collectionName, record, options));
  const invalid = results.filter((result) => !result.valid);
  const warnings = results.flatMap((result) => result.warnings || []);

  return {
    collectionName,
    total: records.length,
    valid: invalid.length === 0,
    invalidCount: invalid.length,
    warningCount: warnings.length,
    results,
    generatedAtMs: Date.now()
  };
}

export function buildProductionValidationReport(collectionMap = {}, options = {}) {
  const collections = Object.entries(collectionMap).map(([collectionName, records]) => {
    return validateProductionCollection(collectionName, Array.isArray(records) ? records : [], options);
  });

  const invalidCount = collections.reduce((sum, collection) => sum + collection.invalidCount, 0);
  const warningCount = collections.reduce((sum, collection) => sum + collection.warningCount, 0);
  const totalRecords = collections.reduce((sum, collection) => sum + collection.total, 0);

  latestValidationReport = {
    id: `production_validation_${Date.now()}`,
    valid: invalidCount === 0,
    status: invalidCount ? 'failed' : warningCount ? 'warning' : 'passed',
    totalRecords,
    invalidCount,
    warningCount,
    collections,
    generatedAtMs: Date.now()
  };

  publishProductionValidationReport(latestValidationReport);
  return latestValidationReport;
}

export function getLatestProductionValidationReport() {
  return latestValidationReport;
}

export function publishProductionValidationReport(report = latestValidationReport) {
  validationListeners.forEach((listener) => {
    try {
      listener(report);
    } catch (error) {
      console.error('Production validation listener failure:', error);
    }
  });
}

export function subscribeProductionValidation(callback) {
  if (typeof callback !== 'function') throw new Error('subscribeProductionValidation requires a callback.');
  const id = nextListenerId();
  validationListeners.set(id, callback);
  callback(latestValidationReport);
  return id;
}

export function unsubscribeProductionValidation(listenerId) {
  return validationListeners.delete(listenerId);
}

export function getProductionValidationSchemas() {
  return VALIDATION_SCHEMAS;
}

window.EvaraProductionDataValidation = {
  validateProductionRecord,
  validateProductionCollection,
  buildProductionValidationReport,
  getLatestProductionValidationReport,
  publishProductionValidationReport,
  subscribeProductionValidation,
  unsubscribeProductionValidation,
  getProductionValidationSchemas
};
