export const ROLE_ACCESS = {
  super_admin: ["overview", "admin", "settings", "leads", "customers", "jobs", "users", "sales_reps", "companies"],
  admin: ["overview", "admin", "settings", "leads", "customers", "jobs", "users", "sales_reps"],
  manager: ["overview", "leads", "customers", "jobs", "users"],
  operations_coordinator: ["overview", "leads", "customers", "jobs"],
  sales_rep: ["overview", "leads", "customers", "jobs"],
  technician: ["overview", "jobs"],
  hr: ["overview", "users", "sales_reps"],
  customer: ["overview"]
};

export function canAccess(role, section) {
  if (!role || !ROLE_ACCESS[role]) return false;
  return ROLE_ACCESS[role].includes(section);
}

export function getAllowedSections(role) {
  if (!role || !ROLE_ACCESS[role]) return [];
  return ROLE_ACCESS[role];
}

export function getRoleLabel(role) {
  const labels = {
    super_admin: "Super Admin",
    admin: "Admin",
    manager: "Manager",
    operations_coordinator: "Operations Coordinator",
    sales_rep: "Sales Rep",
    technician: "Technician",
    hr: "HR",
    customer: "Customer"
  };

  return labels[role] || role;
}

export function getRoleDefaults(role, isOwner = false) {
  if (isOwner || role === "super_admin") {
    return {
      role: "super_admin",
      organizationLevel: 1,
      companyAccessLevel: "parent",
      permissions: ["all"],
      approvalStatus: "approved"
    };
  }

  if (role === "admin") {
    return {
      role: "admin",
      organizationLevel: 2,
      companyAccessLevel: "subsidiary",
      permissions: [
        "manage_company",
        "manage_staff",
        "approve_staff",
        "view_reports",
        "manage_leads",
        "create_leads",
        "convert_leads",
        "archive_leads",
        "delete_leads",
        "manage_jobs"
      ],
      approvalStatus: "pending"
    };
  }

  if (role === "manager") {
    return {
      role: "manager",
      organizationLevel: 3,
      companyAccessLevel: "subsidiary",
      permissions: [
        "view_leads",
        "create_leads",
        "edit_leads",
        "convert_leads",
        "view_jobs",
        "update_jobs"
      ],
      approvalStatus: "pending"
    };
  }

  if (role === "operations_coordinator") {
    return {
      role: "operations_coordinator",
      organizationLevel: 3,
      companyAccessLevel: "subsidiary",
      permissions: [
        "view_leads",
        "create_leads",
        "edit_leads",
        "view_jobs",
        "update_jobs"
      ],
      approvalStatus: "pending"
    };
  }

  if (role === "sales_rep") {
    return {
      role: "sales_rep",
      organizationLevel: 3,
      companyAccessLevel: "subsidiary",
      permissions: [
        "view_leads",
        "create_leads",
        "edit_leads",
        "convert_leads",
        "view_jobs"
      ],
      approvalStatus: "pending"
    };
  }

  if (role === "technician") {
    return {
      role: "technician",
      organizationLevel: 3,
      companyAccessLevel: "subsidiary",
      permissions: [
        "view_jobs",
        "update_jobs"
      ],
      approvalStatus: "pending"
    };
  }

  if (role === "hr") {
    return {
      role: "hr",
      organizationLevel: 3,
      companyAccessLevel: "subsidiary",
      permissions: [
        "manage_staff",
        "approve_staff",
        "view_reports"
      ],
      approvalStatus: "pending"
    };
  }

  return {
    role: "customer",
    organizationLevel: 4,
    companyAccessLevel: "subsidiary",
    permissions: [
      "view_own_data",
      "edit_own_profile",
      "view_own_services",
      "request_service_changes"
    ],
    approvalStatus: "approved"
  };
}