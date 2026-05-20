// Evaraos App Registry
// Centralized application catalog powering navigation, launcher, command search, role hierarchy, and dashboard visibility.

export const APP_REGISTRY_VERSION = "2026.05.20-role-hierarchy-restored";

export const APP_CATEGORIES = Object.freeze({
  operations: "operations",
  organizations: "organizations",
  finance: "finance",
  customer: "customer",
  intelligence: "intelligence",
  system: "system"
});

export const ROLE_GROUPS = Object.freeze({
  executive: "Executive",
  organization: "Organization / LLC",
  management: "Management",
  vendor: "Vendor",
  staff: "Staff",
  customer: "Customer"
});

export const APP_ROLES = Object.freeze({
  owner: "owner",
  super_admin: "super_admin",
  admin: "admin",
  executive: "executive",
  organization_owner: "organization_owner",
  branch_owner: "branch_owner",
  office_owner: "office_owner",
  operations_manager: "operations_manager",
  operations_coordinator: "operations_coordinator",
  field_manager: "field_manager",
  sales_manager: "sales_manager",
  dispatch_manager: "dispatch_manager",
  dispatcher: "dispatcher",
  finance_manager: "finance_manager",
  hr_manager: "hr_manager",
  hr: "hr",
  lead_vendor: "lead_vendor",
  service_vendor: "service_vendor",
  vendor: "vendor",
  management_program: "management_program",
  sales_rep: "sales_rep",
  technician: "technician",
  lead_technician: "lead_technician",
  cleaner: "cleaner",
  lead_cleaner: "lead_cleaner",
  field_staff: "field_staff",
  crew_lead: "crew_lead",
  customer_support: "customer_support",
  quality_control: "quality_control",
  staff: "staff",
  customer: "customer"
});

export const ROLE_DEFINITIONS = Object.freeze({
  owner: { label: "Owner / Founder", group: "executive", level: 100, dashboards: "all" },
  super_admin: { label: "Super Admin", group: "executive", level: 95, dashboards: "all" },
  admin: { label: "Admin", group: "executive", level: 90, dashboards: "executive" },
  executive: { label: "Executive", group: "executive", level: 88, dashboards: "executive" },
  organization_owner: { label: "Organization Owner", group: "organization", level: 80, dashboards: "organization" },
  branch_owner: { label: "Branch Owner", group: "organization", level: 76, dashboards: "organization" },
  office_owner: { label: "Office Owner", group: "organization", level: 74, dashboards: "organization" },
  operations_manager: { label: "Operations Manager", group: "management", level: 70, dashboards: "operations" },
  operations_coordinator: { label: "Operations Coordinator", group: "management", level: 66, dashboards: "operations" },
  field_manager: { label: "Field Manager", group: "management", level: 64, dashboards: "operations" },
  sales_manager: { label: "Sales Manager", group: "management", level: 64, dashboards: "sales" },
  dispatch_manager: { label: "Dispatch Manager", group: "management", level: 63, dashboards: "operations" },
  dispatcher: { label: "Dispatcher", group: "management", level: 58, dashboards: "dispatch" },
  finance_manager: { label: "Finance Manager", group: "management", level: 62, dashboards: "finance" },
  hr_manager: { label: "HR Manager", group: "management", level: 62, dashboards: "people" },
  hr: { label: "HR", group: "management", level: 56, dashboards: "people" },
  lead_vendor: { label: "Lead Vendor", group: "vendor", level: 50, dashboards: "vendor" },
  service_vendor: { label: "Service Vendor", group: "vendor", level: 50, dashboards: "vendor" },
  vendor: { label: "Vendor", group: "vendor", level: 48, dashboards: "vendor" },
  management_program: { label: "Management Program", group: "vendor", level: 46, dashboards: "training" },
  sales_rep: { label: "Sales Rep", group: "staff", level: 40, dashboards: "sales" },
  technician: { label: "Technician", group: "staff", level: 38, dashboards: "field" },
  lead_technician: { label: "Lead Technician", group: "staff", level: 42, dashboards: "field" },
  cleaner: { label: "Cleaner", group: "staff", level: 34, dashboards: "field" },
  lead_cleaner: { label: "Lead Cleaner", group: "staff", level: 40, dashboards: "field" },
  field_staff: { label: "Field Staff", group: "staff", level: 34, dashboards: "field" },
  crew_lead: { label: "Crew Lead", group: "staff", level: 42, dashboards: "field" },
  customer_support: { label: "Customer Support", group: "staff", level: 38, dashboards: "support" },
  quality_control: { label: "Quality Control", group: "staff", level: 38, dashboards: "quality" },
  staff: { label: "Staff", group: "staff", level: 32, dashboards: "staff" },
  customer: { label: "Customer", group: "customer", level: 10, dashboards: "customer" }
});

const ROLE_ALIASES = Object.freeze({
  owner: APP_ROLES.owner,
  founder: APP_ROLES.owner,
  ceo: APP_ROLES.owner,
  super_admin: APP_ROLES.super_admin,
  superadmin: APP_ROLES.super_admin,
  admin: APP_ROLES.admin,
  executive: APP_ROLES.executive,
  manager: APP_ROLES.operations_manager,
  management: APP_ROLES.operations_manager,
  organization: APP_ROLES.organization_owner,
  organization_owner: APP_ROLES.organization_owner,
  org_owner: APP_ROLES.organization_owner,
  llc_owner: APP_ROLES.organization_owner,
  branch_owner: APP_ROLES.branch_owner,
  office_owner: APP_ROLES.office_owner,
  operations_manager: APP_ROLES.operations_manager,
  operations_coordinator: APP_ROLES.operations_coordinator,
  dispatcher: APP_ROLES.dispatcher,
  dispatch_manager: APP_ROLES.dispatch_manager,
  field_manager: APP_ROLES.field_manager,
  sales_manager: APP_ROLES.sales_manager,
  finance_manager: APP_ROLES.finance_manager,
  hr: APP_ROLES.hr,
  hr_manager: APP_ROLES.hr_manager,
  vendor: APP_ROLES.vendor,
  lead_vendor: APP_ROLES.lead_vendor,
  service_vendor: APP_ROLES.service_vendor,
  management_program: APP_ROLES.management_program,
  staff: APP_ROLES.staff,
  sales: APP_ROLES.sales_rep,
  sales_rep: APP_ROLES.sales_rep,
  technician: APP_ROLES.technician,
  lead_technician: APP_ROLES.lead_technician,
  cleaner: APP_ROLES.cleaner,
  lead_cleaner: APP_ROLES.lead_cleaner,
  field_staff: APP_ROLES.field_staff,
  crew_lead: APP_ROLES.crew_lead,
  customer_support: APP_ROLES.customer_support,
  quality_control: APP_ROLES.quality_control,
  customer: APP_ROLES.customer
});

function roleLevel(role = "customer") {
  return ROLE_DEFINITIONS[normalizeRole(role)]?.level || ROLE_DEFINITIONS.customer.level;
}

function canSee(role, minimumRole = "customer") {
  return roleLevel(role) >= roleLevel(minimumRole);
}

function app(config) {
  return Object.freeze({ searchable: true, aliases: [], minRole: "customer", roles: [], ...config });
}

export const APP_REGISTRY = Object.freeze([
  app({ id: "dashboard", title: "Owner Mega Dashboard", category: APP_CATEGORIES.intelligence, route: "/dashboard.html", aliases: ["dashboard", "command", "executive", "owner", "mega dashboard", "home base"], minRole: "admin" }),
  app({ id: "customer-dashboard", title: "Customer Dashboard", category: APP_CATEGORIES.customer, route: "/customer_dashboard.html", aliases: ["customer", "customers", "customer portal", "client portal", "portal"], minRole: "customer" }),
  app({ id: "organization", title: "Organization Dashboard", category: APP_CATEGORIES.organizations, route: "/org.html", aliases: ["organization", "org", "office", "branch", "subsidiary", "llc dashboard"], minRole: "office_owner" }),
  app({ id: "companies", title: "Companies", category: APP_CATEGORIES.organizations, route: "/companies.html", aliases: ["companies", "company", "llc", "llcs", "subsidiaries", "brands"], minRole: "admin" }),
  app({ id: "users", title: "Users", category: APP_CATEGORIES.organizations, route: "/users.html", aliases: ["users", "people", "team", "employees", "staff list", "accounts"], minRole: "hr" }),
  app({ id: "applications", title: "Applications", category: APP_CATEGORIES.organizations, route: "/applications.html", aliases: ["applications", "applicants", "staff applications", "hiring", "onboarding"], minRole: "hr" }),
  app({ id: "jobs", title: "Jobs", category: APP_CATEGORIES.operations, route: "/jobs.html", aliases: ["jobs", "job", "work", "work orders", "service jobs", "crew jobs"], minRole: "cleaner" }),
  app({ id: "leads", title: "Leads", category: APP_CATEGORIES.operations, route: "/leads.html", aliases: ["leads", "lead", "pipeline", "sales", "prospects", "d2d"], minRole: "sales_rep" }),
  app({ id: "dispatch", title: "Dispatch", category: APP_CATEGORIES.operations, route: "/dispatch.html", aliases: ["dispatch", "dispatcher", "assign", "assignments", "route jobs"], minRole: "dispatcher" }),
  app({ id: "field", title: "Field Ops", category: APP_CATEGORIES.operations, route: "/field.html", aliases: ["field", "field ops", "crew", "crews", "technicians", "cleaners"], minRole: "cleaner" }),
  app({ id: "schedule", title: "Schedule", category: APP_CATEGORIES.operations, route: "/schedule.html", aliases: ["schedule", "calendar", "bookings", "appointments", "availability"], minRole: "staff" }),
  app({ id: "operations-map", title: "Operations Map", category: APP_CATEGORIES.operations, route: "/operations_map.html", aliases: ["map", "maps", "operations map", "territory map", "live map", "gps"], minRole: "dispatch_manager" }),
  app({ id: "territory-intelligence", title: "Territory Intelligence", category: APP_CATEGORIES.intelligence, route: "/territory_intelligence.html", aliases: ["territory", "territories", "territory intelligence", "market intelligence"], minRole: "sales_manager" }),
  app({ id: "predictive-ops", title: "Predictive Ops", category: APP_CATEGORIES.intelligence, route: "/predictive_ops.html", aliases: ["predictive", "forecast", "ai ops", "smart ops", "prediction"], minRole: "operations_manager" }),
  app({ id: "ai-command", title: "AI Command", category: APP_CATEGORIES.intelligence, route: "/ai_command.html", aliases: ["ai", "ai command", "assistant", "command palette", "ask evaraos"], minRole: "admin" }),
  app({ id: "analytics", title: "Analytics", category: APP_CATEGORIES.intelligence, route: "/analytics.html", aliases: ["analytics", "reports", "reporting", "metrics", "data"], minRole: "operations_manager" }),
  app({ id: "revenue", title: "Revenue", category: APP_CATEGORIES.finance, route: "/revenue.html", aliases: ["revenue", "money", "sales revenue", "income", "finance"], minRole: "finance_manager" }),
  app({ id: "payroll", title: "Payroll", category: APP_CATEGORIES.finance, route: "/payroll.html", aliases: ["payroll", "pay", "workers pay", "employee pay", "contractor pay"], minRole: "finance_manager" }),
  app({ id: "ledger", title: "Ledger", category: APP_CATEGORIES.finance, route: "/ledger.html", aliases: ["ledger", "books", "transactions", "accounting", "records"], minRole: "finance_manager" }),
  app({ id: "payment-ops", title: "Payment Ops", category: APP_CATEGORIES.finance, route: "/payment_ops.html", aliases: ["payments", "payment ops", "stripe", "payouts", "settlement"], minRole: "finance_manager" }),
  app({ id: "messages", title: "Messaging", category: APP_CATEGORIES.customer, route: "/customer-messaging.html", aliases: ["messages", "messaging", "chat", "inbox", "customer messages"], minRole: "customer" }),
  app({ id: "service-history", title: "Service History", category: APP_CATEGORIES.customer, route: "/customer-service-history.html", aliases: ["history", "service history", "past jobs", "completed work", "customer history"], minRole: "customer" }),
  app({ id: "settings", title: "Settings", category: APP_CATEGORIES.system, route: "/settings.html", aliases: ["settings", "system", "preferences", "profile", "account", "security"], minRole: "customer" })
]);

export function normalizeRole(role = "customer") {
  const normalized = String(role || "customer").trim().toLowerCase();
  return ROLE_ALIASES[normalized] || APP_ROLES.customer;
}

export function getRoleDefinition(role = "customer") {
  return ROLE_DEFINITIONS[normalizeRole(role)] || ROLE_DEFINITIONS.customer;
}

export function roleCanAccessApp(role = "customer", appConfig = {}) {
  const normalized = normalizeRole(role);
  if (normalized === APP_ROLES.owner || normalized === APP_ROLES.super_admin) return true;
  if (Array.isArray(appConfig.roles) && appConfig.roles.length) return appConfig.roles.includes(normalized);
  return canSee(normalized, appConfig.minRole || "customer");
}

export function rolesByGroup() {
  return Object.entries(ROLE_DEFINITIONS).reduce((groups, [id, definition]) => {
    const group = definition.group || "staff";
    if (!groups[group]) groups[group] = [];
    groups[group].push({ id, ...definition });
    groups[group].sort((a, b) => b.level - a.level || a.label.localeCompare(b.label));
    return groups;
  }, {});
}

export function normalizeQuery(query = "") {
  return String(query || "").trim().toLowerCase().replace(/^(open|go to|show|take me to|launch|view|find)\s+/, "").replace(/[._-]+/g, " ").replace(/\s+/g, " ");
}

function searchableText(app) {
  return [app.title, app.id, app.category, app.route, ...(app.aliases || [])].join(" ").toLowerCase();
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
  return APP_REGISTRY.filter((app) => app.searchable !== false && roleCanAccessApp(role, app));
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
  const apps = appsForRole(role);
  if (!normalized) return apps;
  return apps.map((app) => ({ ...app, score: appScore(app, normalized) })).filter((app) => app.score > 0).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
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

window.EvaraAppRegistry = { version: APP_REGISTRY_VERSION, APP_CATEGORIES, ROLE_GROUPS, APP_ROLES, ROLE_DEFINITIONS, APP_REGISTRY, normalizeRole, getRoleDefinition, roleCanAccessApp, rolesByGroup, normalizeQuery, appsForRole, appsByCategory, searchApps, appById, appByRoute, primaryAppForCategory };
