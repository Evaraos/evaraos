// Evaraos App Registry
// Centralized application catalog powering navigation, launcher, command search, and role visibility.

export const APP_REGISTRY_VERSION = "2026.05.17-app-registry-aligned";

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
    title: "Owner Mega Dashboard",
    category: APP_CATEGORIES.intelligence,
    route: "/dashboard.html",
    icon: "◈",
    searchable: true,
    roles: ["owner", "admin"]
  },
  {
    id: "customer-dashboard",
    title: "Customer Dashboard",
    category: APP_CATEGORIES.customer,
    route: "/customer_dashboard.html",
    icon: "◉",
    searchable: true,
    roles: ["customer", "owner", "admin"]
  },
  {
    id: "organization",
    title: "Organization Dashboard",
    category: APP_CATEGORIES.organizations,
    route: "/org.html",
    icon: "◎",
    searchable: true,
    roles: ["owner", "organization", "admin"]
  },
  {
    id: "companies",
    title: "Companies",
    category: APP_CATEGORIES.organizations,
    route: "/companies.html",
    icon: "◌",
    searchable: true,
    roles: ["owner", "admin"]
  },
  {
    id: "users",
    title: "Users",
    category: APP_CATEGORIES.organizations,
    route: "/users.html",
    icon: "◍",
    searchable: true,
    roles: ["owner", "admin", "hr"]
  },
  {
    id: "applications",
    title: "Applications",
    category: APP_CATEGORIES.organizations,
    route: "/applications.html",
    icon: "◐",
    searchable: true,
    roles: ["owner", "admin", "hr"]
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
    id: "leads",
    title: "Leads",
    category: APP_CATEGORIES.operations,
    route: "/leads.html",
    icon: "◇",
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
    id: "field",
    title: "Field Ops",
    category: APP_CATEGORIES.operations,
    route: "/field.html",
    icon: "⬡",
    searchable: true,
    roles: ["owner", "organization", "vendor", "admin", "staff"]
  },
  {
    id: "schedule",
    title: "Schedule",
    category: APP_CATEGORIES.operations,
    route: "/schedule.html",
    icon: "◷",
    searchable: true,
    roles: ["owner", "organization", "vendor", "admin", "staff"]
  },
  {
    id: "operations-map",
    title: "Operations Map",
    category: APP_CATEGORIES.operations,
    route: "/operations_map.html",
    icon: "⬢",
    searchable: true,
    roles: ["owner", "organization", "vendor", "admin"]
  },
  {
    id: "territory-intelligence",
    title: "Territory Intelligence",
    category: APP_CATEGORIES.intelligence,
    route: "/territory_intelligence.html",
    icon: "⬠",
    searchable: true,
    roles: ["owner", "organization", "admin"]
  },
  {
    id: "predictive-ops",
    title: "Predictive Ops",
    category: APP_CATEGORIES.intelligence,
    route: "/predictive_ops.html",
    icon: "✦",
    searchable: true,
    roles: ["owner", "organization", "admin"]
  },
  {
    id: "ai-command",
    title: "AI Command",
    category: APP_CATEGORIES.intelligence,
    route: "/ai_command.html",
    icon: "✧",
    searchable: true,
    roles: ["owner", "organization", "admin"]
  },
  {
    id: "analytics",
    title: "Analytics",
    category: APP_CATEGORIES.intelligence,
    route: "/analytics.html",
    icon: "◬",
    searchable: true,
    roles: ["owner", "organization", "admin"]
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
    id: "ledger",
    title: "Ledger",
    category: APP_CATEGORIES.finance,
    route: "/ledger.html",
    icon: "▤",
    searchable: true,
    roles: ["owner", "organization", "vendor", "admin"]
  },
  {
    id: "payment-ops",
    title: "Payment Ops",
    category: APP_CATEGORIES.finance,
    route: "/payment_ops.html",
    icon: "◫",
    searchable: true,
    roles: ["owner", "organization", "admin"]
  },
  {
    id: "messages",
    title: "Messaging",
    category: APP_CATEGORIES.customer,
    route: "/customer-messaging.html",
    icon: "✉",
    searchable: true,
    roles: ["owner", "organization", "vendor", "admin", "hr", "staff", "customer"]
  },
  {
    id: "service-history",
    title: "Service History",
    category: APP_CATEGORIES.customer,
    route: "/customer-service-history.html",
    icon: "◴",
    searchable: true,
    roles: ["owner", "organization", "vendor", "admin", "staff", "customer"]
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
  const effectiveRole = normalized === "super_admin" ? "owner" : normalized;
  return APP_REGISTRY.filter((app) => app.roles.includes(effectiveRole));
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
      app.category.toLowerCase().includes(normalized) ||
      app.route.toLowerCase().includes(normalized)
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
