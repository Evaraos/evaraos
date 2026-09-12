export const ROLE_PERMISSIONS = {
  owner: ["all"],
  platform_admin: ["all"],
  super_admin: ["all"],

  admin: [
    "dashboard",
    "companies",
    "users",
    "sales_reps",
    "leads",
    "jobs",
    "audit",
    "org",
    "performance",
    "customer_dashboard",
    "settings",
    "profile",
    "security",
    "qa"
  ],

  manager: [
    "dashboard",
    "users",
    "sales_reps",
    "leads",
    "jobs",
    "performance",
    "settings",
    "profile"
  ],

  operations_coordinator: [
    "dashboard",
    "users",
    "jobs",
    "performance",
    "settings",
    "profile"
  ],

  sales_rep: [
    "dashboard",
    "leads",
    "sales_reps",
    "settings",
    "profile"
  ],

  sales: [
    "dashboard",
    "leads",
    "sales_reps",
    "settings",
    "profile"
  ],

  technician: [
    "dashboard",
    "jobs",
    "settings",
    "profile"
  ],

  tech: [
    "dashboard",
    "jobs",
    "settings",
    "profile"
  ],

  hr: [
    "dashboard",
    "users",
    "settings",
    "profile"
  ],

  customer: [
    "customer_dashboard",
    "settings",
    "profile"
  ],

  guest: []
};

export function normalizeRole(role = "") {
  const value = String(role || "").trim().toLowerCase();

  if (value === "super_admin") return "platform_admin";
  if (value === "tech") return "technician";
  if (value === "sales") return "sales_rep";

  return value || "guest";
}

export function getSavedRole() {
  try {
    return (
      localStorage.getItem("evaraos-role") ||
      sessionStorage.getItem("evaraos-role") ||
      localStorage.getItem("evaraos_role") ||
      sessionStorage.getItem("evaraos_role") ||
      "guest"
    );
  } catch {
    return "guest";
  }
}

export function canAccess(role = "guest", section = "") {
  const normalizedRole = normalizeRole(role);
  const normalizedSection = String(section || "").trim();

  const permissions =
    ROLE_PERMISSIONS[normalizedRole] ||
    ROLE_PERMISSIONS[String(role || "").trim().toLowerCase()] ||
    [];

  return permissions.includes("all") || permissions.includes(normalizedSection);
}

export function hasPermission(section = "", role = getSavedRole()) {
  return canAccess(role, section);
}

export function protectPage(section = "", options = {}) {
  if (hasPermission(section)) return true;

  const role = normalizeRole(getSavedRole());

  if (options.silent !== true) {
    alert("You do not have access to this page.");
  }

  if (role === "customer") {
    window.location.href = "/customer_dashboard.html";
    return false;
  }

  if (role === "guest") {
    window.location.href = "/login.html";
    return false;
  }

  window.location.href = "/dashboard.html";
  return false;
}

try {
  window.EvaraRoles = {
    ROLE_PERMISSIONS,
    normalizeRole,
    getSavedRole,
    canAccess,
    hasPermission,
    protectPage
  };
} catch {}