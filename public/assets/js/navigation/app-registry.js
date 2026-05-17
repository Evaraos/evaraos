// Evaraos App Registry
// Centralized application catalog powering navigation, launcher, command search, and role visibility.

export const APP_REGISTRY_VERSION = "2026.05.17-app-registry";

export const APP_CATEGORIES = Object.freeze({
  operations: "operations",
  organizations: "organizations",
  finance: "finance",
  customer: "customer",
  intelligence: "intelligence",
  system: "system"
});

export const APP_ROLES = Object.freeze({
  owner: "owner",
  organization: "organization",
  vendor: "vendor",
  admin: "admin",
  hr: "hr",
  staff: "staff",
  customer: "customer"
});

export const APP_REGISTRY = Object.freeze([
  {
    id: "dashboard",
    title: "Executive Dashboard",
    category: APP_CATEGORIES.intelligence,
    route: "/dashboard.html",
    icon: "◈",
    searchable: true,
    roles: ["owner", "admin"]
  },
  {
    id: "organizations",
    title: "Organizations",
    category: APP_CATEGORIES.organizations,
    route: "/organizations.html",
    icon: "◎",
    searchable: true,
    roles: ["owner", "organization", "admin"]
  },
  {
    id: "vendors",
    title: "Vendors",
    category: APP_CATEGORIES.organizations,
    route: "/vendors.html",
    icon: "◐",
    searchable: true,
    roles: ["owner", "vendor", "admin"]
  },
  {
    id: "jobs",
    title: "Jobs",
    category: APP_CATEGORIES.operations,
    route: "/jobs.html",
    icon: "◒",
    searchable: true,
    roles: ["owner", "organization", "vendor", "admin", "staff"]
  },
  {
    id: "dispatch",
    title: "Dispatch",
    category: APP_CATEGORIES.operations,
    route: "/dispatch.html",
    icon: "◉",
    searchable: true,
    roles: ["owner", "organization", "admin"]
  },
  {
    id: "operations-map",
    title: "Operations Map",
    category: APP_CATEGORIES.operations,
    route: "/operations-map.html",
    icon: "⬢",
    searchable: true,
    roles: ["owner", "organization", "vendor", "admin"]
  },
  {
    id: "revenue",
    title: "Revenue",
    category: APP_CATEGORIES.finance,
    route: "/revenue.html",
    icon: "$",
    searchable: true,
    roles: ["owner", "organization", "vendor", "admin"]
  },
  {
    id: "payroll",
    title: "Payroll",
    category: APP_CATEGORIES.finance,
    route: "/payroll.html",
    icon: "◭",
    searchable: true,
    roles: ["owner", "organization", "admin", "hr"]
  },
  {
    id: "crm",
    title: "Customer CRM",
    category: APP_CATEGORIES.customer,
    route: "/customers.html",
    icon: "☰",
    searchable: true,
    roles: ["owner", "organization", "vendor", "admin", "staff"]
  },
  {
    id: "messages",
    title: "Messaging",
    category: APP_CATEGORIES.customer,
    route: "/customer-messaging.html",
    icon: "✉",
    searchable: true,
    roles: ["owner", "organization", "vendor", "admin", "staff", "customer"]
  },
  {
    id: "ai",
    title: "AI Intelligence",
    category: APP_CATEGORIES.intelligence,
    route: "/ai-intelligence.html",
    icon: "✦",
    searchable: true,
    roles: ["owner", "organization", "admin"]
  },
  {
    id: "settings",
    title: "Settings",
    category: APP_CATEGORIES.system,
    route: "/settings.html",
    icon: "⚙",
    searchable: true,
    roles: ["owner", "organization", "vendor", "admin", "hr", "staff", "customer"]
  }
]);

export function appsForRole(role = "customer") {
  const normalized = String(role || "customer").toLowerCase();
  return APP_REGISTRY.filter((app) => app.roles.includes(normalized));
}

export function appsByCategory(role = "customer") {
  return appsForRole(role).reduce((groups, app) => {
    if (!groups[app.category]) groups[app.category] = [];
    groups[app.category].push(app);
    return groups;
  }, {});
}

export function searchApps(query = "", role = "customer") {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) return appsForRole(role);

  return appsForRole(role).filter((app) => {
    return (
      app.title.toLowerCase().includes(normalized) ||
      app.id.toLowerCase().includes(normalized) ||
      app.category.toLowerCase().includes(normalized)
    );
  });
}

export function appById(id = "") {
  return APP_REGISTRY.find((app) => app.id === id) || null;
}

window.EvaraAppRegistry = {
  version: APP_REGISTRY_VERSION,
  APP_CATEGORIES,
  APP_ROLES,
  APP_REGISTRY,
  appsForRole,
  appsByCategory,
  searchApps,
  appById
};
