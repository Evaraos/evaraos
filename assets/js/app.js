const BASE_PATH = "/evaraos";
const PUBLIC_PAGES = ["index.html", "login.html", "signup.html"];

function getCurrentPage() {
  const path = window.location.pathname;
  const clean = path.endsWith("/") ? path.slice(0, -1) : path;
  const page = clean.split("/").pop();
  return page || "index.html";
}

function isPublicPage() {
  return PUBLIC_PAGES.includes(getCurrentPage());
}

function getAssetPath(path) {
  if (!path) return "#";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith(BASE_PATH)) return path;
  if (path.startsWith("/")) return `${BASE_PATH}${path}`;
  return `${BASE_PATH}/${path}`;
}

function goTo(path) {
  window.location.href = getAssetPath(path);
}

function requireAuth() {
  const user = JSON.parse(localStorage.getItem("evaraos_user") || "null");
  if (!user && !isPublicPage()) {
    goTo("login.html");
    return null;
  }
  return user;
}

function logout() {
  localStorage.removeItem("evaraos_user");
  localStorage.removeItem("evaraos_role");
  goTo("login.html");
}

function setUserSession(user) {
  localStorage.setItem("evaraos_user", JSON.stringify(user));
  localStorage.setItem("evaraos_role", user.role || "guest");
}

function getUserSession() {
  return JSON.parse(localStorage.getItem("evaraos_user") || "null");
}

function getUserRole() {
  return localStorage.getItem("evaraos_role") || "guest";
}

function pageTitleMap() {
  return {
    "dashboard.html": "Dashboard",
    "companies.html": "Companies",
    "users.html": "Users",
    "sales_reps.html": "Sales Reps",
    "leads.html": "Leads",
    "jobs.html": "Jobs",
    "audit.html": "Audit",
    "org.html": "Organization",
    "performance.html": "Performance",
    "customer_dashboard.html": "Customer Dashboard",
    "login.html": "Login",
    "signup.html": "Sign Up",
    "index.html": "Home"
  };
}

function injectTopbar() {
  const topbar = document.getElementById("topbar");
  if (!topbar) return;

  const user = getUserSession();
  const page = getCurrentPage();
  const title = pageTitleMap()[page] || "Evaraos";

  topbar.innerHTML = `
    <div class="topbar-inner">
      <div class="topbar-left">
        <a class="brand-link" href="${getAssetPath('index.html')}">
          <img src="${getAssetPath('assets/img/evaraos_logo.png')}" alt="Evaraos Logo" class="brand-logo" />
          <span class="brand-text">Evaraos</span>
        </a>
      </div>
      <div class="topbar-center">
        <h1 class="page-title">${title}</h1>
      </div>
      <div class="topbar-right">
        ${
          user
            ? `
              <div class="user-pill">
                <span>${user.name || "User"}</span>
                <span class="user-role">${user.role || "guest"}</span>
              </div>
              <button id="logoutBtn" class="btn btn-outline">Logout</button>
            `
            : `
              <a class="btn btn-outline" href="${getAssetPath('login.html')}">Login</a>
              <a class="btn btn-primary" href="${getAssetPath('signup.html')}">Sign Up</a>
            `
        }
      </div>
    </div>
  `;
}

function injectSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  const role = getUserRole();
  const page = getCurrentPage();

  const links = [
    { href: "dashboard.html", label: "Dashboard", roles: ["owner", "admin", "manager", "sales_rep", "tech"] },
    { href: "companies.html", label: "Companies", roles: ["owner", "admin"] },
    { href: "users.html", label: "Users", roles: ["owner", "admin", "manager"] },
    { href: "sales_reps.html", label: "Sales Reps", roles: ["owner", "admin", "manager"] },
    { href: "leads.html", label: "Leads", roles: ["owner", "admin", "manager", "sales_rep"] },
    { href: "jobs.html", label: "Jobs", roles: ["owner", "admin", "manager", "tech"] },
    { href: "audit.html", label: "Audit", roles: ["owner", "admin"] },
    { href: "org.html", label: "Organization", roles: ["owner", "admin"] },
    { href: "performance.html", label: "Performance", roles: ["owner", "admin", "manager"] },
    { href: "customer_dashboard.html", label: "Customer Dashboard", roles: ["customer", "owner", "admin"] }
  ];

  const filtered = links.filter(link => link.roles.includes(role));

  sidebar.innerHTML = `
    <div class="sidebar-inner">
      <a class="sidebar-logo-wrap" href="${getAssetPath('index.html')}">
        <img src="${getAssetPath('assets/img/evaraos_logo.png')}" alt="Evaraos Logo" class="sidebar-logo" />
      </a>
      <nav class="sidebar-nav">
        ${filtered
          .map(
            link => `
            <a href="${getAssetPath(link.href)}" class="sidebar-link ${page === link.href ? "active" : ""}">
              ${link.label}
            </a>
          `
          )
          .join("")}
      </nav>
    </div>
  `;
}

function bindGlobalEvents() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }
}

function initLayout() {
  injectTopbar();
  injectSidebar();
  bindGlobalEvents();
}

document.addEventListener("DOMContentLoaded", () => {
  if (!isPublicPage()) {
    requireAuth();
  }
  initLayout();
});