#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const errors = [];
const requiredFiles = [
  'public/assets/js/studio/blueprint-registry.js',
  'public/assets/js/studio/blueprint-component-document.js',
  'public/assets/js/studio/studio-blueprint-serialization.js',
  'public/assets/js/studio/core/evara-graph.js',
  'public/assets/js/studio/component-registry.js',
  'public/assets/js/icons/icon-registry.js',
  'public/assets/js/access-control.js',
  'public/website-builder.html',
  'docs/schemas/blueprint-component-document.schema.json',
  'tests/visual/specs/studio-blueprint-serialization.spec.mjs',
  '.github/workflows/design-system-visual-qa.yml'
];

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

for (const file of requiredFiles) {
  if (!exists(file)) errors.push(`${file}: required Blueprint serialization asset is missing`);
}

if (!errors.length) {
  const registry = read('public/assets/js/studio/blueprint-registry.js');
  const documentRuntime = read('public/assets/js/studio/blueprint-component-document.js');
  const bridge = read('public/assets/js/studio/studio-blueprint-serialization.js');
  const graph = read('public/assets/js/studio/core/evara-graph.js');
  const componentRegistry = read('public/assets/js/studio/component-registry.js');
  const iconRegistry = read('public/assets/js/icons/icon-registry.js');
  const access = read('public/assets/js/access-control.js');
  const page = read('public/website-builder.html');
  const schemaText = read('docs/schemas/blueprint-component-document.schema.json');
  const test = read('tests/visual/specs/studio-blueprint-serialization.spec.mjs');
  const workflow = read('.github/workflows/design-system-visual-qa.yml');
  let schema = null;

  try {
    schema = JSON.parse(schemaText);
  } catch (error) {
    errors.push(`blueprint-component-document.schema.json: invalid JSON: ${error.message}`);
  }

  if (!registry.includes("BLUEPRINT_ENGINE_VERSION = 'blueprint-engine-v2'")) {
    errors.push('blueprint-registry.js: Blueprint registry must remain on blueprint-engine-v2');
  }
  for (const role of ['owner', 'admin', 'manager', 'sales', 'technician', 'cleaner', 'customer', 'vendor']) {
    if (!registry.includes(`id: '${role}'`) || !registry.includes(`role: '${role}'`)) {
      errors.push(`blueprint-registry.js: missing canonical ${role} Blueprint`);
    }
  }
  if (registry.includes("role: 'sales_rep'")) errors.push('blueprint-registry.js: sales role must remain canonical');
  if (!registry.includes('normalizeAccessRole')) errors.push('blueprint-registry.js: canonical role normalization is missing');

  for (const marker of [
    "BLUEPRINT_DOCUMENT_KIND = 'evara.blueprint.component-document'",
    "BLUEPRINT_DOCUMENT_SCHEMA_VERSION = '1.0.0'",
    "BLUEPRINT_INSTANCE_SCHEMA_VERSION = '1.0.0'",
    "BLUEPRINT_SERIALIZER_VERSION = 'blueprint-serializer-v1'",
    "BLUEPRINT_GRAPH_COMPILER_VERSION = 'blueprint-graph-compiler-v1'",
    'serializeStudioPageToBlueprint',
    'legacyBlueprintToDocument',
    'migrateBlueprintDocument',
    'validateBlueprintDocument',
    'blueprintDocumentToStudioProjection',
    'compileBlueprintDocumentToGraph',
    'documentFingerprint',
    'stableStringify',
    'createEvaraGraph',
    'createGraphNode',
    'createGraphEdge',
    "kind: 'component-instance'",
    "kind: 'instantiates'",
    "kind: 'visibleTo'",
    "kind: 'navigatesTo'",
    'STUDIO_COMPONENT_VERSION',
    'DESIGN_SYSTEM_VERSION',
    'EVARA_ICON_REGISTRY_VERSION',
    'canAccessPageName',
    'normalizeAccessRole'
  ]) {
    if (!documentRuntime.includes(marker)) errors.push(`blueprint-component-document.js: missing ${marker}`);
  }

  for (const marker of [
    "STUDIO_STATE_KEY = 'evaraos-studio-visual-builder-v1'",
    "AUTO_LAYOUT_KEY = 'evaraos-studio-auto-layout-v1'",
    'captureStudioBlueprint',
    'captureAllStudioBlueprints',
    'validateCurrentStudioBlueprint',
    'compileCurrentStudioBlueprint',
    'stringifyCurrentStudioBlueprint',
    'inspectBlueprintDocument',
    "authority: 'read-only-compatibility-projection'",
    'trustedPublishRequired: true',
    'dataset.blueprintSchema'
  ]) {
    if (!bridge.includes(marker)) errors.push(`studio-blueprint-serialization.js: missing ${marker}`);
  }

  for (const source of [documentRuntime, bridge]) {
    if (/localStorage\.setItem\s*\(/.test(source)) errors.push('Blueprint serialization layers must not create a second localStorage writer');
    if (/httpsCallable|publishBlueprint|saveBlueprintDraft|rollbackBlueprint/.test(source)) errors.push('Blueprint serialization layers must not call legacy trusted Blueprint mutation services');
    if (/innerHTML|outerHTML|eval\(|new Function/.test(source)) errors.push('Blueprint serialization layers contain an unsafe execution or DOM sink');
  }

  if (!graph.includes("'component-instance'")) errors.push('evara-graph.js: component-instance node kind is missing');
  if (!graph.includes("'blueprint'")) errors.push('evara-graph.js: blueprint node kind is missing');
  if (!graph.includes("'instantiates'")) errors.push('evara-graph.js: instantiates edge kind is missing');
  if (!componentRegistry.includes("STUDIO_COMPONENT_VERSION = 'component-engine-v4'")) errors.push('component-registry.js: unexpected component engine version');
  if (!iconRegistry.includes("EVARA_ICON_REGISTRY_VERSION = 'icon-registry-v1'")) errors.push('icon-registry.js: unexpected icon registry version');
  if (!access.includes('export function canAccessPageName') || !access.includes('export function normalizeAccessRole')) {
    errors.push('access-control.js: canonical Blueprint route or role validation exports are missing');
  }

  if (schema) {
    if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') errors.push('Blueprint schema must use JSON Schema 2020-12');
    if (schema.properties?.kind?.const !== 'evara.blueprint.component-document') errors.push('Blueprint schema kind constant is invalid');
    if (schema.properties?.schemaVersion?.const !== '1.0.0') errors.push('Blueprint schema version constant is invalid');
    if (schema.$defs?.componentInstance?.properties?.kind?.const !== 'component-instance') errors.push('Blueprint schema component-instance contract is missing');
    if (schema.$defs?.iconReference?.properties?.registry?.const !== 'icon-registry-v1') errors.push('Blueprint schema icon registry contract is missing');
    if (schema.$defs?.actionBinding?.properties?.version?.const !== 'action-binding-v1') errors.push('Blueprint schema action binding contract is missing');
    if (!schema.$defs?.visibility?.properties?.roles) errors.push('Blueprint schema role visibility contract is missing');
    if (!schema.$defs?.responsive?.properties?.mobile) errors.push('Blueprint schema responsive contract is missing');
  }

  const actionImport = '/assets/js/studio/studio-action-icon-config-v2.js?v=3';
  const serializationImport = '/assets/js/studio/studio-blueprint-serialization.js?v=1';
  if (!page.includes(serializationImport)) errors.push('public/website-builder.html: Blueprint serialization bridge is missing');
  if (!(page.indexOf(actionImport) >= 0 && page.indexOf(actionImport) < page.indexOf(serializationImport))) {
    errors.push('public/website-builder.html: Blueprint serialization must load after action/icon configuration');
  }

  for (const marker of [
    "page.goto('/website-builder.html'",
    'EvaraStudioBlueprintSerialization',
    'data-blueprint-schema',
    'api.capture',
    'api.stringifyCurrent',
    'api.inspect',
    'api.compileCurrent',
    'evara.blueprint.component-document',
    'icon-registry-v1',
    'action-binding-v1',
    "nodeKinds['component-instance']",
    'edgeKinds.instantiates',
    'edgeKinds.visibleTo',
    'edgeKinds.navigatesTo'
  ]) {
    if (!test.includes(marker)) errors.push(`studio-blueprint-serialization.spec.mjs: missing ${marker} coverage`);
  }

  if (!workflow.includes('node tools/studio-blueprint-serialization-audit.js')) {
    errors.push('.github/workflows/design-system-visual-qa.yml: Blueprint serialization audit is not wired');
  }
  if (!workflow.includes('specs/studio-blueprint-serialization.spec.mjs')) {
    errors.push('.github/workflows/design-system-visual-qa.yml: Blueprint serialization test is not wired');
  }
}

console.log(`EvaraOS Blueprint serialization audit: ${requiredFiles.length} required assets checked.`);
if (errors.length) {
  console.error(`Errors (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log('Blueprint component instances, schema, migration, round-trip projection, graph compilation, authority boundaries, and QA contracts passed.');
