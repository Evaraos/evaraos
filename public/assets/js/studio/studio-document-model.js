const DOCUMENT_KEY = 'evaraos-studio-document-v1';
const LEGACY_CONTENT_KEY = 'evaraos-studio-visual-builder-v1';
const LEGACY_LAYOUT_KEY = 'evaraos-studio-auto-layout-v1';
const LEGACY_LIVE_KEY = 'evaraos-studio-visual-builder-live-v1';
const SCHEMA = 'evara.studio.document';
const SCHEMA_VERSION = 1;
const MAX_VERSIONS = 8;
const MAX_PAGES = 30;
const MAX_NODES_PER_PAGE = 120;
const MAX_GROUPS_PER_PAGE = 40;
const MAX_CHILDREN_PER_GROUP = 60;
const AUTOSAVE_DELAY = 280;

const nativeGetItem = Storage.prototype.getItem;
const nativeSetItem = Storage.prototype.setItem;
const nativeRemoveItem = Storage.prototype.removeItem;
const adapters = new Map();
let activeAdapter = 'local';
let saveTimer = 0;
let pendingReason = 'autosave';
let documentState = null;
let lastSnapshotAt = 0;

const now = () => new Date().toISOString();
const clone = (value) => JSON.parse(JSON.stringify(value));
const safeParse = (value, fallback = null) => {
  try { return JSON.parse(value); }
  catch { return fallback; }
};
const text = (value, max = 160) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max);
const integer = (value, fallback = 0) => Number.isInteger(Number(value)) ? Number(value) : fallback;

function readRaw(key) {
  return nativeGetItem.call(localStorage, key);
}

function writeRaw(key, value) {
  nativeSetItem.call(localStorage, key, value);
}

function removeRaw(key) {
  nativeRemoveItem.call(localStorage, key);
}

function normalizeContent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const pages = Array.isArray(raw.pages) ? raw.pages.slice(0, MAX_PAGES).map((page, pageIndex) => {
    const nodes = Array.isArray(page?.nodes) ? page.nodes.slice(0, MAX_NODES_PER_PAGE).map((node, nodeIndex) => ({
      ...clone(node || {}),
      id: text(node?.id || `node-${pageIndex}-${nodeIndex}`, 120),
      type: text(node?.type || 'glass-card', 80)
    })) : [];
    return {
      ...clone(page || {}),
      id: text(page?.id || `page-${pageIndex}`, 100),
      name: text(page?.name || `Page ${pageIndex + 1}`, 120),
      nodes
    };
  }) : [];
  return {
    ...clone(raw),
    version: integer(raw.version, 2),
    pages,
    updatedAt: text(raw.updatedAt || now(), 64)
  };
}

function normalizeLayout(raw) {
  const pages = {};
  if (raw?.pages && typeof raw.pages === 'object') {
    Object.entries(raw.pages).slice(0, MAX_PAGES).forEach(([pageId, page]) => {
      const used = new Set();
      const groups = Array.isArray(page?.groups) ? page.groups.slice(0, MAX_GROUPS_PER_PAGE).map((group, index) => ({
        ...clone(group || {}),
        id: text(group?.id || `stack-${index}`, 120),
        name: text(group?.name || `Stack ${index + 1}`, 80),
        direction: group?.direction === 'column' ? 'column' : 'row',
        gap: Math.min(48, Math.max(0, Number(group?.gap) || 0)),
        padding: Math.min(48, Math.max(0, Number(group?.padding) || 0)),
        align: ['start', 'center', 'end', 'stretch'].includes(group?.align) ? group.align : 'stretch',
        wrap: group?.wrap !== false,
        children: Array.isArray(group?.children)
          ? group.children.map((id) => text(id, 120)).filter((id) => id && !used.has(id) && used.add(id)).slice(0, MAX_CHILDREN_PER_GROUP)
          : []
      })) : [];
      pages[text(pageId, 100)] = { groups };
    });
  }
  return { version: 1, pages };
}

function emptyDocument() {
  const timestamp = now();
  return {
    schema: SCHEMA,
    schemaVersion: SCHEMA_VERSION,
    documentId: 'evaraos-primary-studio',
    revision: 0,
    status: 'draft',
    content: null,
    layout: { version: 1, pages: {} },
    publication: { revision: null, publishedAt: null },
    versions: [],
    metadata: {
      createdAt: timestamp,
      updatedAt: timestamp,
      migratedAt: null,
      migratedFrom: [],
      activeAdapter: 'local',
      lastReason: 'initialize'
    }
  };
}

function normalizeVersion(raw, index) {
  return {
    id: text(raw?.id || `version-${index}`, 120),
    revision: Math.max(0, integer(raw?.revision, 0)),
    createdAt: text(raw?.createdAt || now(), 64),
    reason: text(raw?.reason || 'checkpoint', 80),
    content: normalizeContent(raw?.content),
    layout: normalizeLayout(raw?.layout)
  };
}

function normalizeDocument(raw) {
  const base = emptyDocument();
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    schema: SCHEMA,
    schemaVersion: SCHEMA_VERSION,
    documentId: text(raw.documentId || base.documentId, 120),
    revision: Math.max(0, integer(raw.revision, 0)),
    status: raw.status === 'published' ? 'published' : 'draft',
    content: normalizeContent(raw.content),
    layout: normalizeLayout(raw.layout),
    publication: {
      revision: raw?.publication?.revision === null ? null : Math.max(0, integer(raw?.publication?.revision, 0)),
      publishedAt: raw?.publication?.publishedAt ? text(raw.publication.publishedAt, 64) : null
    },
    versions: Array.isArray(raw.versions) ? raw.versions.slice(0, MAX_VERSIONS).map(normalizeVersion) : [],
    metadata: {
      ...base.metadata,
      ...(raw.metadata && typeof raw.metadata === 'object' ? clone(raw.metadata) : {}),
      createdAt: text(raw?.metadata?.createdAt || base.metadata.createdAt, 64),
      updatedAt: text(raw?.metadata?.updatedAt || base.metadata.updatedAt, 64),
      migratedAt: raw?.metadata?.migratedAt ? text(raw.metadata.migratedAt, 64) : null,
      migratedFrom: Array.isArray(raw?.metadata?.migratedFrom) ? raw.metadata.migratedFrom.map((item) => text(item, 120)).slice(0, 8) : [],
      activeAdapter: text(raw?.metadata?.activeAdapter || 'local', 40),
      lastReason: text(raw?.metadata?.lastReason || 'load', 80)
    }
  };
}

function collectNodeIds(content) {
  const ids = new Set();
  const duplicates = [];
  (content?.pages || []).forEach((page) => (page.nodes || []).forEach((node) => {
    if (ids.has(node.id)) duplicates.push(node.id);
    ids.add(node.id);
  }));
  return { ids, duplicates };
}

function validateDocument(input = documentState) {
  const doc = normalizeDocument(input);
  const errors = [];
  const warnings = [];
  if (!doc.content?.pages?.length) errors.push('Studio document has no pages.');
  const { ids, duplicates } = collectNodeIds(doc.content);
  if (duplicates.length) errors.push(`Duplicate component IDs: ${[...new Set(duplicates)].slice(0, 5).join(', ')}`);
  (doc.content?.pages || []).forEach((page) => {
    const heroCount = (page.nodes || []).filter((node) => node.type === 'hero-block').length;
    if (heroCount > 1) errors.push(`${page.name || page.id} contains more than one hero.`);
    if (!(page.nodes || []).length) warnings.push(`${page.name || page.id} is empty.`);
  });
  Object.entries(doc.layout?.pages || {}).forEach(([pageId, page]) => {
    const membership = new Set();
    (page.groups || []).forEach((group) => {
      (group.children || []).forEach((nodeId) => {
        if (!ids.has(nodeId)) errors.push(`${group.name || group.id} references missing component ${nodeId}.`);
        if (membership.has(nodeId)) errors.push(`${nodeId} appears in multiple stacks on ${pageId}.`);
        membership.add(nodeId);
        const node = (doc.content?.pages || []).flatMap((item) => item.nodes || []).find((item) => item.id === nodeId);
        if (node?.type === 'hero-block') errors.push('Hero components cannot be placed inside Auto Layout stacks.');
      });
    });
  });
  return { valid: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}

function makeSnapshot(reason = 'checkpoint') {
  return {
    id: `version-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    revision: documentState.revision,
    createdAt: now(),
    reason: text(reason, 80),
    content: clone(documentState.content),
    layout: clone(documentState.layout)
  };
}

function persistDocument(reason = 'autosave', options = {}) {
  documentState = normalizeDocument(documentState);
  documentState.revision += 1;
  documentState.status = options.published ? 'published' : 'draft';
  documentState.metadata.updatedAt = now();
  documentState.metadata.activeAdapter = activeAdapter;
  documentState.metadata.lastReason = text(reason, 80);
  if (options.snapshot) {
    documentState.versions.unshift(makeSnapshot(reason));
    documentState.versions = documentState.versions.slice(0, MAX_VERSIONS);
    lastSnapshotAt = Date.now();
  }
  if (options.published) {
    documentState.publication = { revision: documentState.revision, publishedAt: now() };
  }
  const adapter = adapters.get(activeAdapter) || adapters.get('local');
  adapter.save(clone(documentState));
  dispatchStatus('saved', reason);
  return clone(documentState);
}

function scheduleDocumentSave(reason = 'autosave') {
  pendingReason = text(reason, 80);
  clearTimeout(saveTimer);
  dispatchStatus('saving', pendingReason);
  saveTimer = setTimeout(() => {
    const shouldSnapshot = Date.now() - lastSnapshotAt > 5 * 60 * 1000 && documentState.revision > 0;
    persistDocument(pendingReason, { snapshot: shouldSnapshot });
  }, AUTOSAVE_DELAY);
}

function dispatchStatus(state, reason, extra = {}) {
  window.dispatchEvent(new CustomEvent('evara:studio-document-status', {
    detail: {
      state,
      reason,
      revision: documentState?.revision || 0,
      updatedAt: documentState?.metadata?.updatedAt || null,
      ...extra
    }
  }));
}

function migrateLegacy() {
  const existing = safeParse(readRaw(DOCUMENT_KEY));
  const content = normalizeContent(safeParse(readRaw(LEGACY_CONTENT_KEY)));
  const layout = normalizeLayout(safeParse(readRaw(LEGACY_LAYOUT_KEY)));
  documentState = normalizeDocument(existing);
  const migratedFrom = [];

  if (!existing) {
    if (content) {
      documentState.content = content;
      migratedFrom.push(LEGACY_CONTENT_KEY);
    }
    if (Object.keys(layout.pages).length) {
      documentState.layout = layout;
      migratedFrom.push(LEGACY_LAYOUT_KEY);
    }
    if (migratedFrom.length) {
      documentState.metadata.migratedAt = now();
      documentState.metadata.migratedFrom = migratedFrom;
      documentState.versions.unshift(makeSnapshot('legacy-migration'));
      documentState.versions = documentState.versions.slice(0, MAX_VERSIONS);
      persistDocument('legacy-migration');
    } else {
      adapters.get('local').save(documentState);
    }
  } else {
    if (content && Date.parse(content.updatedAt || 0) > Date.parse(documentState.metadata.updatedAt || 0)) {
      documentState.content = content;
      persistDocument('legacy-content-recovery', { snapshot: true });
    }
    if (!documentState.content && content) documentState.content = content;
    if (!Object.keys(documentState.layout.pages).length && Object.keys(layout.pages).length) documentState.layout = layout;
  }

  if (documentState.content) writeRaw(LEGACY_CONTENT_KEY, JSON.stringify(documentState.content));
  if (documentState.layout) writeRaw(LEGACY_LAYOUT_KEY, JSON.stringify(documentState.layout));
}

function installStorageBridge() {
  const originalSetItem = Storage.prototype.setItem;
  if (originalSetItem.__evaraStudioUnified) return;
  function bridgedSetItem(key, value) {
    if (this !== localStorage) return nativeSetItem.call(this, key, value);
    if (key === LEGACY_CONTENT_KEY) {
      const normalized = normalizeContent(safeParse(value));
      nativeSetItem.call(this, key, JSON.stringify(normalized));
      documentState.content = normalized;
      scheduleDocumentSave('content-autosave');
      return;
    }
    if (key === LEGACY_LAYOUT_KEY) {
      const normalized = normalizeLayout(safeParse(value));
      nativeSetItem.call(this, key, JSON.stringify(normalized));
      documentState.layout = normalized;
      scheduleDocumentSave('layout-autosave');
      return;
    }
    if (key === LEGACY_LIVE_KEY) {
      const report = validateDocument();
      if (!report.valid) {
        dispatchStatus('blocked', 'publish-validation', { report });
        return;
      }
      nativeSetItem.call(this, key, value);
      clearTimeout(saveTimer);
      documentState.content = normalizeContent(safeParse(readRaw(LEGACY_CONTENT_KEY))) || documentState.content;
      documentState.layout = normalizeLayout(safeParse(readRaw(LEGACY_LAYOUT_KEY)));
      persistDocument('publish', { snapshot: true, published: true });
      window.dispatchEvent(new CustomEvent('evara:studio-published', { detail: { revision: documentState.revision } }));
      return;
    }
    nativeSetItem.call(this, key, value);
  }
  Object.defineProperty(bridgedSetItem, '__evaraStudioUnified', { value: true });
  Storage.prototype.setItem = bridgedSetItem;
}

function flush(reason = 'manual-save', options = {}) {
  clearTimeout(saveTimer);
  documentState.content = normalizeContent(safeParse(readRaw(LEGACY_CONTENT_KEY))) || documentState.content;
  documentState.layout = normalizeLayout(safeParse(readRaw(LEGACY_LAYOUT_KEY)));
  return persistDocument(reason, options);
}

function createCheckpoint(reason = 'manual-checkpoint') {
  return flush(reason, { snapshot: true });
}

function restoreVersion(versionId) {
  const version = documentState.versions.find((item) => item.id === versionId);
  if (!version) return { restored: false, reason: 'Version not found.' };
  documentState.versions.unshift(makeSnapshot('before-restore'));
  documentState.content = normalizeContent(version.content);
  documentState.layout = normalizeLayout(version.layout);
  documentState.status = 'draft';
  documentState.publication = { revision: documentState.publication.revision, publishedAt: documentState.publication.publishedAt };
  writeRaw(LEGACY_CONTENT_KEY, JSON.stringify(documentState.content));
  writeRaw(LEGACY_LAYOUT_KEY, JSON.stringify(documentState.layout));
  persistDocument(`restore-${version.revision}`, { snapshot: false });
  window.dispatchEvent(new CustomEvent('evara:studio-document-restored', { detail: { versionId } }));
  return { restored: true };
}

function exportDocument() {
  return JSON.stringify(normalizeDocument(documentState), null, 2);
}

function registerAdapter(name, adapter) {
  if (!name || !adapter || typeof adapter.load !== 'function' || typeof adapter.save !== 'function') {
    throw new TypeError('Studio persistence adapters require load() and save(document).');
  }
  adapters.set(text(name, 40), adapter);
}

function setActiveAdapter(name) {
  if (!adapters.has(name)) throw new Error(`Unknown Studio persistence adapter: ${name}`);
  activeAdapter = name;
  documentState.metadata.activeAdapter = name;
  persistDocument('adapter-change');
}

registerAdapter('local', {
  load: () => normalizeDocument(safeParse(readRaw(DOCUMENT_KEY))),
  save: (document) => writeRaw(DOCUMENT_KEY, JSON.stringify(normalizeDocument(document)))
});

migrateLegacy();
installStorageBridge();

window.EvaraStudioDocument = Object.freeze({
  key: DOCUMENT_KEY,
  schema: SCHEMA,
  schemaVersion: SCHEMA_VERSION,
  getDocument: () => clone(documentState),
  validate: () => validateDocument(),
  flush,
  createCheckpoint,
  restoreVersion,
  exportDocument,
  registerAdapter,
  setActiveAdapter,
  listAdapters: () => [...adapters.keys()]
});

dispatchStatus('ready', 'document-model-ready');
