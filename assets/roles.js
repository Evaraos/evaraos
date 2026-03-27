export const ROLE_ACCESS = {
  super_admin: ["overview", "admin", "settings", "leads", "customers", "jobs", "users", "sales_reps"],
  admin: ["overview", "admin", "settings", "leads", "customers", "jobs", "sales_reps"],
  manager: ["overview", "leads", "customers", "jobs"],
  operations_coordinator: ["overview", "customers", "jobs"],
  sales_rep: ["overview", "leads", "customers"],
  technician: ["overview", "jobs"],
  hr: ["overview", "admin", "sales_reps"],
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