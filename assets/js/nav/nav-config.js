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
    { page: "index.html", label: "Home", icon: "home", bubble: "home" }
  ],

  guestMain: [
    { page: "login.html", label: "Login", icon: "login", bubble: "login" },
    { page: "signup.html", label: "Sign Up", icon: "signup", bubble: "signup" },
    { page: "reset.html", label: "Reset Password", icon: "login", bubble: "reset" }
  ],

  authedMain: [
    { page: "dashboard.html", label: "Dashboard", icon: "dashboard", bubble: "dashboard" },
    { page: "settings.html", label: "Settings", icon: "settings", bubble: "settings" }
  ],

  ownerOnly: [
    { page: "companies.html", label: "Companies", icon: "companies", bubble: "companies" },
    { page: "users.html", label: "Users", icon: "users", bubble: "users" },
    { page: "leads.html", label: "Leads", icon: "leads", bubble: "leads" },
    { page: "jobs.html", label: "Jobs", icon: "jobs", bubble: "jobs" },
    { page: "qa.html", label: "QA", icon: "qa", bubble: "qa" }
  ]
};
