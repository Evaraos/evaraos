import { getSavedUserProfile } from '../firebase.js';
import { getBlueprint } from './blueprint-registry.js';
import {
  BLUEPRINT_DOCUMENT_SCHEMA_VERSION,
  BLUEPRINT_GRAPH_COMPILER_VERSION,
  BLUEPRINT_SERIALIZER_VERSION,
  blueprintDocumentToStudioProjection,
  compileBlueprintDocumentToGraph,
  migrateBlueprintDocument,
  serializeBlueprintDocument,
  serializeStudioPageToBlueprint,
  validateBlueprintDocument
} from './blueprint-component-document.js';

const STUDIO_STATE_KEY = 'evaraos-studio-visual-builder-v1';
const AUTO_LAYOUT_KEY = 'evaraos-studio-auto-layout-v1';
let booted = false;
let frame = 0;

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value && typeof value === 'object' ? value : fallback;
  } catch {
    return fallback;
  }
}

function readStudioState() {
  return readJson(STUDIO_STATE_KEY, null);
}

function readAutoLayoutState() {
  return readJson(AUTO_LAYOUT_KEY, { version: 1, pages: {} });
}

function actorId() {
  const profile = getSavedUserProfile?.() || {};
  return String(profile.uid || profile.userId || profile.email || 'studio-user').slice(0, 160);
}

function pageFor(state, pageId = '') {
  if (!state?.pages?.length) return null;
  return state.pages.find((page) => page.id === (pageId || state.activePageId)) || state.pages[0];
}

function emit(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function captureStudioBlueprint(pageId = '', options = {}) {
  const studioState = readStudioState();
  if (!studioState) throw new Error('No Studio draft is available for Blueprint serialization.');
  const page = pageFor(studioState, pageId);
  if (!page) throw new Error('The requested Studio page is unavailable.');
  const blueprint = getBlueprint(page.role || studioState.previewRole || 'customer');
  const document = serializeStudioPageToBlueprint({
    studioState,
    autoLayoutState: readAutoLayoutState(),
    pageId: page.id,
    blueprintId: options.blueprintId || blueprint.id,
    name: options.name || `${page.name} Blueprint`,
    actorId: options.actorId || actorId(),
    generatedAt: options.generatedAt || ''
  });
  emit('evara:blueprint-document-captured', {
    documentId: document.documentId,
    pageId: page.id,
    blueprintId: document.blueprintId,
    schemaVersion: document.schemaVersion,
    fingerprint: document.metadata.fingerprint,
    validation: document.validation
  });
  return document;
}

export function captureAllStudioBlueprints(options = {}) {
  const state = readStudioState();
  if (!state?.pages?.length) return [];
  return state.pages.map((page) => captureStudioBlueprint(page.id, options));
}

export function validateCurrentStudioBlueprint(pageId = '') {
  const document = captureStudioBlueprint(pageId);
  return validateBlueprintDocument(document);
}

export function compileCurrentStudioBlueprint(pageId = '', options = {}) {
  const document = captureStudioBlueprint(pageId, options);
  const result = compileBlueprintDocumentToGraph(document, {
    actorId: options.actorId || actorId(),
    graphId: options.graphId
  });
  emit('evara:blueprint-graph-compiled', {
    documentId: document.documentId,
    graphId: result.graph.graphId,
    fingerprint: result.sourceFingerprint,
    validation: result.validation
  });
  return result;
}

export function stringifyCurrentStudioBlueprint(pageId = '', options = {}) {
  return serializeBlueprintDocument(captureStudioBlueprint(pageId, options));
}

export function inspectBlueprintDocument(document) {
  const migrated = migrateBlueprintDocument(document);
  return {
    document: migrated,
    validation: validateBlueprintDocument(migrated),
    projection: blueprintDocumentToStudioProjection(migrated)
  };
}

function updateDiagnostics() {
  const root = document.querySelector('[data-visual-studio]');
  if (!root) return;
  root.dataset.blueprintSchema = BLUEPRINT_DOCUMENT_SCHEMA_VERSION;
  root.dataset.blueprintSerializer = BLUEPRINT_SERIALIZER_VERSION;
  root.dataset.blueprintGraphCompiler = BLUEPRINT_GRAPH_COMPILER_VERSION;
  try {
    const state = readStudioState();
    const page = pageFor(state);
    if (!page) return;
    const document = captureStudioBlueprint(page.id, { actorId: 'diagnostic' });
    root.dataset.blueprintDocumentId = document.documentId;
    root.dataset.blueprintFingerprint = document.metadata.fingerprint;
    root.dataset.blueprintValidation = document.validation.status;
  } catch (error) {
    root.dataset.blueprintValidation = 'unavailable';
    root.dataset.blueprintError = String(error?.message || error).slice(0, 180);
  }
}

function scheduleDiagnostics() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(updateDiagnostics);
}

function boot() {
  if (booted) return;
  booted = true;
  const appRoot = document.querySelector('#appRoot');
  if (appRoot) new MutationObserver(scheduleDiagnostics).observe(appRoot, { childList: true });
  window.addEventListener('storage', (event) => {
    if ([STUDIO_STATE_KEY, AUTO_LAYOUT_KEY].includes(event.key)) scheduleDiagnostics();
  });
  scheduleDiagnostics();
}

window.EvaraStudioBlueprintSerialization = Object.freeze({
  schemaVersion: BLUEPRINT_DOCUMENT_SCHEMA_VERSION,
  serializerVersion: BLUEPRINT_SERIALIZER_VERSION,
  compilerVersion: BLUEPRINT_GRAPH_COMPILER_VERSION,
  capture: captureStudioBlueprint,
  captureAll: captureAllStudioBlueprints,
  validateCurrent: validateCurrentStudioBlueprint,
  compileCurrent: compileCurrentStudioBlueprint,
  stringifyCurrent: stringifyCurrentStudioBlueprint,
  inspect: inspectBlueprintDocument,
  authority: 'read-only-compatibility-projection',
  trustedPublishRequired: true
});

window.addEventListener('evara:session-ready', boot, { once: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 950), { once: true });
else setTimeout(boot, 950);
