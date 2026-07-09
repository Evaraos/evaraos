import {
  assertValidEvaraGraph,
  createEvaraGraph,
  createGraphEdge,
  createGraphNode
} from '../core/evara-graph.js';

const OWNER_VISIBILITY = Object.freeze({
  roles: Object.freeze({
    owner: true,
    admin: true,
    manager: true,
    sales: false,
    technician: false,
    cleaner: false,
    customer: false,
    vendor: false
  })
});

function componentNode({ id, name, componentType, order, span, content, height = 160, bindings = {} }) {
  return createGraphNode({
    id,
    kind: 'component-instance',
    name,
    props: {
      componentType,
      content: { ...content },
      layout: {
        mode: 'grid',
        order,
        span,
        width: Math.round((span / 12) * 1040),
        height,
        minWidth: 160,
        minHeight: 96
      },
      style: {
        radius: componentType === 'hero-block' ? 32 : 24,
        glass: 72,
        tone: componentType === 'hero-block' ? 'accent' : 'neutral'
      },
      visibility: OWNER_VISIBILITY,
      tokenBindings: {
        surface: 'surface.glass.primary',
        radius: componentType === 'hero-block' ? 'radius.2xl' : 'radius.xl'
      },
      dataBindings: { ...bindings }
    },
    metadata: {
      source: 'canvas-sandbox-fixture',
      editable: true
    }
  });
}

function contains(source, target, order) {
  return createGraphEdge({
    id: `edge_contains_${source}_${target}`,
    kind: 'contains',
    source,
    target,
    props: { order }
  });
}

export function createCanvasSandboxFixture() {
  const graph = createEvaraGraph({
    graphId: 'graph_canvas_sandbox_v1',
    name: 'Evara Studio Canvas Sandbox',
    state: 'draft',
    createdBy: 'studio-sandbox',
    metadata: {
      fixture: true,
      source: 'issue-21-canvas-sandbox',
      mutable: true
    }
  });

  const workspace = createGraphNode({
    id: 'workspace_studio_sandbox',
    kind: 'workspace',
    name: 'Evara Studio Sandbox',
    props: { environment: 'sandbox', canonical: false }
  });

  const page = createGraphNode({
    id: 'page_owner_dashboard_sandbox',
    kind: 'page',
    name: 'Owner Dashboard',
    props: {
      route: '/sandbox/owner-dashboard',
      role: 'owner',
      title: 'Owner Dashboard Graph Fixture'
    }
  });

  const frame = createGraphNode({
    id: 'frame_owner_dashboard_content',
    kind: 'frame',
    name: 'Dashboard Content Frame',
    props: {
      layout: {
        mode: 'grid',
        columns: 12,
        gap: 20,
        padding: 28,
        maxWidth: 1180
      }
    }
  });

  const components = [
    componentNode({
      id: 'component_hero',
      name: 'Dashboard Hero',
      componentType: 'hero-block',
      order: 0,
      span: 12,
      height: 250,
      content: {
        eyebrow: 'EVARA GRAPH SANDBOX',
        title: 'Build the operating system through governed visual commands.',
        body: 'This isolated Canvas renders from an Evara Graph fixture and never mutates production configuration.',
        action: 'Explore the Graph'
      }
    }),
    componentNode({
      id: 'component_revenue',
      name: 'Revenue Metric',
      componentType: 'metric-card',
      order: 1,
      span: 3,
      content: { label: 'Revenue', value: '$124,800', trend: '+18.4%' },
      bindings: { value: 'metrics.revenue.total' }
    }),
    componentNode({
      id: 'component_jobs',
      name: 'Jobs Metric',
      componentType: 'metric-card',
      order: 2,
      span: 3,
      content: { label: 'Active Jobs', value: '248', trend: '+12 today' },
      bindings: { value: 'metrics.jobs.active' }
    }),
    componentNode({
      id: 'component_team',
      name: 'Team Metric',
      componentType: 'metric-card',
      order: 3,
      span: 3,
      content: { label: 'Team', value: '42', trend: '96% active' },
      bindings: { value: 'metrics.team.active' }
    }),
    componentNode({
      id: 'component_customers',
      name: 'Customer Metric',
      componentType: 'metric-card',
      order: 4,
      span: 3,
      content: { label: 'Customers', value: '1,284', trend: '+34 this week' },
      bindings: { value: 'metrics.customers.total' }
    }),
    componentNode({
      id: 'component_attention',
      name: 'Attention Card',
      componentType: 'glass-card',
      order: 5,
      span: 4,
      height: 250,
      content: {
        title: 'Today at a glance',
        body: 'Everything requiring the owner’s attention appears here automatically.'
      }
    }),
    componentNode({
      id: 'component_map',
      name: 'Operations Map',
      componentType: 'map-block',
      order: 6,
      span: 8,
      height: 250,
      content: { title: 'Live Operations Map', body: 'Jobs, teams, and service areas.' },
      bindings: { markers: 'jobs.active.locations' }
    })
  ];

  const nodes = [workspace, page, frame, ...components];
  nodes.forEach((node) => { graph.nodes[node.id] = node; });

  const edges = [
    contains(workspace.id, page.id, 0),
    contains(page.id, frame.id, 0),
    ...components.map((node, index) => contains(frame.id, node.id, index))
  ];
  edges.forEach((edge) => { graph.edges[edge.id] = edge; });

  assertValidEvaraGraph(graph);
  return graph;
}

export const CANVAS_SANDBOX_FIXTURE_ID = 'issue-21-canvas-sandbox-v1';
