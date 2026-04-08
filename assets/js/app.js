import {
  auth,
  db,
  onAuthStateChanged,
  signOut,
  getDoc,
  doc
} from "./firebase.js";

const BASE_PATH = "/evaraos";
const THEME_KEY = "evara-theme";

const ROLE_PERMISSIONS = {
  owner: ["all"],
  admin: ["dashboard", "companies", "users", "sales_reps", "leads", "jobs", "audit", "org", "performance", "customer_dashboard"],
  manager: ["dashboard", "users", "sales_reps", "leads", "jobs", "performance"],
  sales_rep: ["dashboard", "leads"],
  tech: ["dashboard", "jobs"],
  customer: ["customer_dashboard", "self"],
  guest: []
};

export function getAssetPath(path = "") {
  if (!path) return "#";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith(BASE_PATH)) return path;
  if (path.startsWith("/")) return `${BASE_PATH}${path}`;
  return `${BASE_PATH}/${path}`;
}

export function hasPermission(user, section) {
  const role = user?.role || "guest";
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes("all") || permissions.includes(section);
}

export function renderSidebar(role, active = "") {
  const links = [
    { key: "dashboard", href: "/evaraos/dashboard.html", label: "Dashboard", roles: ["owner", "admin", "manager", "sales_rep", "tech"] },
    { key: "companies", href: "/evaraos/companies.html", label: "Companies", roles: ["owner", "admin"] },
    { key: "users", href: "/evaraos/users.html", label: "Users", roles: ["owner", "admin", "manager"] },
    { key: "sales_reps", href: "/evaraos/sales_reps.html", label: "Sales Reps", roles: ["owner", "admin", "manager"] },
    { key: "leads", href: "/evaraos/leads.html", label: "Leads", roles: ["owner", "admin", "manager", "sales_rep"] },
    { key: "jobs", href: "/evaraos/jobs.html", label: "Jobs", roles: ["owner", "admin", "manager", "tech"] },
    { key: "audit", href: "/evaraos/audit.html", label: "Audit", roles: ["owner", "admin"] },
    { key: "org", href: "/evaraos/org.html", label: "Organization", roles: ["owner", "admin"] },
    { key: "performance", href: "/evaraos/performance.html", label: "Performance", roles: ["owner", "admin", "manager"] },
    { key: "customer_dashboard", href: "/evaraos/customer_dashboard.html", label: "Customer Portal", roles: ["customer", "owner", "admin"] }
  ];

  const filtered = links.filter(link => link.roles.includes(role));

  return `
    <div class="sidebar-inner">
      <a class="sidebar-logo-wrap" href="${getAssetPath("index.html")}">
        <img src="${getAssetPath("assets/img/evaraos_logo.png")}" alt="Evaraos Logo" class="sidebar-logo" />
      </a>
      <nav class="sidebar-nav">
        ${filtered.map(link => `
          <a href="${link.href}" class="sidebar-link ${active === link.key ? "active" : ""}">
            ${link.label}
          </a>
        `).join("")}
      </nav>
    </div>
  `;
}

export async function loadCompany(companyId) {
  if (!companyId) return null;

  try {
    const snap = await getDoc(doc(db, "companies", companyId));
    if (!snap.exists()) return { id: companyId, name: companyId };
    return { id: snap.id, ...snap.data() };
  } catch (error) {
    console.error("Failed to load company:", error);
    return { id: companyId, name: companyId };
  }
}

export async function hydrateCurrentUser(firebaseUser) {
  if (!firebaseUser) return null;

  try {
    const snap = await getDoc(doc(db, "users", firebaseUser.uid));

    if (!snap.exists()) {
      return {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        email: firebaseUser.email || "",
        role: "customer",
        approvalStatus: "pending"
      };
    }

    return {
      id: firebaseUser.uid,
      uid: firebaseUser.uid,
      email: firebaseUser.email || "",
      ...snap.data()
    };
  } catch (error) {
    console.error("Failed to hydrate current user:", error);
    return null;
  }
}

export async function requireAuth(callback, options = {}) {
  const { allowRoles = null, redirectTo = "/evaraos/login.html" } = options;

  onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      window.location.href = redirectTo;
      return;
    }

    const user = await hydrateCurrentUser(firebaseUser);

    if (!user) return;

    if (Array.isArray(allowRoles) && allowRoles.length && !allowRoles.includes(user.role)) {
      if (user.role === "customer") {
        window.location.href = "/evaraos/customer_dashboard.html";
      } else {
        window.location.href = "/evaraos/dashboard.html";
      }
      return;
    }

    callback(user);
  });
}

export async function logoutUser() {
  await signOut(auth);
  window.location.href = "/evaraos/index.html";
}

export async function bindTopbar(user, title = "Dashboard") {
  const topbar = document.getElementById("topbar");
  if (!topbar) return;

  topbar.innerHTML = `
    <div class="topbar-inner">
      <div class="topbar-left">
        <a class="brand-link" href="/evaraos/index.html">
          <img src="/evaraos/assets/img/evaraos_logo.png" alt="Evaraos Logo" class="brand-logo" />
          <span class="brand-text">Evaraos</span>
        </a>
      </div>

      <div class="topbar-center">
        <h1 class="page-title">${title}</h1>
      </div>

      <div class="topbar-right">
        ${renderThemeSwitcher()}
        <div class="user-pill">
          <span>${user?.name || user?.username || user?.email || "User"}</span>
          <span class="user-role">${user?.role || "guest"}</span>
        </div>
        <button id="logoutBtn" class="btn btn-outline" type="button">Logout</button>
      </div>
    </div>
  `;

  initThemeUI(topbar);

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await logoutUser();
  });
}

function renderThemeSwitcher() {
  return `
    <div class="theme-switcher" aria-label="Theme switcher">
      <button type="button" class="theme-btn" data-theme-choice="light">Light</button>
      <button type="button" class="theme-btn" data-theme-choice="dark">Dark</button>
      <button type="button" class="theme-btn" data-theme-choice="system">System</button>
    </div>
  `;
}

function getStoredTheme() {
  return localStorage.getItem(THEME_KEY) || "system";
}

function getResolvedTheme(choice) {
  if (choice === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return choice;
}

function applyTheme(choice) {
  const resolved = getResolvedTheme(choice);
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.setAttribute("data-theme-choice", choice);
  syncThemeButtons(choice);
}

function syncThemeButtons(choice = getStoredTheme()) {
  document.querySelectorAll(".theme-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.themeChoice === choice);
  });
}

function initThemeUI(scope = document) {
  scope.querySelectorAll(".theme-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const choice = btn.dataset.themeChoice || "system";
      localStorage.setItem(THEME_KEY, choice);
      applyTheme(choice);
    });
  });

  syncThemeButtons();
}

function initLandingThemeSwitcher() {
  const navTargets = document.querySelectorAll(".landing-nav");

  navTargets.forEach(nav => {
    if (nav.querySelector(".theme-switcher")) return;
    nav.insertAdjacentHTML("beforeend", renderThemeSwitcher());
  });

  initThemeUI(document);
}

function initDropdowns() {
  document.querySelectorAll(".nav-dropdown-toggle").forEach(toggle => {
    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const dropdown = toggle.closest(".nav-dropdown");
      if (!dropdown) return;

      document.querySelectorAll(".nav-dropdown.open").forEach(item => {
        if (item !== dropdown) item.classList.remove("open");
      });

      dropdown.classList.toggle("open");
    });
  });

  document.addEventListener("click", (event) => {
    document.querySelectorAll(".nav-dropdown.open").forEach(dropdown => {
      if (!dropdown.contains(event.target)) {
        dropdown.classList.remove("open");
      }
    });
  });
}

function initModalBackdrops() {
  document.querySelectorAll(".modal-backdrop").forEach(modal => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        modal.classList.remove("open");
      }
    });
  });
}

function initPasswordToggles() {
  const pairs = [
    ["togglePasswordBtn", "password", "passwordIconOpen", "passwordIconClosed"],
    ["toggleSignupPasswordBtn", "signupPassword", "signupPasswordIconOpen", "signupPasswordIconClosed"],
    ["toggleSignupPasswordConfirmBtn", "signupPasswordConfirm", "signupPasswordConfirmIconOpen", "signupPasswordConfirmIconClosed"]
  ];

  pairs.forEach(([buttonId, inputId, openId, closedId]) => {
    const button = document.getElementById(buttonId);
    const input = document.getElementById(inputId);
    const openIcon = document.getElementById(openId);
    const closedIcon = document.getElementById(closedId);

    if (!button || !input) return;

    button.addEventListener("click", () => {
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      button.setAttribute("aria-pressed", isPassword ? "true" : "false");
      button.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");

      if (openIcon) openIcon.style.display = isPassword ? "none" : "";
      if (closedIcon) closedIcon.style.display = isPassword ? "" : "none";
    });
  });
}

function initThemeBoot() {
  applyTheme(getStoredTheme());

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", () => {
      if (getStoredTheme() === "system") applyTheme("system");
    });
  } else if (typeof media.addListener === "function") {
    media.addListener(() => {
      if (getStoredTheme() === "system") applyTheme("system");
    });
  }
}

function initSharedUI() {
  initThemeBoot();
  initLandingThemeSwitcher();
  initDropdowns();
  initModalBackdrops();
  initPasswordToggles();
}

document.addEventListener("DOMContentLoaded", initSharedUI);