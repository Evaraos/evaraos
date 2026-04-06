import {
  auth,
  db,
  onAuthStateChanged,
  signOut,
  getDoc,
  doc
} from "./firebase.js";

const BASE_PATH = "/evaraos";

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

export function buildPageTitle(pathname = window.location.pathname) {
  const page = pathname.split("/").pop() || "index.html";

  const titles = {
    "dashboard.html": "Dashboard",
    "customer_dashboard.html": "Customer Dashboard",
    "companies.html": "Companies",
    "users.html": "Users",
    "sales_reps.html": "Sales Reps",
    "leads.html": "Leads",
    "jobs.html": "Jobs",
    "audit.html": "Audit",
    "org.html": "Organization",
    "performance.html": "Performance",
    "login.html": "Login",
    "index.html": "Home"
  };

  return titles[page] || "Evaraos";
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
    const userRef = doc(db, "users", firebaseUser.uid);
    const snap = await getDoc(userRef);

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
  const {
    allowRoles = null,
    redirectTo = "/evaraos/login.html"
  } = options;

  onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      window.location.href = redirectTo;
      return;
    }

    const user = await hydrateCurrentUser(firebaseUser);

    if (!user) {
      return;
    }

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

export async function bindTopbar(user) {
  const topbar = document.getElementById("topbar");
  if (!topbar) return;

  const pageTitle = buildPageTitle();

  topbar.innerHTML = `
    <div class="topbar-inner">
      <div class="topbar-left">
        <a class="brand-link" href="${getAssetPath("index.html")}">
          <img src="${getAssetPath("assets/img/evaraos_logo.png")}" alt="Evaraos Logo" class="brand-logo" />
          <span class="brand-text">Evaraos</span>
        </a>
      </div>

      <div class="topbar-center">
        <h1 class="page-title">${pageTitle}</h1>
      </div>

      <div class="topbar-right">
        <div class="user-pill">
          <span>${user?.name || user?.username || user?.email || "User"}</span>
          <span class="user-role">${user?.role || "guest"}</span>
        </div>
        <button id="logoutBtn" class="btn btn-outline" type="button">Logout</button>
      </div>
    </div>
  `;

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await logoutUser();
  });
}