import {
  auth,
  db,
  onAuthStateChanged,
  signOut,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  collection,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from "./firebase.js";

const BASE_PATH = "/evaraos";
const THEME_KEY = "evara-theme";

const ROLE_PERMISSIONS = {
  owner: ["all"],
  super_admin: ["all"],
  admin: ["dashboard", "companies", "users", "sales_reps", "leads", "jobs", "audit", "org", "performance", "customer_dashboard"],
  manager: ["dashboard", "users", "sales_reps", "leads", "jobs", "performance"],
  operations_coordinator: ["dashboard", "users", "jobs", "performance"],
  sales_rep: ["dashboard", "leads", "sales_reps"],
  technician: ["dashboard", "jobs"],
  tech: ["dashboard", "jobs"],
  hr: ["dashboard", "users"],
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

export function normalizeRole(role = "") {
  const value = String(role || "").trim().toLowerCase();
  if (value === "tech") return "technician";
  return value || "guest";
}

export function hasPermission(user, section) {
  const role = normalizeRole(user?.role);
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes("all") || permissions.includes(section);
}

export function canAccess(role, section) {
  const normalizedRole = normalizeRole(role);
  const permissions = ROLE_PERMISSIONS[normalizedRole] || [];
  return permissions.includes("all") || permissions.includes(section);
}

export function renderSidebar(role, active = "") {
  const normalizedRole = normalizeRole(role);

  const links = [
    { key: "dashboard", href: "/evaraos/dashboard.html", label: "Dashboard", roles: ["owner", "super_admin", "admin", "manager", "sales_rep", "technician", "operations_coordinator", "hr"] },
    { key: "companies", href: "/evaraos/companies.html", label: "Companies", roles: ["owner", "super_admin", "admin"] },
    { key: "users", href: "/evaraos/users.html", label: "Users", roles: ["owner", "super_admin", "admin", "manager", "operations_coordinator", "hr"] },
    { key: "sales_reps", href: "/evaraos/sales_reps.html", label: "Sales Reps", roles: ["owner", "super_admin", "admin", "manager"] },
    { key: "leads", href: "/evaraos/leads.html", label: "Leads", roles: ["owner", "super_admin", "admin", "manager", "sales_rep"] },
    { key: "jobs", href: "/evaraos/jobs.html", label: "Jobs", roles: ["owner", "super_admin", "admin", "manager", "technician", "operations_coordinator"] },
    { key: "audit", href: "/evaraos/audit.html", label: "Audit", roles: ["owner", "super_admin", "admin"] },
    { key: "org", href: "/evaraos/org.html", label: "Organization", roles: ["owner", "super_admin", "admin"] },
    { key: "performance", href: "/evaraos/performance.html", label: "Performance", roles: ["owner", "super_admin", "admin", "manager", "operations_coordinator"] },
    { key: "customer_dashboard", href: "/evaraos/customer_dashboard.html", label: "Customer Portal", roles: ["customer", "owner", "super_admin", "admin"] }
  ];

  const filtered = links.filter(link => link.roles.includes(normalizedRole));

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
        approvalStatus: "pending",
        active: true
      };
    }

    return {
      id: firebaseUser.uid,
      uid: firebaseUser.uid,
      email: firebaseUser.email || "",
      ...snap.data(),
      role: normalizeRole(snap.data()?.role)
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

    if (Array.isArray(allowRoles) && allowRoles.length) {
      const allowed = allowRoles.map(normalizeRole);
      if (!allowed.includes(normalizeRole(user.role))) {
        if (normalizeRole(user.role) === "customer") {
          window.location.href = "/evaraos/customer_dashboard.html";
        } else {
          window.location.href = "/evaraos/dashboard.html";
        }
        return;
      }
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
          <span class="user-role">${normalizeRole(user?.role || "guest")}</span>
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

/* ---------- Firestore helpers ---------- */

export async function fetchAllCollection(collectionName, options = {}) {
  const {
    filters = [],
    orderByField = "",
    orderDirection = "asc",
    max = 500
  } = options;

  try {
    const constraints = [];

    for (const filter of filters) {
      if (!filter?.field) continue;
      constraints.push(where(filter.field, filter.op || "==", filter.value));
    }

    if (orderByField) {
      constraints.push(orderBy(orderByField, orderDirection));
    }

    if (max) {
      constraints.push(limit(max));
    }

    const ref = collection(db, collectionName);
    const q = constraints.length ? query(ref, ...constraints) : query(ref, limit(max));
    const snap = await getDocs(q);

    return snap.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));
  } catch (error) {
    console.error(`Failed to fetch collection "${collectionName}":`, error);
    throw error;
  }
}

export async function fetchUsersByCompany(companyId) {
  if (!companyId) return [];
  return fetchAllCollection("users", {
    filters: [{ field: "companyId", op: "==", value: companyId }],
    max: 500
  });
}

export async function createDocument(collectionName, payload = {}) {
  const ref = collection(db, collectionName);
  const finalPayload = {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const created = await addDoc(ref, finalPayload);
  return { id: created.id, ...finalPayload };
}

export async function updateDocument(collectionName, id, payload = {}) {
  const ref = doc(db, collectionName, id);
  await updateDoc(ref, {
    ...payload,
    updatedAt: serverTimestamp()
  });
  return true;
}

export async function deleteDocument(collectionName, id) {
  const ref = doc(db, collectionName, id);
  await deleteDoc(ref);
  return true;
}

export async function saveUserProfile(uid, payload = {}) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, {
    ...payload,
    updatedAt: serverTimestamp()
  }, { merge: true });
  return true;
}

export async function createSalesRep(payload = {}, currentUser = null) {
  const cleanUsername = String(payload.username || "").trim().toLowerCase();
  const cleanName = String(payload.fullName || payload.name || "").trim();

  if (!cleanName || !cleanUsername) {
    throw new Error("Full name and username are required.");
  }

  const userPayload = {
    name: cleanName,
    username: cleanUsername,
    email: String(payload.email || "").trim().toLowerCase(),
    phone: String(payload.phone || "").trim(),
    status: payload.status || "active",
    active: payload.status !== "inactive",
    notes: String(payload.notes || "").trim(),
    role: "sales_rep",
    companyId: currentUser?.companyId || payload.companyId || "",
    reportsTo: currentUser?.uid || payload.reportsTo || "",
    approvalStatus: "approved"
  };

  return createDocument("users", userPayload);
}

export async function updateSalesRep(id, payload = {}) {
  const cleanUsername = String(payload.username || "").trim().toLowerCase();
  const cleanName = String(payload.fullName || payload.name || "").trim();

  if (!cleanName || !cleanUsername) {
    throw new Error("Full name and username are required.");
  }

  return updateDocument("users", id, {
    name: cleanName,
    username: cleanUsername,
    email: String(payload.email || "").trim().toLowerCase(),
    phone: String(payload.phone || "").trim(),
    status: payload.status || "active",
    active: payload.status !== "inactive",
    notes: String(payload.notes || "").trim()
  });
}

/* ---------- Theme ---------- */

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
}

document.addEventListener("DOMContentLoaded", initSharedUI);