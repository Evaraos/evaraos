// Evaraos App Registry
// Centralized application catalog powering navigation, launcher, command search, and role visibility.

export const APP_REGISTRY_VERSION = "2026.05.20-app-registry-command-aligned";

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

const ROLE_ALIASES = Object.freeze({
  super_admin: APP_ROLES.owner,
  owner: APP_ROLES.owner,
  admin: APP_ROLES.admin,
  manager: APP_ROLES.admin,
  operations_manager: APP_ROLES.admin,
  operations_coordinator: APP_ROLES.admin,
  dispatcher: APP_ROLES.admin,
  field_manager: APP_ROLES.admin,
  organization: APP_ROLES.organization,
  organization_owner: APP_ROLES.organization,
  office_owner: APP_ROLES.organization,
  branch_owner: APP_ROLES.organization,
  vendor: APP_ROLES.vendor,
  lead_vendor: APP_ROLES.vendor,
  service_vendor: APP_ROLES.vendor,
  management_program: APP_ROLES.vendor,
  hr: APP_ROLES.hr,
  hr_manager: APP_ROLES.hr,
  staff: APP_ROLES.staff,
  sales: APP_ROLES.staff,
  sales_rep: APP_ROLES.staff,
  technician: APP_ROLES.staff,
  lead_technician: APP_ROLES.staff,
  cleaner: APP_ROLES.staff,
  lead_cleaner: APP_ROLES.staff,
  field_staff: APP_ROLES.staff,
  crew_lead: APP_ROLES.staff,
  customer_support: APP_ROLES.staff,
  quality_control: APP_ROLES.staff,
  customer: APP_ROLES.customer
});

function app(config) {
  return Object.freeze({
    searchable: true,
    aliases: [],
    ...config
  });
}

export const APP_REGISTRY = Object.freeze([
  app({
    id: "dashboard",
    title: "Owner Mega Dashboard",
    category: APP_CATEGORIES.intelligence,
    route: "/dashboard.html",
    icon: "◈",
    aliases: ["dashboard", "command", "executive", "owner", "mega dashboard", "home base"],
    roles: ["owner", "admin"]
  }),
  app({
    id: "customer-dashboard",
    title: "Customer Dashboard",
    category: APP_CATEGORIES.customer,
    route: "/customer_dashboard.html",
    icon: "◉",
    aliases: ["customer", "customers", "customer portal", "client portal", "portal"],
    roles: ["customer", "owner", "admin"]
  }),
  app({
    id: "organization",
    title: "Organization Dashboard",
    category: APP_CATEGORIES.organizations,
    route: "/org.html",
    icon: "◎",
    aliases: ["organization", "org", "office", "branch", "subsidiary"],
    roles: ["owner", "organization", "admin"]
  }),
  app({
    id: "companies",
    title: "Companies",
    category: APP_CATEGORIES.organizations,
    route: "/companies.html",
    icon: "◌",
    aliases: ["companies", "company", "llc", "llcs", "subsidiaries", "brands"],
    roles: ["owner", "admin"]
  }),
  app({
    id: "users",
    title: "Users",
    category: APP_CATEGORIES.organizations,
    route: "/users.html",
    icon: "◍",
    aliases: ["users", "people", "team", "employees", "staff list", "accounts"],
    roles: ["owner", "admin", "hr"]
  }),
  app({
    id: "applications",
    title: "Applications",
    category: APP_CATEGORIES.organizations,
    route: "/applications.html",
    icon: "◐",
    aliases: ["applications", "applicants", "staff applications", "hiring", "onboarding"],
    roles: ["owner", "admin", "hr"]
  }),
  app({
    id: "jobs",
    title: "Jobs",
    category: APP_CATEGORIES.operations,
    route: "/jobs.html",
    icon: "◒",
    aliases: ["jobs", "job", "work", "work orders", "service jobs", "crew jobs"],
    roles: ["owner", "organization", "vendor", "admin", "staff"]
  }),
  app({
    id: "leads",
    title: "Leads",
    category: APP_CATEGORIES.operations,
    route: "/leads.html",
    icon: "◇",
    aliases: ["leads", "lead", "pipeline", "sales", "prospects", "d2d"],
    roles: ["owner", "organization", "vendor", "admin", "staff"]
  }),
  app({
    id: "dispatch",
    title: "Dispatch",
    category: APP_CATEGORIES.operations,
    route: "/dispatch.html",
    icon: "◉",
    aliases: ["dispatch", "dispatcher", "assign", "assignments", "route jobs"],
    roles: ["owner", "organization", "admin"]
  }),
  app({
    id: "field",
    title: "Field Ops",
    category: APP_CATEGORIES.operations,
    route: "/field.html",
    icon: "⬡",
    aliases: ["field", "field ops", "crew", "crews", "technicians", "cleaners"],
    roles: ["owner", "organization", "vendor", "admin", "staff"]
  }),
  app({
    id: "schedule",
    title: "Schedule",
    category: APP_CATEGORIES.operations,
    route: "/schedule.html",
    icon: "◷",
    aliases: ["schedule", "calendar", "bookings", "appointments", "availability"],
    roles: ["owner", "organization", "vendor", "admin", "staff"]
  }),
  app({
    id: "operations-map",
    title: "Operations Map",
    category: APP_CATEGORIES.operations,
    route: "/operations_map.html",
    icon: "⬢",
    aliases: ["map", "maps", "operations map", "territory map", "live map", "gps"],
    roles: ["owner", "organization", "vendor", "admin"]
  }),
  app({
    id: "territory-intelligence",
    title: "Territory Intelligence",
    category: APP_CATEGORIES.intelligence,
    route: "/territory_intelligence.html",
    icon: "⬠",
    aliases: ["territory", "territories", "territory intelligence", "market intelligence"],
    roles: ["owner", "organization", "admin"]
  }),
  app({
    id: "predictive-ops",
    title: "Predictive Ops",
    category: APP_CATEGORIES.intelligence,
    route: "/predictive_ops.html",
    icon: "✦",
    aliases: ["predictive", "forecast", "ai ops", "smart ops", "prediction"],
    roles: ["owner", "organization", "admin"]
  }),
  app({
    id: "ai-command",
    title: "AI Command",
    category: APP_CATEGORIES.intelligence,
    route: "/ai_command.html",
    icon: "✧",
    aliases: ["ai", "ai command", "assistant", "command palette", "ask evaraos"],
    roles: ["owner", "organization", "admin"]
  }),
  app({
    id: "analytics",
    title: "Analytics",
    category: APP_CATEGORIES.intelligence,
    route: "/analytics.html",
    icon: "◬",
    aliases: ["analytics", "reports", "reporting", "metrics", "data"],
    roles: ["owner", "organization", "admin"]
  }),
  app({
    id: "revenue",
    title: "Revenue",
    category: APP_CATEGORIES.finance,
    route: "/revenue.html",
    icon: "$",
    aliases: ["revenue", "money", "sales revenue", "income", "finance"],
    roles: ["owner", "organization", "vendor", "admin"]
  }),
  app({
    id: "payroll",
    title: "Payroll",
    category: APP_CATEGORIES.finance,
    route: "/payroll.html",
    icon: "◭",
    aliases: ["payroll", "pay", "workers pay", "employee pay", "contractor pay"],
    roles: ["owner", "organization", "admin", "hr"]
  }),
  app({
    id: "ledger",
    title: "Ledger",
    category: APP_CATEGORIES.finance,
    route: "/ledger.html",
    icon: "▤",
    aliases: ["ledger", "books", "transactions", "accounting", "records"],
    roles: ["owner", "organization", "vendor", "admin"]
  }),
  app({
    id: "payment-ops",
    title: "Payment Ops",
    category: APP_CATEGORIES.finance,
    route: "/payment_ops.html",
    icon: "◫",
    aliases: ["payments", "payment ops", "stripe", "payouts", "settlement"],
    roles: ["owner", "organization", "admin"]
  }),
  app({
    id: "messages",
    title: "Messaging",
    category: APP_CATEGORIES.customer,
    route: "/customer-messaging.html",
    icon: "✉",
    aliases: ["messages", "messaging", "chat", "inbox", "customer messages"],
    roles: ["owner", "organization", "vendor", "admin", "hr", "staff", "customer"]
  }),
  app({
    id: "service-history",
    title: "Service History",
    category: APP_CATEGORIES.customer,
    route: "/customer-service-history.html",
    icon: "◴",
    aliases: ["history", "service history", "past jobs", "completed work", "customer history"],
    roles: ["owner", "organization", "vendor", "admin", "staff", "customer"]
  }),
  app({
    id: "settings",
    title: "Settings",
    category: APP_CATEGORIES.system,
    route: "/settings.html",
    icon: "⚙",
    aliases: ["settings", "system", "preferences", "profile", "account", "security"],
    roles: ["owner", "organization", "vendor", "admin", "hr", "staff", "customer"]
  })
]);

export function normalizeRole(role = "customer") {
  const normalized = String(role || "customer").trim().toLowerCase();
  return ROLE_ALIASES[normalized] || APP_ROLES.customer;
}

export function normalizeQuery(query = "") {
  return String(query || "")
    .trim()
    .toLowerCase()
    .replace(/^(open|go to|show|take me to|launch|view|find)\s+/, "")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ");
}

function searchableText(app) {
  return [
    app.title,
    app.id,
    app.category,
    app.route,
    ...(app.aliases || [])
  ].join(" ").toLowerCase();
}

function appScore(app, query = "") {
  const normalized = normalizeQuery(query);
  if (!normalized) return 1;

  const title = app.title.toLowerCase();
  const id = app.id.toLowerCase().replaceAll("-", " ");
  const category = app.category.toLowerCase();
  const aliases = (app.aliases || []).map((alias) => alias.toLowerCase());
  const text = searchableText(app);

  if (title === normalized) return 120;
  if (id === normalized) return 112;
  if (aliases.includes(normalized)) return 108;
  if (title.startsWith(normalized)) return 90;
  if (aliases.some((alias) => alias.startsWith(normalized))) return 82;
  if (title.includes(normalized)) return 70;
  if (aliases.some((alias) => alias.includes(normalized))) return 64;
  if (id.includes(normalized)) return 48;
  if (category.includes(normalized)) return 32;
  if (text.includes(normalized)) return 22;

  return 0;
}

export function appsForRole(role = "customer") {
  const effectiveRole = normalizeRole(role);
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
  const normalized = normalizeQuery(query);
  const apps = appsForRole(role).filter((app) => app.searchable !== false);

  if (!normalized) return apps;

  return apps
    .map((app) => ({ ...app, score: appScore(app, normalized) }))
    .filter((app) => app.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

export function appById(id = "") {
  const normalized = String(id || "").trim().toLowerCase();
  return APP_REGISTRY.find((app) => app.id === normalized) || null;
}

export function appByRoute(route = "") {
  const normalized = String(route || "").trim().toLowerCase();
  return APP_REGISTRY.find((app) => app.route.toLowerCase() === normalized) || null;
}

export function primaryAppForCategory(category = "", role = "customer") {
  const groups = appsByCategory(role);
  return (groups[category] || [])[0] || null;
}

window.EvaraAppRegistry = {
  version: APP_REGISTRY_VERSION,
  APP_CATEGORIES,
  APP_ROLES,
  APP_REGISTRY,
  normalizeRole,
  normalizeQuery,
  appsForRole,
  appsByCategory,
  searchApps,
  appById,
  appByRoute,
  primaryAppForCategory
};
