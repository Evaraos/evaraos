// Evaraos Organization Hierarchy
// Source of truth for owner visibility, organization building, office/branch growth, vendors, and management-program structure.

export const ORGANIZATION_HIERARCHY_VERSION = "2026.05.17-phase16-organization-tree";

export const ORGANIZATION_NODE_TYPES = Object.freeze({
  owner: "owner",
  ecosystem: "ecosystem",
  organization: "organization",
  office: "office",
  branch: "branch",
  vendorOrganization: "vendor_organization",
  vendor: "vendor",
  managementProgram: "management_program",
  team: "team",
  staff: "staff",
  customer: "customer"
});

export const ORGANIZATION_NODE_LABELS = Object.freeze({
  owner: "Owner",
  ecosystem: "Evaraos Ecosystem",
  organization: "Organization",
  office: "Office",
  branch: "Branch",
  vendor_organization: "Vendor Organization",
  vendor: "Vendor",
  management_program: "Management Program",
  team: "Team",
  staff: "Staff",
  customer: "Customer"
});

export const OWNER_VISIBILITY_SCOPE = Object.freeze({
  canSeeEverything: true,
  canSeeAllDashboards: true,
  canSeeAllOrganizations: true,
  canSeeAllOffices: true,
  canSeeAllBranches: true,
  canSeeAllVendors: true,
  canSeeAllManagementPrograms: true,
  canSeeAllPayroll: true,
  canSeeAllHr: true,
  canSeeAllOperations: true,
  canSeeAllRevenue: true
});

export const ORGANIZATION_PERMISSIONS = Object.freeze({
  organization: {
    canBuildOffices: true,
    canTrainOffices: true,
    canBuildBranches: true,
    canRecruitLeaders: true,
    canManageVendors: true,
    canRunManagementProgram: true,
    canViewDownlinePerformance: true
  },
  vendor: {
    canBuildOwnOrganization: true,
    canRecruitTeam: true,
    canManageServiceDelivery: true,
    canUseManagementProgram: true,
    canViewOwnDownline: true
  },
  office: {
    canTrainStaff: true,
    canManageLocalTeams: true,
    canTrackLocalRevenue: true,
    canDispatchLocalJobs: true
  },
  branch: {
    canManageAssignedMarket: true,
    canTrackBranchPerformance: true,
    canEscalateToOrganization: true
  }
});

export const ORGANIZATION_DASHBOARD_ROUTES = Object.freeze({
  owner: "dashboard.html",
  organization: "org.html",
  vendor: "vendor-dashboard.html",
  admin: "admin-dashboard.html",
  hr: "hr-dashboard.html",
  customer: "customer_dashboard.html"
});

export function createHierarchyNode({
  id,
  type,
  name,
  parentId = null,
  ownerUid = null,
  companyId = null,
  status = "active",
  metadata = {}
} = {}) {
  const nodeType = type || ORGANIZATION_NODE_TYPES.organization;

  return {
    id: id || crypto.randomUUID?.() || `node_${Date.now()}`,
    type: nodeType,
    label: ORGANIZATION_NODE_LABELS[nodeType] || "Organization Node",
    name: name || ORGANIZATION_NODE_LABELS[nodeType] || "Untitled Node",
    parentId,
    ownerUid,
    companyId,
    status,
    metadata,
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
    version: ORGANIZATION_HIERARCHY_VERSION
  };
}

export function canNodeBuildOrganization(nodeType = "vendor") {
  const type = String(nodeType || "vendor").toLowerCase();
  return ["organization", "vendor", "vendor_organization", "management_program", "office"].includes(type);
}

export function dashboardForNodeType(nodeType = "customer") {
  const type = String(nodeType || "customer").toLowerCase();
  if (["owner", "ecosystem"].includes(type)) return ORGANIZATION_DASHBOARD_ROUTES.owner;
  if (["organization", "office", "branch", "vendor_organization"].includes(type)) return ORGANIZATION_DASHBOARD_ROUTES.organization;
  if (["vendor", "management_program"].includes(type)) return ORGANIZATION_DASHBOARD_ROUTES.vendor;
  return ORGANIZATION_DASHBOARD_ROUTES.customer;
}

export function summarizeHierarchy(nodes = []) {
  const summary = {
    totalNodes: nodes.length,
    organizations: 0,
    offices: 0,
    branches: 0,
    vendors: 0,
    managementPrograms: 0,
    teams: 0,
    staff: 0,
    customers: 0
  };

  nodes.forEach((node) => {
    const type = String(node.type || "").toLowerCase();
    if (type === "organization" || type === "vendor_organization") summary.organizations += 1;
    if (type === "office") summary.offices += 1;
    if (type === "branch") summary.branches += 1;
    if (type === "vendor") summary.vendors += 1;
    if (type === "management_program") summary.managementPrograms += 1;
    if (type === "team") summary.teams += 1;
    if (type === "staff") summary.staff += 1;
    if (type === "customer") summary.customers += 1;
  });

  return summary;
}
