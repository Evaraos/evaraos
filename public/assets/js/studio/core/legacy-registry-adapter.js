import {
  createEvaraGraph,
  createGraphEdge,
  createGraphNode
} from './evara-graph.js';
import {
  applyTransaction,
  createOperation
} from './operation-protocol.js';

export const LEGACY_REGISTRY_ADAPTER_VERSION = '0.1.0';

function slug(value) {
  return String(value || 'item')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function nodeOperation(graphId, node, actor) {
  return createOperation({ graphId, type: 'node.create', actor, payload: { node } });
}

function edgeOperation(graphId, edge, actor) {
  return createOperation({ graphId, type: 'edge.create', actor, payload: { edge } });
}

function ensureRole(role, context) {
  const normalized = slug(role || 'customer');
  const roleId = `role:${normalized}`;
  if (!context.nodeIds.has(roleId)) {
    const roleNode = createGraphNode({
      id: roleId,
      kind: 'role',
      name: String(role || 'Customer'),
      props: { key: role || 'customer', source: 'legacy-registry' },
      metadata: { adapterVersion: LEGACY_REGISTRY_ADAPTER_VERSION }
    });
    context.operations.push(nodeOperation(context.graphId, roleNode, context.actor));
    context.nodeIds.add(roleId);
  }
  return roleId;
}

function addComponents(components, context) {
  for (const component of components || []) {
    const nodeId = `component:${slug(component.id)}`;
    if (context.nodeIds.has(nodeId)) continue;

    const node = createGraphNode({
      id: nodeId,
      kind: 'component-definition',
      name: component.name || component.id,
      props: {
        registryId: component.id,
        category: component.category || 'uncategorized',
        description: component.description || '',
        icon: component.icon || null,
        fields: [...(component.fields || [])],
        permissions: [...(component.permissions || [])],
        primitive: { ...(component.primitive || {}) },
        defaults: { ...(component.defaults || {}) },
        source: 'legacy-component-registry'
      },
      metadata: { adapterVersion: LEGACY_REGISTRY_ADAPTER_VERSION }
    });

    context.operations.push(nodeOperation(context.graphId, node, context.actor));
    context.operations.push(edgeOperation(context.graphId, createGraphEdge({
      id: `edge:${context.rootId}:contains:${nodeId}`,
      kind: 'contains',
      source: context.rootId,
      target: nodeId,
      props: { collection: 'components' }
    }), context.actor));
    context.nodeIds.add(nodeId);
  }
}

function addModules(modules, context) {
  for (const module of modules || []) {
    const nodeId = `module:${slug(module.id)}`;
    if (context.nodeIds.has(nodeId)) continue;

    const node = createGraphNode({
      id: nodeId,
      kind: 'module',
      name: module.name || module.id,
      props: {
        registryId: module.id,
        status: module.status || 'planned',
        progress: Number(module.progress || 0),
        routes: [...(module.routes || [])],
        permissions: [...(module.permissions || [])],
        source: 'legacy-module-registry'
      },
      metadata: { adapterVersion: LEGACY_REGISTRY_ADAPTER_VERSION }
    });

    context.operations.push(nodeOperation(context.graphId, node, context.actor));
    context.operations.push(edgeOperation(context.graphId, createGraphEdge({
      id: `edge:${context.rootId}:contains:${nodeId}`,
      kind: 'contains',
      source: context.rootId,
      target: nodeId,
      props: { collection: 'modules' }
    }), context.actor));
    context.nodeIds.add(nodeId);
  }

  for (const module of modules || []) {
    const sourceId = `module:${slug(module.id)}`;
    for (const dependency of module.dependencies || []) {
      const targetId = `module:${slug(dependency)}`;
      if (!context.nodeIds.has(sourceId) || !context.nodeIds.has(targetId)) continue;
      const edgeId = `edge:${sourceId}:depends:${targetId}`;
      if (context.edgeIds.has(edgeId)) continue;
      context.operations.push(edgeOperation(context.graphId, createGraphEdge({
        id: edgeId,
        kind: 'dependsOn',
        source: sourceId,
        target: targetId
      }), context.actor));
      context.edgeIds.add(edgeId);
    }
  }
}

function addBlueprints(blueprints, context) {
  for (const blueprint of blueprints || []) {
    const blueprintId = `blueprint:${slug(blueprint.id)}`;
    const roleId = ensureRole(blueprint.role, context);

    const blueprintNode = createGraphNode({
      id: blueprintId,
      kind: 'blueprint',
      name: blueprint.name || blueprint.id,
      props: {
        registryId: blueprint.id,
        role: blueprint.role,
        status: blueprint.status || 'draft',
        version: Number(blueprint.version || 1),
        permissions: [...(blueprint.permissions || [])],
        source: 'legacy-blueprint-registry'
      },
      metadata: { adapterVersion: LEGACY_REGISTRY_ADAPTER_VERSION }
    });

    context.operations.push(nodeOperation(context.graphId, blueprintNode, context.actor));
    context.operations.push(edgeOperation(context.graphId, createGraphEdge({
      id: `edge:${context.rootId}:contains:${blueprintId}`,
      kind: 'contains',
      source: context.rootId,
      target: blueprintId,
      props: { collection: 'blueprints' }
    }), context.actor));
    context.operations.push(edgeOperation(context.graphId, createGraphEdge({
      id: `edge:${blueprintId}:visible:${roleId}`,
      kind: 'visibleTo',
      source: blueprintId,
      target: roleId
    }), context.actor));

    const navigationId = `navigation:${slug(blueprint.id)}`;
    const navigationNode = createGraphNode({
      id: navigationId,
      kind: 'navigation',
      name: `${blueprint.name || blueprint.id} Navigation`,
      props: { items: [...(blueprint.navigation || [])], source: 'legacy-blueprint-registry' }
    });
    context.operations.push(nodeOperation(context.graphId, navigationNode, context.actor));
    context.operations.push(edgeOperation(context.graphId, createGraphEdge({
      id: `edge:${blueprintId}:contains:${navigationId}`,
      kind: 'contains',
      source: blueprintId,
      target: navigationId,
      props: { slot: 'navigation' }
    }), context.actor));

    (blueprint.sections || []).forEach((section, sectionIndex) => {
      const sectionId = `frame:${slug(blueprint.id)}:${slug(section.id || sectionIndex)}`;
      const sectionNode = createGraphNode({
        id: sectionId,
        kind: 'frame',
        name: section.title || section.id || `Section ${sectionIndex + 1}`,
        props: {
          registryId: section.id || null,
          layout: { mode: 'flow', direction: 'vertical', gapToken: 'space.4' },
          source: 'legacy-blueprint-registry'
        }
      });
      context.operations.push(nodeOperation(context.graphId, sectionNode, context.actor));
      context.operations.push(edgeOperation(context.graphId, createGraphEdge({
        id: `edge:${blueprintId}:contains:${sectionId}`,
        kind: 'contains',
        source: blueprintId,
        target: sectionId,
        props: { order: sectionIndex }
      }), context.actor));

      (section.components || []).forEach((componentId, componentIndex) => {
        const definitionId = `component:${slug(componentId)}`;
        if (!context.nodeIds.has(definitionId)) return;
        const instanceId = `instance:${slug(blueprint.id)}:${slug(section.id || sectionIndex)}:${componentIndex}`;
        const instanceNode = createGraphNode({
          id: instanceId,
          kind: 'component-instance',
          name: `${componentId} instance`,
          props: {
            definitionId,
            overrides: {},
            source: 'legacy-blueprint-registry'
          }
        });
        context.operations.push(nodeOperation(context.graphId, instanceNode, context.actor));
        context.operations.push(edgeOperation(context.graphId, createGraphEdge({
          id: `edge:${sectionId}:contains:${instanceId}`,
          kind: 'contains',
          source: sectionId,
          target: instanceId,
          props: { order: componentIndex }
        }), context.actor));
        context.operations.push(edgeOperation(context.graphId, createGraphEdge({
          id: `edge:${instanceId}:instantiates:${definitionId}`,
          kind: 'instantiates',
          source: instanceId,
          target: definitionId
        }), context.actor));
      });
    });

    context.nodeIds.add(blueprintId);
    context.nodeIds.add(navigationId);
  }
}

export function legacyRegistriesToGraph({
  components = [],
  modules = [],
  blueprints = [],
  graphId = 'graph:evaraos-studio',
  name = 'EvaraOS Studio Graph',
  actor = { id: 'legacy-registry-adapter', type: 'system' }
} = {}) {
  const graph = createEvaraGraph({ graphId, name, createdBy: actor.id || 'legacy-registry-adapter' });
  const rootId = 'workspace:evaraos';
  const rootNode = createGraphNode({
    id: rootId,
    kind: 'workspace',
    name: 'EvaraOS',
    props: {
      source: 'legacy-registry-adapter',
      adapterVersion: LEGACY_REGISTRY_ADAPTER_VERSION
    }
  });

  const context = {
    graphId,
    rootId,
    actor,
    operations: [nodeOperation(graphId, rootNode, actor)],
    nodeIds: new Set([rootId]),
    edgeIds: new Set()
  };

  addComponents(components, context);
  addModules(modules, context);
  addBlueprints(blueprints, context);

  const result = applyTransaction(graph, context.operations, { actor });
  return {
    graph: result.graph,
    operations: result.acceptedOperations,
    commitOperation: result.commitOperation,
    adapterVersion: LEGACY_REGISTRY_ADAPTER_VERSION
  };
}

export const LegacyRegistryAdapter = Object.freeze({
  version: LEGACY_REGISTRY_ADAPTER_VERSION,
  convert: legacyRegistriesToGraph
});

if (typeof window !== 'undefined') window.EvaraLegacyRegistryAdapter = LegacyRegistryAdapter;
