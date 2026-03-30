export const ROLE_LABELS = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  operations_coordinator: "Operations Coordinator",
  hr: "HR",
  sales_rep: "Sales Rep",
  technician: "Technician",
  customer: "Customer"
};

export const ROLE_ACCESS = {
  super_admin: [
    "overview",
    "users",
    "leads",
    "sales_reps",
    "companies",
    "jobs",
    "customers",
    "settings",
    "audit"
  ],
  admin: [
    "overview",
    "users",
    "leads",
    "sales_reps",
    "companies",
    "jobs",
    "customers",
    "settings"
  ],
  manager: [
    "overview",
    "users",
    "leads",
    "sales_reps",
    "jobs",
    "customers"
  ],
  operations_coordinator: [
    "overview",
    "jobs",
    "customers"
  ],
  hr: [
    "overview",
    "users"
  ],
  sales_rep: [
    "overview",
    "leads"
  ],
  technician: [
    "overview",
    "jobs"
  ],
  customer: [
    "overview"
  ]
};

export function getRoleLabel(role = "") {
  return ROLE_LABELS[role] || "User";
}

export function getAllowedSections(role = "") {
  return ROLE_ACCESS[role] || [];
}

export function canAccess(role = "", section = "") {
  if (!role || !section) return false;
  const allowed = ROLE_ACCESS[role] || [];
  return allowed.includes(section);
}