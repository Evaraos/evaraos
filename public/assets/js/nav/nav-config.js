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

export const NAV_PAGES = {
  common: [
    { page: "index.html", label: "Home", icon: "home", bubble: "home" },
    { page: "staff_application.html", label: "Apply as Staff", icon: "applications", bubble: "apply" }
  ],

  guestMain: [
    { page: "login.html", label: "Login", icon: "login", bubble: "login" },
    { page: "signup.html", label: "Sign Up", icon: "signup", bubble: "signup" },
    { page: "reset.html", label: "Reset Password", icon: "reset", bubble: "reset" }
  ],

  authedMain: [
    { page: "dashboard.html", label: "Dashboard", icon: "dashboard", bubble: "dashboard" },
    { page: "customer-commerce.html", label: "Billing", icon: "operations", bubble: "customer-billing" },
    { page: "settings.html", label: "Settings", icon: "settings", bubble: "settings" }
  ],

  ownerOnly: [
    { page: "companies.html", label: "Companies", icon: "companies", bubble: "companies", group: "Organization" },
    { page: "governance-dashboard.html", label: "Governance", icon: "org", bubble: "governance", group: "Organization" },
    { page: "governance-analytics.html", label: "Governance Analytics", icon: "org", bubble: "governance-analytics", group: "Organization" },
    { page: "anomaly-dashboard.html", label: "Anomalies", icon: "org", bubble: "anomalies", group: "Organization" },
    { page: "audit-dashboard.html", label: "Audit", icon: "org", bubble: "audit", group: "Organization" },
    { page: "replay-dashboard.html", label: "Replay", icon: "org", bubble: "replay", group: "Organization" },
    { page: "users.html", label: "Users", icon: "users", bubble: "users", group: "Organization" },
    { page: "org.html", label: "Organization", icon: "org", bubble: "org", group: "Organization" },

    { page: "live-operations-command.html", label: "Live Command", icon: "operations", bubble: "live-command", group: "Operations" },
    { page: "enterprise-finance-dashboard.html", label: "Enterprise Finance", icon: "operations", bubble: "enterprise-finance", group: "Operations" },
    { page: "notifications.html", label: "Notifications", icon: "operations", bubble: "notifications", group: "Operations" },
    { page: "executive-queue.html", label: "Executive Queue", icon: "operations", bubble: "executive-queue", group: "Operations" },
    { page: "workflow-monitor-dashboard.html", label: "Workflow Monitor", icon: "operations", bubble: "workflow", group: "Operations" },
    { page: "alerts-dashboard.html", label: "Executive Alerts", icon: "operations", bubble: "alerts", group: "Operations" },
    { page: "analytics-dashboard.html", label: "Analytics", icon: "operations", bubble: "analytics", group: "Operations" },
    { page: "territories.html", label: "Territories", icon: "operations", bubble: "territories", group: "Operations" },
    { page: "territory-map.html", label: "Territory Map", icon: "operations", bubble: "territory-map", group: "Operations" },
    { page: "presence.html", label: "Presence", icon: "users", bubble: "presence", group: "Operations" },
    { page: "leads.html", label: "Leads", icon: "leads", bubble: "leads", group: "Operations" },
    { page: "jobs.html", label: "Jobs", icon: "jobs", bubble: "jobs", group: "Operations" },
    { page: "qa.html", label: "QA", icon: "qa", bubble: "qa", group: "Operations" },

    { page: "applications.html", label: "Applications", icon: "applications", bubble: "applications", group: "People" }
  ]
};

export const NAV_EXEC_GROUPS = [
  {
    title: "Operations",
    subtitle: "Live Command, Finance, Dispatch & Workflow",
    description: "Live operations command, enterprise finance, notifications, executive queue, workflow orchestration, executive alerts, analytics, territories, live maps, presence, leads, jobs, QA, and field execution.",
    icon: "operations"
  },
  {
    title: "Organization",
    subtitle: "Governance Intelligence OS",
    description: "Companies, users, governance analytics, anomaly monitoring, audit traceability, replay timelines, and ownership structure.",
    icon: "org"
  },
  {
    title: "People",
    subtitle: "Hiring",
    description: "Applications, onboarding, and staff pipeline.",
    icon: "people"
  }
];
