import {
  CANONICAL_ROLES,
  canAccessPageName,
  normalizeAccessRole
} from '../access-control.js';
import {
  DESIGN_SYSTEM_VERSION,
  getDesignSystemComponent
} from '../design-system/registry.js';
import {
  DEFAULT_COMPONENT_ICONS,
  EVARA_ICON_REGISTRY_VERSION,
  normalizeEvaraIconId
} from '../icons/icon-registry.js';
import {
  STUDIO_COMPONENT_VERSION,
  getStudioComponent
} from './component-registry.js';
import {
  createEvaraGraph,
  createGraphEdge,
  createGraphNode,
  validateEvaraGraph
} from './core/evara-graph.js';

export const BLUEPRINT_DOCUMENT_KIND = 'evara.blueprint.component-document';
export const BLUEPRINT_DOCUMENT_SCHEMA_VERSION = '1.0.0';
export const BLUEPRINT_INSTANCE_SCHEMA_VERSION = '1.0.0';
export const BLUEPRINT_SERIALIZER_VERSION = 'blueprint-serializer-v1';
export const BLUEPRINT_GRAPH_COMPILER_VERSION = 'blueprint-graph-compiler-v1';
export const ACTION_BINDING_VERSION = 'action-binding-v1';

const DOCUMENT_STATES = new Set(['draft', 'review', 'release-candidate', 'published', 'archived']);
const ALLOWED_SPANS = new Set([3, 4, 6, 8, 12]);
const ACTION_INTENTS = new Set(['none', 'navigate', 'message', 'schedule', 'submit', 'approve', 'open-panel']);
const MAX_PAGES = 50;
const MAX_SECTIONS_PER_PAGE = 50;
const MAX_INSTANCES = 5000;
const MAX_PROPS = 60;

const clone = (value) => globalThis.structuredClone
  ? globalThis.structuredClone(value)
  : JSON.parse(JSON.stringify(value));

const clean = (value, max = 500) => String(value ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  .slice(0, max);

function slug(value = 'item') {
  return clean(value, 180)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function safeJsonValue(value, depth = 0) {
  if (depth > 5) return null;
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => safeJsonValue(item, depth + 1));
  if (!isPlainObject(value)) return null;
  const output = {};
  Object.entries(value).slice(0, 100).forEach(([key, entry]) => {
    const safeKey = clean(key, 80);
    if (!safeKey || safeKey === '__proto__' || safeKey === 'constructor' || safeKey === 'prototype') return;
    output[safeKey] = safeJsonValue(entry, depth + 1);
  });
  return output;
}

function stableSort(value) {
  if (Array.isArray(value)) return value.map(stableSort);
  if (!isPlainObject(value)) return value;
  return Object.keys(value).sort().reduce((output, key) => {
    output[key] = stableSort(value[key]);
    return output;
  }, {});
}

function stableStringify(value) {
  return JSON.stringify(stableSort(value));
}

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function currentIso(explicit = '') {
  const value = clean(explicit, 40);
  return /^\d{4}-\d{2}-\d{2}T/.test(value) ? value : new Date().toISOString();
}

function normalizeState(value = 'draft') {
  return DOCUMENT_STATES.has(value) ? value : 'draft';
}

function normalizeSpan(value, fallback = 4) {
  const span = Number(value);
  return ALLOWED_SPANS.has(span) ? span : fallback;
}

function normalizeVisibility(raw, fallbackRole = 'owner') {
  const normalizedFallback = normalizeAccessRole(fallbackRole);
  const supplied = isPlainObject(raw?.roles) ? raw.roles : {};
  return {
    roles: Object.fromEntries(CANONICAL_ROLES.map((role) => [
      role,
      typeof supplied[role] === 'boolean'
        ? supplied[role]
        : role === normalizedFallback || role === 'platform_admin' || role === 'owner' || role === 'admin'
    ]))
  };
}

function normalizeResponsive(raw, span) {
  const source = isPlainObject(raw) ? raw : {};
  const base = normalizeSpan(source.base?.span, span);
  const tablet = normalizeSpan(source.tablet?.span, base);
  const mobile = normalizeSpan(source.mobile?.span, 12);
  return {
    base: { span: base, hidden: Boolean(source.base?.hidden) },
    tablet: { span: tablet, hidden: Boolean(source.tablet?.hidden) },
    mobile: { span: mobile, hidden: Boolean(source.mobile?.hidden) }
  };
}

function normalizeProps(component, rawProps) {
  const source = isPlainObject(rawProps) ? rawProps : {};
  const defaults = isPlainObject(component?.defaults) ? component.defaults : {};
  const keys = new Set([
    ...Object.keys(defaults),
    ...Object.keys(source).slice(0, MAX_PROPS)
  ]);
  const props = {};
  [...keys].slice(0, MAX_PROPS).forEach((key) => {
    props[clean(key, 80)] = safeJsonValue(source[key] ?? defaults[key]);
  });
  return props;
}

function normalizeAction(props, role) {
  const intent = ACTION_INTENTS.has(clean(props?.actionIntent, 40)) ? clean(props.actionIntent, 40) : 'none';
  const target = clean(props?.actionTarget, 240);
  const label = clean(props?.action ?? props?.label ?? '', 240);
  const routeAllowed = !target || canAccessPageName(target, role);
  return {
    version: ACTION_BINDING_VERSION,
    label,
    intent,
    target,
    routeAllowed
  };
}

function autoLayoutLookup(autoLayoutState, pageId) {
  const groups = Array.isArray(autoLayoutState?.pages?.[pageId]?.groups)
    ? autoLayoutState.pages[pageId].groups
    : [];
  const membership = new Map();
  const normalizedGroups = groups.slice(0, 50).map((group, index) => {
    const id = clean(group?.id || `stack-${index + 1}`, 120);
    const children = Array.isArray(group?.children)
      ? [...new Set(group.children.map((item) => clean(item, 120)).filter(Boolean))].slice(0, 100)
      : [];
    children.forEach((nodeId) => membership.set(nodeId, id));
    return {
      id,
      name: clean(group?.name || `Stack ${index + 1}`, 120),
      direction: group?.direction === 'column' ? 'column' : 'row',
      gap: Math.max(0, Math.min(48, Number(group?.gap) || 0)),
      padding: Math.max(0, Math.min(48, Number(group?.padding) || 0)),
      align: ['start', 'center', 'end', 'stretch'].includes(group?.align) ? group.align : 'stretch',
      wrap: group?.wrap !== false,
      children
    };
  });
  return { groups: normalizedGroups, membership };
}

function buildInstance(node, page, order, membership, options = {}) {
  const requestedType = clean(node?.type || 'glass-card', 100);
  const component = getStudioComponent(requestedType) || getStudioComponent('glass-card');
  const definitionId = component?.id || 'glass-card';
  const contract = getDesignSystemComponent(component?.designSystem?.contractId || 'card');
  const role = normalizeAccessRole(page?.role || options.role || 'owner');
  const props = normalizeProps(component, node?.props);
  const span = normalizeSpan(node?.span, component?.defaultSpan || 4);
  const instanceId = clean(node?.id || `instance-${definitionId}-${order + 1}`, 120);
  const groupId = membership.get(instanceId) || '';
  const iconId = normalizeEvaraIconId(props.icon, DEFAULT_COMPONENT_ICONS[definitionId] || 'sparkles');
  const action = normalizeAction(props, role);

  return {
    id: instanceId,
    kind: 'component-instance',
    schemaVersion: BLUEPRINT_INSTANCE_SCHEMA_VERSION,
    definition: {
      id: definitionId,
      studioVersion: STUDIO_COMPONENT_VERSION,
      designSystemVersion: DESIGN_SYSTEM_VERSION,
      contractId: component?.designSystem?.contractId || contract?.id || 'card'
    },
    props,
    icon: {
      registry: EVARA_ICON_REGISTRY_VERSION,
      id: iconId
    },
    action,
    layout: {
      mode: groupId ? 'auto-layout' : 'grid',
      span,
      order,
      groupId,
      style: {
        radius: Math.max(8, Math.min(48, Number(node?.style?.radius) || 28)),
        glass: Math.max(20, Math.min(100, Number(node?.style?.glass) || 72))
      }
    },
    responsive: normalizeResponsive(node?.responsive, span),
    visibility: normalizeVisibility(node?.visibility, role),
    validation: {
      status: action.routeAllowed ? 'valid' : 'warning',
      errors: [],
      warnings: action.routeAllowed ? [] : [`${role} cannot access ${action.target}.`]
    },
    migration: {
      source: clean(options.source || 'studio-visual-builder-v2', 100),
      sourceVersion: Number(options.sourceVersion || 2),
      migrated: requestedType !== definitionId,
      originalDefinitionId: requestedType
    }
  };
}

function documentFingerprint(document) {
  const copy = clone(document);
  if (copy.metadata) {
    delete copy.metadata.fingerprint;
    delete copy.metadata.generatedAt;
  }
  delete copy.validation;
  return `bp_${fnv1a(stableStringify(copy))}`;
}

function buildDocument({
  blueprintId,
  name,
  role,
  status = 'draft',
  revision = 0,
  pages = [],
  instances = {},
  actorId = 'studio-user',
  generatedAt = '',
  source = 'studio-visual-builder-v2',
  migration = {}
} = {}) {
  const canonicalRole = normalizeAccessRole(role || blueprintId || 'customer');
  const document = {
    kind: BLUEPRINT_DOCUMENT_KIND,
    schemaVersion: BLUEPRINT_DOCUMENT_SCHEMA_VERSION,
    documentId: `blueprint-document:${slug(blueprintId || canonicalRole)}`,
    blueprintId: clean(blueprintId || canonicalRole, 100),
    name: clean(name || `${canonicalRole} Blueprint`, 160),
    role: canonicalRole,
    state: normalizeState(status),
    revision: Math.max(0, Number(revision) || 0),
    pages: pages.slice(0, MAX_PAGES),
    instances: Object.fromEntries(Object.entries(instances).slice(0, MAX_INSTANCES)),
    metadata: {
      serializerVersion: BLUEPRINT_SERIALIZER_VERSION,
      componentEngineVersion: STUDIO_COMPONENT_VERSION,
      designSystemVersion: DESIGN_SYSTEM_VERSION,
      iconRegistryVersion: EVARA_ICON_REGISTRY_VERSION,
      actionBindingVersion: ACTION_BINDING_VERSION,
      source: clean(source, 120),
      generatedAt: currentIso(generatedAt),
      generatedBy: clean(actorId, 160),
      migration: safeJsonValue(migration)
    }
  };
  document.metadata.fingerprint = documentFingerprint(document);
  document.validation = validateBlueprintDocument(document);
  return document;
}

export function serializeStudioPageToBlueprint({
  studioState,
  autoLayoutState = {},
  pageId = '',
  blueprintId = '',
  name = '',
  actorId = 'studio-user',
  generatedAt = ''
} = {}) {
  if (!isPlainObject(studioState)) throw new Error('Studio state is required for Blueprint serialization.');
  const page = Array.isArray(studioState.pages)
    ? studioState.pages.find((item) => item.id === (pageId || studioState.activePageId)) || studioState.pages[0]
    : null;
  if (!page) throw new Error('The selected Studio page does not exist.');

  const role = normalizeAccessRole(page.role || studioState.previewRole || 'owner');
  const { groups, membership } = autoLayoutLookup(autoLayoutState, page.id);
  const instances = {};
  const instanceIds = [];
  (Array.isArray(page.nodes) ? page.nodes : []).slice(0, MAX_INSTANCES).forEach((node, order) => {
    const instance = buildInstance(node, page, order, membership);
    instances[instance.id] = instance;
    instanceIds.push(instance.id);
  });

  const sectionId = `section:${slug(page.id)}:root`;
  const pages = [{
    id: clean(page.id, 120),
    name: clean(page.name || page.id, 160),
    route: clean(page.route || '', 240),
    role,
    order: 0,
    sections: [{
      id: sectionId,
      title: clean(page.name || 'Page content', 160),
      order: 0,
      layout: {
        mode: groups.length ? 'mixed' : 'grid',
        columns: 12,
        groups
      },
      instanceIds
    }]
  }];

  return buildDocument({
    blueprintId: blueprintId || role,
    name: name || `${page.name || role} Blueprint`,
    role,
    status: 'draft',
    revision: Number(studioState.revision || 0),
    pages,
    instances,
    actorId,
    generatedAt,
    source: 'studio-visual-builder-v2',
    migration: {
      sourceStateVersion: Number(studioState.version || 2),
      sourcePageId: page.id,
      activePageId: studioState.activePageId || page.id
    }
  });
}

export function legacyBlueprintToDocument(legacy, options = {}) {
  if (!isPlainObject(legacy)) throw new Error('Legacy Blueprint input must be an object.');
  const role = normalizeAccessRole(legacy.role || legacy.id || 'customer');
  const instances = {};
  const sections = [];
  let order = 0;

  (Array.isArray(legacy.sections) ? legacy.sections : []).slice(0, MAX_SECTIONS_PER_PAGE).forEach((section, sectionIndex) => {
    const instanceIds = [];
    (Array.isArray(section?.components) ? section.components : []).slice(0, 100).forEach((definitionId, componentIndex) => {
      const component = getStudioComponent(definitionId) || getStudioComponent('glass-card');
      const id = `instance:${slug(legacy.id || role)}:${slug(section?.id || sectionIndex)}:${componentIndex}`;
      const node = {
        id,
        type: component?.id || 'glass-card',
        span: component?.defaultSpan || 4,
        props: clone(component?.defaults || {}),
        style: { radius: 28, glass: 72 },
        visibility: { roles: { [role]: true } }
      };
      const instance = buildInstance(node, { role }, order, new Map(), {
        source: 'legacy-blueprint-registry',
        sourceVersion: Number(legacy.version || 1)
      });
      instances[id] = instance;
      instanceIds.push(id);
      order += 1;
    });
    sections.push({
      id: clean(section?.id || `section-${sectionIndex + 1}`, 120),
      title: clean(section?.title || `Section ${sectionIndex + 1}`, 160),
      order: sectionIndex,
      layout: { mode: 'grid', columns: 12, groups: [] },
      instanceIds
    });
  });

  return buildDocument({
    blueprintId: legacy.id || role,
    name: legacy.name || `${role} Blueprint`,
    role,
    status: legacy.status || 'draft',
    revision: Number(legacy.version || 0),
    pages: [{
      id: `${slug(legacy.id || role)}-page`,
      name: legacy.name || `${role} Blueprint`,
      route: clean(options.route || '', 240),
      role,
      order: 0,
      navigation: Array.isArray(legacy.navigation) ? legacy.navigation.map((item) => clean(item, 100)).slice(0, 50) : [],
      sections
    }],
    instances,
    actorId: options.actorId || 'legacy-blueprint-migrator',
    generatedAt: options.generatedAt,
    source: 'legacy-blueprint-registry',
    migration: {
      sourceEngineVersion: legacy.engineVersion || legacy.version || 'blueprint-engine-v1',
      legacyPermissions: Array.isArray(legacy.permissions) ? legacy.permissions.slice(0, 100) : []
    }
  });
}

export function migrateBlueprintDocument(input, options = {}) {
  if (input?.kind === BLUEPRINT_DOCUMENT_KIND && input?.schemaVersion === BLUEPRINT_DOCUMENT_SCHEMA_VERSION) {
    const copy = clone(input);
    copy.validation = validateBlueprintDocument(copy);
    copy.metadata = {
      ...(copy.metadata || {}),
      serializerVersion: BLUEPRINT_SERIALIZER_VERSION,
      fingerprint: documentFingerprint(copy)
    };
    return copy;
  }
  if (Array.isArray(input?.pages) && input.pages.some((page) => Array.isArray(page?.nodes))) {
    return serializeStudioPageToBlueprint({ studioState: input, ...options });
  }
  if (Array.isArray(input?.sections)) return legacyBlueprintToDocument(input, options);
  throw new Error('Unsupported Blueprint document shape.');
}

export function validateBlueprintDocument(document) {
  const errors = [];
  const warnings = [];
  if (!isPlainObject(document)) return { valid: false, status: 'invalid', errors: ['Blueprint document must be an object.'], warnings };
  if (document.kind !== BLUEPRINT_DOCUMENT_KIND) errors.push(`Unsupported Blueprint document kind: ${document.kind || 'missing'}.`);
  if (document.schemaVersion !== BLUEPRINT_DOCUMENT_SCHEMA_VERSION) errors.push(`Unsupported Blueprint schema version: ${document.schemaVersion || 'missing'}.`);
  if (!document.documentId) errors.push('Blueprint document is missing documentId.');
  if (!document.blueprintId) errors.push('Blueprint document is missing blueprintId.');
  if (!CANONICAL_ROLES.includes(normalizeAccessRole(document.role))) errors.push(`Unsupported Blueprint role: ${document.role}.`);
  if (!DOCUMENT_STATES.has(document.state)) errors.push(`Unsupported Blueprint state: ${document.state}.`);
  if (!Number.isInteger(document.revision) || document.revision < 0) errors.push('Blueprint revision must be a non-negative integer.');
  if (!Array.isArray(document.pages) || !document.pages.length) errors.push('Blueprint document must contain at least one page.');
  if (!isPlainObject(document.instances)) errors.push('Blueprint instances must be an object map.');

  const instances = isPlainObject(document.instances) ? document.instances : {};
  const referenced = new Set();
  const pageIds = new Set();
  (Array.isArray(document.pages) ? document.pages : []).slice(0, MAX_PAGES).forEach((page) => {
    if (!page?.id) errors.push('Every Blueprint page requires an ID.');
    if (pageIds.has(page?.id)) errors.push(`Duplicate Blueprint page ID: ${page.id}.`);
    pageIds.add(page?.id);
    if (page?.route && !canAccessPageName(page.route, page.role || document.role)) warnings.push(`${page.role || document.role} cannot access page route ${page.route}.`);
    if (!Array.isArray(page?.sections)) errors.push(`Blueprint page ${page?.id || 'unknown'} must contain sections.`);
    const sectionIds = new Set();
    (Array.isArray(page?.sections) ? page.sections : []).slice(0, MAX_SECTIONS_PER_PAGE).forEach((section) => {
      if (!section?.id) errors.push(`Blueprint page ${page?.id || 'unknown'} has a section without an ID.`);
      if (sectionIds.has(section?.id)) errors.push(`Duplicate section ID ${section.id} on page ${page?.id}.`);
      sectionIds.add(section?.id);
      if (!Array.isArray(section?.instanceIds)) errors.push(`Section ${section?.id || 'unknown'} must contain instanceIds.`);
      (Array.isArray(section?.instanceIds) ? section.instanceIds : []).forEach((instanceId) => {
        if (!instances[instanceId]) errors.push(`Section ${section.id} references missing instance ${instanceId}.`);
        if (referenced.has(instanceId)) warnings.push(`Instance ${instanceId} is referenced more than once.`);
        referenced.add(instanceId);
      });
    });
  });

  Object.entries(instances).slice(0, MAX_INSTANCES).forEach(([key, instance]) => {
    if (!isPlainObject(instance)) {
      errors.push(`Instance ${key} must be an object.`);
      return;
    }
    if (instance.id !== key) errors.push(`Instance map key ${key} does not match instance.id ${instance.id}.`);
    if (instance.kind !== 'component-instance') errors.push(`Instance ${key} has unsupported kind ${instance.kind}.`);
    if (instance.schemaVersion !== BLUEPRINT_INSTANCE_SCHEMA_VERSION) errors.push(`Instance ${key} uses unsupported schema ${instance.schemaVersion}.`);
    const component = getStudioComponent(instance.definition?.id);
    if (!component) errors.push(`Instance ${key} references unknown component definition ${instance.definition?.id}.`);
    if (!ALLOWED_SPANS.has(Number(instance.layout?.span))) errors.push(`Instance ${key} uses unsupported span ${instance.layout?.span}.`);
    if (!isPlainObject(instance.props)) errors.push(`Instance ${key} props must be an object.`);
    const normalizedIcon = normalizeEvaraIconId(instance.icon?.id, DEFAULT_COMPONENT_ICONS[instance.definition?.id] || 'sparkles');
    if (normalizedIcon !== instance.icon?.id) warnings.push(`Instance ${key} icon ${instance.icon?.id || 'missing'} normalizes to ${normalizedIcon}.`);
    if (!ACTION_INTENTS.has(instance.action?.intent)) errors.push(`Instance ${key} uses unsupported action intent ${instance.action?.intent}.`);
    if (instance.action?.target && !canAccessPageName(instance.action.target, document.role)) warnings.push(`${document.role} cannot access ${instance.action.target} for instance ${key}.`);
    if (!isPlainObject(instance.visibility?.roles)) errors.push(`Instance ${key} is missing role visibility.`);
    if (!referenced.has(key)) warnings.push(`Instance ${key} is not referenced by any section.`);
  });

  if (Object.keys(instances).length > MAX_INSTANCES) errors.push(`Blueprint document exceeds ${MAX_INSTANCES} component instances.`);
  const status = errors.length ? 'invalid' : warnings.length ? 'warning' : 'valid';
  return { valid: errors.length === 0, status, errors, warnings };
}

export function assertValidBlueprintDocument(document) {
  const validation = validateBlueprintDocument(document);
  if (!validation.valid) throw new Error(`Invalid Blueprint document: ${validation.errors.join(' | ')}`);
  return document;
}

export function blueprintDocumentToStudioProjection(document) {
  const normalized = migrateBlueprintDocument(document);
  assertValidBlueprintDocument(normalized);
  const page = normalized.pages[0];
  const instanceOrder = page.sections.flatMap((section) => section.instanceIds);
  const nodes = instanceOrder.map((instanceId) => normalized.instances[instanceId]).filter(Boolean).map((instance) => ({
    id: instance.id,
    type: instance.definition.id,
    span: instance.layout.span,
    props: {
      ...clone(instance.props),
      icon: instance.icon.id,
      action: instance.action.label,
      actionIntent: instance.action.intent,
      actionTarget: instance.action.target
    },
    style: clone(instance.layout.style),
    responsive: clone(instance.responsive),
    visibility: clone(instance.visibility)
  }));
  const groups = page.sections.flatMap((section) => section.layout?.groups || []);
  return {
    page: {
      id: page.id,
      name: page.name,
      route: page.route,
      role: page.role,
      nodes
    },
    autoLayout: {
      pages: {
        [page.id]: { groups: clone(groups) }
      }
    },
    source: {
      documentId: normalized.documentId,
      schemaVersion: normalized.schemaVersion,
      fingerprint: normalized.metadata?.fingerprint || documentFingerprint(normalized)
    }
  };
}

export function compileBlueprintDocumentToGraph(document, options = {}) {
  const normalized = migrateBlueprintDocument(document, options);
  assertValidBlueprintDocument(normalized);
  const actorId = clean(options.actorId || normalized.metadata?.generatedBy || 'blueprint-compiler', 160);
  const graph = createEvaraGraph({
    graphId: options.graphId || `graph:${slug(normalized.blueprintId)}:${normalized.metadata.fingerprint}`,
    name: `${normalized.name} Graph`,
    state: normalized.state,
    createdBy: actorId,
    metadata: {
      compilerVersion: BLUEPRINT_GRAPH_COMPILER_VERSION,
      blueprintDocumentId: normalized.documentId,
      blueprintSchemaVersion: normalized.schemaVersion,
      blueprintFingerprint: normalized.metadata.fingerprint
    }
  });

  const addNode = (node) => { graph.nodes[node.id] = node; return node.id; };
  const addEdge = (edge) => { graph.edges[edge.id] = edge; return edge.id; };
  const edgeId = (source, kind, target) => `edge:${slug(source)}:${kind}:${slug(target)}`;

  const rootId = addNode(createGraphNode({
    id: `workspace:${slug(normalized.blueprintId)}`,
    kind: 'workspace',
    name: normalized.name,
    props: { source: BLUEPRINT_SERIALIZER_VERSION }
  }));
  const blueprintNodeId = addNode(createGraphNode({
    id: `blueprint:${slug(normalized.blueprintId)}`,
    kind: 'blueprint',
    name: normalized.name,
    props: {
      documentId: normalized.documentId,
      schemaVersion: normalized.schemaVersion,
      fingerprint: normalized.metadata.fingerprint,
      role: normalized.role,
      state: normalized.state,
      revision: normalized.revision
    }
  }));
  addEdge(createGraphEdge({ id: edgeId(rootId, 'contains', blueprintNodeId), kind: 'contains', source: rootId, target: blueprintNodeId }));

  const roleNodes = new Map();
  const ensureRole = (role) => {
    const normalizedRole = normalizeAccessRole(role);
    if (roleNodes.has(normalizedRole)) return roleNodes.get(normalizedRole);
    const id = `role:${slug(normalizedRole)}`;
    addNode(createGraphNode({ id, kind: 'role', name: normalizedRole, props: { key: normalizedRole } }));
    roleNodes.set(normalizedRole, id);
    return id;
  };
  const blueprintRoleId = ensureRole(normalized.role);
  addEdge(createGraphEdge({ id: edgeId(blueprintNodeId, 'visibleTo', blueprintRoleId), kind: 'visibleTo', source: blueprintNodeId, target: blueprintRoleId }));

  const definitionNodes = new Map();
  const ensureDefinition = (instance) => {
    const definitionId = instance.definition.id;
    if (definitionNodes.has(definitionId)) return definitionNodes.get(definitionId);
    const component = getStudioComponent(definitionId);
    const id = `component:${slug(definitionId)}`;
    addNode(createGraphNode({
      id,
      kind: 'component-definition',
      name: component?.name || definitionId,
      props: {
        registryId: definitionId,
        studioVersion: instance.definition.studioVersion,
        designSystemVersion: instance.definition.designSystemVersion,
        contractId: instance.definition.contractId,
        primitive: clone(component?.primitive || {}),
        fields: clone(component?.fields || []),
        source: BLUEPRINT_SERIALIZER_VERSION
      }
    }));
    addEdge(createGraphEdge({ id: edgeId(rootId, 'contains', id), kind: 'contains', source: rootId, target: id, props: { collection: 'component-definitions' } }));
    definitionNodes.set(definitionId, id);
    return id;
  };

  const routeNodes = new Map();
  const ensureRoute = (route) => {
    if (routeNodes.has(route)) return routeNodes.get(route);
    const id = `route:${slug(route)}`;
    addNode(createGraphNode({ id, kind: 'route', name: route, props: { path: route } }));
    addEdge(createGraphEdge({ id: edgeId(rootId, 'contains', id), kind: 'contains', source: rootId, target: id, props: { collection: 'routes' } }));
    routeNodes.set(route, id);
    return id;
  };

  normalized.pages.forEach((page) => {
    const pageNodeId = addNode(createGraphNode({
      id: `page:${slug(page.id)}`,
      kind: 'page',
      name: page.name,
      props: { route: page.route, role: page.role, order: page.order, source: BLUEPRINT_SERIALIZER_VERSION }
    }));
    addEdge(createGraphEdge({ id: edgeId(blueprintNodeId, 'contains', pageNodeId), kind: 'contains', source: blueprintNodeId, target: pageNodeId }));
    if (page.route) {
      const routeId = ensureRoute(page.route);
      addEdge(createGraphEdge({ id: edgeId(pageNodeId, 'navigatesTo', routeId), kind: 'navigatesTo', source: pageNodeId, target: routeId }));
    }

    page.sections.forEach((section) => {
      const sectionNodeId = addNode(createGraphNode({
        id: `frame:${slug(page.id)}:${slug(section.id)}`,
        kind: 'frame',
        name: section.title,
        props: { order: section.order, layout: clone(section.layout), source: BLUEPRINT_SERIALIZER_VERSION }
      }));
      addEdge(createGraphEdge({ id: edgeId(pageNodeId, 'contains', sectionNodeId), kind: 'contains', source: pageNodeId, target: sectionNodeId }));

      section.instanceIds.forEach((instanceId) => {
        const instance = normalized.instances[instanceId];
        if (!instance) return;
        const definitionNodeId = ensureDefinition(instance);
        const instanceNodeId = addNode(createGraphNode({
          id: `instance:${slug(instance.id)}`,
          kind: 'component-instance',
          name: `${instance.definition.id} instance`,
          props: {
            instanceId: instance.id,
            definitionId: instance.definition.id,
            props: clone(instance.props),
            icon: clone(instance.icon),
            action: clone(instance.action),
            layout: clone(instance.layout),
            responsive: clone(instance.responsive),
            visibility: clone(instance.visibility),
            validation: clone(instance.validation),
            migration: clone(instance.migration),
            source: BLUEPRINT_SERIALIZER_VERSION
          }
        }));
        addEdge(createGraphEdge({ id: edgeId(sectionNodeId, 'contains', instanceNodeId), kind: 'contains', source: sectionNodeId, target: instanceNodeId, props: { order: instance.layout.order } }));
        addEdge(createGraphEdge({ id: edgeId(instanceNodeId, 'instantiates', definitionNodeId), kind: 'instantiates', source: instanceNodeId, target: definitionNodeId }));

        Object.entries(instance.visibility.roles).filter(([, visible]) => visible).forEach(([role]) => {
          const roleId = ensureRole(role);
          addEdge(createGraphEdge({ id: edgeId(instanceNodeId, 'visibleTo', roleId), kind: 'visibleTo', source: instanceNodeId, target: roleId }));
        });

        if (instance.action.intent !== 'none') {
          const actionNodeId = addNode(createGraphNode({
            id: `action:${slug(instance.id)}`,
            kind: 'action',
            name: instance.action.label || instance.action.intent,
            props: clone(instance.action)
          }));
          addEdge(createGraphEdge({ id: edgeId(instanceNodeId, 'triggers', actionNodeId), kind: 'triggers', source: instanceNodeId, target: actionNodeId }));
          if (instance.action.target) {
            const routeId = ensureRoute(instance.action.target);
            addEdge(createGraphEdge({ id: edgeId(actionNodeId, 'navigatesTo', routeId), kind: 'navigatesTo', source: actionNodeId, target: routeId }));
          }
        }
      });
    });
  });

  const validation = validateEvaraGraph(graph);
  if (!validation.valid) throw new Error(`Blueprint graph compilation failed: ${validation.errors.join(' | ')}`);
  return {
    graph,
    validation,
    compilerVersion: BLUEPRINT_GRAPH_COMPILER_VERSION,
    sourceDocumentId: normalized.documentId,
    sourceFingerprint: normalized.metadata.fingerprint
  };
}

export function serializeBlueprintDocument(document, space = 2) {
  const normalized = migrateBlueprintDocument(document);
  assertValidBlueprintDocument(normalized);
  return JSON.stringify(stableSort(normalized), null, Math.max(0, Math.min(2, Number(space) || 0)));
}

export function parseBlueprintDocument(serialized) {
  const parsed = JSON.parse(String(serialized || ''));
  return migrateBlueprintDocument(parsed);
}

export const EvaraBlueprintDocument = Object.freeze({
  kind: BLUEPRINT_DOCUMENT_KIND,
  schemaVersion: BLUEPRINT_DOCUMENT_SCHEMA_VERSION,
  instanceSchemaVersion: BLUEPRINT_INSTANCE_SCHEMA_VERSION,
  serializerVersion: BLUEPRINT_SERIALIZER_VERSION,
  compilerVersion: BLUEPRINT_GRAPH_COMPILER_VERSION,
  serializeStudioPage: serializeStudioPageToBlueprint,
  migrate: migrateBlueprintDocument,
  validate: validateBlueprintDocument,
  assertValid: assertValidBlueprintDocument,
  toStudioProjection: blueprintDocumentToStudioProjection,
  toGraph: compileBlueprintDocumentToGraph,
  stringify: serializeBlueprintDocument,
  parse: parseBlueprintDocument,
  fingerprint: documentFingerprint
});

if (typeof window !== 'undefined') window.EvaraBlueprintDocument = EvaraBlueprintDocument;
