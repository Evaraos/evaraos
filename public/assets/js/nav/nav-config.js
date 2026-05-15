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
    { page: "settings.html", label: "Settings", icon: "settings", bubble: "settings" }
  ],

  ownerOnly: [
    { page: "companies.html", label: "Companies", icon: "companies", bubble: "companies", group: "Organization" },
    { page: "governance-dashboard.html", label: "Governance", icon: "org", bubble: "governance", group: "Organization" },
    { page: "users.html", label: "Users", icon: "users", bubble: "users", group: "Organization" },
    { page: "org.html", label: "Organization", icon: "org", bubble: "org", group: "Organization" },

    { page: "territories.html", label: "Territories", icon: "operations", bubble: "territories", group: "Operations" },
    { page: "leads.html", label: "Leads", icon: "leads", bubble: "leads", group: "Operations" },
    { page: "jobs.html", label: "Jobs", icon: "jobs", bubble: "jobs", group: "Operations" },
    { page: "qa.html", label: "QA", icon: "qa", bubble: "qa", group: "Operations" },

    { page: "applications.html", label: "Applications", icon: "applications", bubble: "applications", group: "People" }
  ]
};

export const NAV_EXEC_GROUPS = [
  {
    title: "Operations",
    subtitle: "Dispatch & Territory",
    description: "Territories, leads, jobs, QA, and field execution.",
    icon: "operations"
  },
  {
    title: "Organization",
    subtitle: "Company OS",
    description: "Companies, users, governance, and ownership structure.",
    icon: "org"
  },
  {
    title: "People",
    subtitle: "Hiring",
    description: "Applications, onboarding, and staff pipeline.",
    icon: "people"
  }
];
