// Evaraos Unified Platform Economics
// Source of truth for default ecosystem splits, organization building, and management-program economics.

export const EVARAOS_ECONOMICS_VERSION = "2026.05.17-unified-60-40";

export const DEFAULT_PLATFORM_SPLIT = Object.freeze({
  vendorOrOrganizationPercent: 60,
  evaraosPercent: 40,
  model: "unified_60_40",
  description:
    "Default Evaraos ecosystem split: 60% to the vendor/organization side and 40% to Evaraos for platform, HR automation, payroll automation, routing, dispatch, software infrastructure, training systems, and operating support."
});

export const EVARAOS_PLATFORM_SHARE_ALLOCATION = Object.freeze({
  platformInfrastructurePercent: 12,
  payrollAutomationPercent: 7,
  hrAutomationPercent: 6,
  operationsAutomationPercent: 6,
  trainingAndManagementProgramPercent: 5,
  supportAndCompliancePercent: 4
});

export const ORGANIZATION_CAPABILITIES = Object.freeze({
  canBuildOffice: true,
  canRecruitTeam: true,
  canTrainStaff: true,
  canManageVendors: true,
  canOverseeBranches: true,
  canOperateManagementProgram: true,
  canRequestPayrollAutomation: true,
  canUseHrAutomation: true
});

export const DASHBOARD_SCOPE_MAP = Object.freeze({
  owner: {
    dashboard: "dashboard.html",
    label: "Owner Mega Dashboard",
    scope: "global_ecosystem",
    canSeeAllDashboards: true,
    canSeeAllOrganizations: true,
    canSeeAllVendors: true,
    canSeeAllOffices: true
  },
  organization: {
    dashboard: "org.html",
    label: "Organization Dashboard",
    scope: "organization_network",
    canBuildOrganization: true,
    canOverseeOfficesBuiltAndTrained: true,
    canOverseeVendorOrganizations: true
  },
  vendor: {
    dashboard: "vendor-dashboard.html",
    label: "Vendor / Management Program Dashboard",
    scope: "vendor_management_program",
    canBuildOrganization: true,
    canOperateManagementProgram: true
  },
  admin: {
    dashboard: "admin-dashboard.html",
    label: "Admin Dashboard",
    scope: "admin_operations"
  },
  hr: {
    dashboard: "hr-dashboard.html",
    label: "HR Dashboard",
    scope: "hr_automation"
  },
  customer: {
    dashboard: "customer_dashboard.html",
    label: "Customer Dashboard",
    scope: "customer_portal"
  }
});

export function calculateUnifiedSplit(grossAmount = 0, overrides = {}) {
  const amount = Number(grossAmount) || 0;
  const vendorPercent = Number(overrides.vendorOrOrganizationPercent ?? DEFAULT_PLATFORM_SPLIT.vendorOrOrganizationPercent);
  const evaraosPercent = Number(overrides.evaraosPercent ?? DEFAULT_PLATFORM_SPLIT.evaraosPercent);
  const vendorOrOrganizationAmount = Math.round(amount * (vendorPercent / 100) * 100) / 100;
  const evaraosAmount = Math.round(amount * (evaraosPercent / 100) * 100) / 100;

  return {
    grossAmount: amount,
    model: overrides.model || DEFAULT_PLATFORM_SPLIT.model,
    vendorOrOrganizationPercent: vendorPercent,
    evaraosPercent,
    vendorOrOrganizationAmount,
    evaraosAmount,
    platformShareAllocation: EVARAOS_PLATFORM_SHARE_ALLOCATION,
    version: EVARAOS_ECONOMICS_VERSION
  };
}

export function getDashboardForRole(role = "customer") {
  const normalized = String(role || "customer").toLowerCase();
  if (["owner", "super_admin"].includes(normalized)) return DASHBOARD_SCOPE_MAP.owner.dashboard;
  if (["organization", "organization_owner", "office_owner", "branch_owner"].includes(normalized)) return DASHBOARD_SCOPE_MAP.organization.dashboard;
  if (["vendor", "lead_vendor", "service_vendor", "management_program"].includes(normalized)) return DASHBOARD_SCOPE_MAP.vendor.dashboard;
  if (["admin"].includes(normalized)) return DASHBOARD_SCOPE_MAP.admin.dashboard;
  if (["hr", "hr_manager"].includes(normalized)) return DASHBOARD_SCOPE_MAP.hr.dashboard;
  return DASHBOARD_SCOPE_MAP.customer.dashboard;
}
