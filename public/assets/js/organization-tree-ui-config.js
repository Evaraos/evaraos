// Evaraos Organization Tree UI
// Visual foundation for offices, vendors, branches, teams, and management-program growth.

export const ORGANIZATION_TREE_UI_VERSION = "2026.05.17-organization-tree-ui";

export const ORGANIZATION_TREE_VIEW_MODES = Object.freeze({
  ecosystem: "ecosystem",
  organization: "organization",
  office: "office",
  vendor: "vendor",
  managementProgram: "management_program",
  leadershipPipeline: "leadership_pipeline"
});

export const ORGANIZATION_TREE_NODE_STATUS = Object.freeze({
  active: "active",
  training: "training",
  scaling: "scaling",
  needsAttention: "needs_attention",
  paused: "paused",
  closed: "closed"
});

export function normalizeTreeNode(node = {}) {
  const type = String(node.type || "organization").toLowerCase();
  const status = String(node.status || "active").toLowerCase();

  return {
    id: node.id || node.uid || `node_${Date.now()}`,
    parentId: node.parentId || null,
    type,
    label: node.label || type.replaceAll("_", " "),
    name: node.name || node.displayName || "Untitled Node",
    status,
    dashboard: node.dashboard || "org.html",
    revenue30Days: Number(node.revenue30Days || 0),
    teamSize: Number(node.teamSize || 0),
    healthScore: Number(node.healthScore || 0),
    leadershipScore: Number(node.leadershipScore || 0),
    createdAtMs: Number(node.createdAtMs || Date.now()),
    updatedAtMs: Number(node.updatedAtMs || Date.now()),
    metadata: node.metadata || {}
  };
}

export function buildOrganizationTree(nodes = []) {
  const normalized = nodes.map(normalizeTreeNode);
  const byId = new Map(normalized.map((node) => [node.id, { ...node, children: [] }]));
  const roots = [];

  byId.forEach((node) => {
    if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId).children.push(node);
    else roots.push(node);
  });

  return {
    roots,
    nodes: [...byId.values()],
    totalNodes: normalized.length,
    generatedAtMs: Date.now(),
    version: ORGANIZATION_TREE_UI_VERSION
  };
}

export function getNodeHealthState(node = {}) {
  const health = Number(node.healthScore || node.leadershipScore || 0);
  const status = String(node.status || "active").toLowerCase();

  if (status === "closed") return "closed";
  if (status === "paused") return "paused";
  if (health >= 90) return "elite";
  if (health >= 80) return "healthy";
  if (health >= 65) return "developing";
  if (health > 0) return "needs_attention";
  return status;
}

export function renderTreeNodeLabel(node = {}) {
  return {
    title: node.name || "Untitled Node",
    eyebrow: node.label || node.type || "Organization Node",
    meta: `${node.teamSize || 0} team • $${Number(node.revenue30Days || 0).toLocaleString()} / 30d`,
    state: getNodeHealthState(node),
    dashboard: node.dashboard || "org.html"
  };
}
