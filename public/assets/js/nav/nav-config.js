export const NAV_STATE = {
  progress: 0,
  targetProgress: 0,
  lastY: window.scrollY,
  lastScrollDirection: 0,
  compactTimer: null,
  scrollSettleTimer: null,
  rafId: null,
  navPinnedOpen: false,
  motionMode: "scroll",
  hasBootAnimated: false,
  isNavigating: false,
  hasInitialized: false,

  tapStartX: 0,
  tapStartY: 0,
  tapMoved: false,
  tapHandled: false,

  lockedScrollY: 0,
  pressTimer: null,
  longPressTriggered: false
};

export const NAV_ROLE_GROUPS = {
  leadership: ["owner", "super_admin", "admin", "manager", "operations_manager", "operations_coordinator"],
  staff: ["technician", "cleaner", "staff", "field_staff", "crew_lead", "sales", "sales_rep", "customer_support", "quality_control"],
  customer: ["customer"]
};

export const NAV_PAGES = {
  common: [
    { page: "index.html", label: "Home", icon: "home", bubble: "home", group: "Core", roles: ["guest", "customer", "staff", "leadership"] },
    { page: "staff_application.html", label: "Apply as Staff", icon: "applications", bubble: "apply", group: "People", roles: ["guest", "customer", "leadership"] }
  ],

  guestMain: [
    { page: "login.html", label: "Login", icon: "login", bubble: "login", group: "Access", roles: ["guest"] },
    { page: "signup.html", label: "Sign Up", icon: "signup", bubble: "signup", group: "Access", roles: ["guest"] },
    { page: "reset.html", label: "Reset Password", icon: "reset", bubble: "reset", group: "Access", roles: ["guest"] }
  ],

  authedMain: [
    { page: "dashboard.html", label: "Dashboard", icon: "dashboard", bubble: "dashboard", group: "Core", roles: ["customer", "staff", "leadership"] },
    { page: "customer-commerce.html", label: "Billing", icon: "operations", bubble: "customer-billing", group: "Customer Portal", roles: ["customer", "staff", "leadership"] },
    { page: "customer-messaging.html", label: "Messages", icon: "operations", bubble: "customer-messages", group: "Customer Portal", roles: ["customer", "staff", "leadership"] },
    { page: "customer-service-history.html", label: "Service History", icon: "operations", bubble: "customer-history", group: "Customer Portal", roles: ["customer", "staff", "leadership"] },
    { page: "settings.html", label: "Settings", icon: "settings", bubble: "settings", group: "Account", roles: ["customer", "staff", "leadership"] }
  ],

  ownerOnly: [
    { page: "companies.html", label: "Companies", icon: "companies", bubble: "companies", group: "Admin", roles: ["leadership"] },
    { page: "users.html", label: "Users", icon: "users", bubble: "users", group: "Admin", roles: ["leadership"] },
    { page: "org.html", label: "Organization", icon: "org", bubble: "org", group: "Admin", roles: ["leadership"] },
    { page: "applications.html", label: "Applications", icon: "applications", bubble: "applications", group: "People", roles: ["leadership"] },

    { page: "live-operations-command.html", label: "Live Command", icon: "operations", bubble: "live-command", group: "Operations", roles: ["leadership"] },
    { page: "operations-visibility.html", label: "Operations Visibility", icon: "operations", bubble: "operations-visibility", group: "Operations", roles: ["leadership"] },
    { page: "notifications.html", label: "Notifications", icon: "operations", bubble: "notifications", group: "Operations", roles: ["leadership"] },
    { page: "executive-queue.html", label: "Executive Queue", icon: "operations", bubble: "executive-queue", group: "Operations", roles: ["leadership"] },
    { page: "workflow-monitor-dashboard.html", label: "Workflow Monitor", icon: "operations", bubble: "workflow", group: "Operations", roles: ["leadership"] },
    { page: "alerts-dashboard.html", label: "Executive Alerts", icon: "operations", bubble: "alerts", group: "Operations", roles: ["leadership"] },
    { page: "analytics-dashboard.html", label: "Analytics", icon: "operations", bubble: "analytics", group: "Operations", roles: ["leadership"] },
    { page: "territories.html", label: "Territories", icon: "operations", bubble: "territories", group: "Operations", roles: ["leadership"] },
    { page: "territory-map.html", label: "Territory Map", icon: "operations", bubble: "territory-map", group: "Operations", roles: ["staff", "leadership"] },
    { page: "presence.html", label: "Presence", icon: "users", bubble: "presence", group: "Operations", roles: ["staff", "leadership"] },
    { page: "leads.html", label: "Leads", icon: "leads", bubble: "leads", group: "Operations", roles: ["staff", "leadership"] },
    { page: "jobs.html", label: "Jobs", icon: "jobs", bubble: "jobs", group: "Operations", roles: ["staff", "leadership"] },
    { page: "qa.html", label: "QA", icon: "qa", bubble: "qa", group: "Operations", roles: ["leadership"] },

    { page: "enterprise-finance-dashboard.html", label: "Enterprise Finance", icon: "operations", bubble: "enterprise-finance", group: "Finance", roles: ["leadership"] },
    { page: "marketplace-payouts.html", label: "Marketplace Payouts", icon: "operations", bubble: "marketplace-payouts", group: "Finance", roles: ["leadership"] },
    { page: "governance-dashboard.html", label: "Governance", icon: "org", bubble: "governance", group: "Governance", roles: ["leadership"] },
    { page: "governance-analytics.html", label: "Governance Analytics", icon: "org", bubble: "governance-analytics", group: "Governance", roles: ["leadership"] },
    { page: "anomaly-dashboard.html", label: "Anomalies", icon: "org", bubble: "anomalies", group: "Governance", roles: ["leadership"] },
    { page: "audit-dashboard.html", label: "Audit", icon: "org", bubble: "audit", group: "Governance", roles: ["leadership"] },
    { page: "replay-dashboard.html", label: "Replay", icon: "org", bubble: "replay", group: "Governance", roles: ["leadership"] }
  ]
};

export const NAV_GROUP_ORDER = [
  "Core",
  "Customer Portal",
  "Operations",
  "Finance",
  "Admin",
  "People",
  "Governance",
  "Account",
  "Access"
];

export const NAV_EXEC_GROUPS = [
  {
    title: "Operations",
    subtitle: "Command, visibility, teams & field execution",
    description: "Live command, observability, alerts, workflow, territories, presence, leads, jobs, QA, and field execution.",
    icon: "operations"
  },
  {
    title: "Finance",
    subtitle: "Revenue, payouts & settlement",
    description: "Enterprise finance, marketplace payouts, settlement intelligence, subscriptions, invoices, and reconciliation.",
    icon: "operations"
  },
  {
    title: "Admin",
    subtitle: "Companies, users & organization",
    description: "Companies, users, organization structure, access control, and leadership systems.",
    icon: "org"
  },
  {
    title: "Customer Portal",
    subtitle: "Billing, messages & history",
    description: "Customer billing, service history, messaging, notifications, and account continuity.",
    icon: "people"
  }
];
