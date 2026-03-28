import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "./firebase.js";
import {
  listenAuth,
  logout,
  syncUsernameChangeForUser,
  syncUsernameDirectoryByUserDoc
} from "./auth.js";
import { canAccess, getAllowedSections, getRoleLabel } from "./roles.js";

export const SERVICE_LIBRARY = {
  exterior: [
    { id: "driveway_cleaning", label: "Driveway Cleaning", rate: 0.20, unit: "sqft" },
    { id: "sidewalk_cleaning", label: "Sidewalk Cleaning", rate: 0.12, unit: "sqft" },
    { id: "patio_cleaning", label: "Patio Cleaning", rate: 0.18, unit: "sqft" },
    { id: "deck_cleaning", label: "Deck Cleaning", rate: 0.20, unit: "sqft" },
    { id: "house_wash", label: "House Wash", rate: 0.25, unit: "sqft" },
    { id: "fence_cleaning", label: "Fence Cleaning", rate: 12, unit: "panel" }
  ],
  trash_bin: [
    { id: "one_bin_monthly", label: "1 Bin Monthly", flat: 25 },
    { id: "two_bins_monthly", label: "2 Bins Monthly", flat: 45 },
    { id: "three_plus_bins_monthly", label: "3+ Bins Monthly", flat: 60 },
    { id: "one_time_bin_cleaning", label: "One-Time Bin Cleaning", flat: 30 }
  ],
  bundle: [
    { id: "driveway_sidewalk_bundle", label: "Driveway + Sidewalk Bundle", rate: 0.28, unit: "sqft" },
    { id: "full_exterior_bundle", label: "Full Exterior Package", rate: 0.38, unit: "sqft" },
    { id: "house_driveway_patio_bundle", label: "House + Driveway + Patio Bundle", rate: 0.42, unit: "sqft" }
  ]
};

export const ADD_ONS = [
  { id: "deodorizing", label: "Deodorizing", flat: 10 },
  { id: "rust_removal", label: "Rust Removal", flat: 25 },
  { id: "oil_stain_removal", label: "Oil Stain Removal", flat: 35 },
  { id: "mold_treatment", label: "Mold Treatment", flat: 20 },
  { id: "sealing", label: "Sealing", flat: 60 }
];

export const ROLE_DEFAULTS = {
  super_admin: {
    organizationLevel: 1,
    permissions: ["all"],
    companyAccessLevel: "parent",
    approvalStatus: "approved",
    status: "active"
  },
  admin: {
    organizationLevel: 2,
    permissions: ["manage_users", "approve", "full_company"],
    companyAccessLevel: "subsidiary",
    approvalStatus: "approved",
    status: "active"
  },
  manager: {
    organizationLevel: 3,
    permissions: ["leads", "jobs", "customers"],
    companyAccessLevel: "subsidiary",
    approvalStatus: "approved",
    status: "active"
  },
  operations_coordinator: {
    organizationLevel: 3,
    permissions: ["jobs", "customers"],
    companyAccessLevel: "subsidiary",
    approvalStatus: "approved",
    status: "active"
  },
  hr: {
    organizationLevel: 3,
    permissions: ["users", "staff"],
    companyAccessLevel: "subsidiary",
    approvalStatus: "approved",
    status: "active"
  },
  sales_rep: {
    organizationLevel: 4,
    permissions: ["leads", "convert"],
    companyAccessLevel: "subsidiary",
    approvalStatus: "approved",
    status: "active"
  },
  technician: {
    organizationLevel: 5,
    permissions: ["jobs"],
    companyAccessLevel: "subsidiary",
    approvalStatus: "approved",
    status: "active"
  },
  customer: {
    organizationLevel: 6,
    permissions: ["self"],
    companyAccessLevel: "subsidiary",
    approvalStatus: "approved",
    status: "active"
  }
};

export const USER_REQUIRED_FIELDS = [
  "name",
  "username",
  "handle",
  "displayUsername",
  "email",
  "role",
  "approvalStatus",
  "status",
  "companyId",
  "companyAccessLevel",
  "photoUrl",
  "createdAt",
  "lastLogin",
  "reportsTo",
  "organizationLevel",
  "permissions",
  "phone",
  "address",
  "city",
  "state",
  "zip",
  "preferredContactMethod",
  "updatedAt"
];

export function getRoleDefaults(role) {
  return ROLE_DEFAULTS[role] || ROLE_DEFAULTS.customer;
}

export function sanitizeCompanyId(value = "") {
  return String(value).trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
}

export function companyIdToSlug(value = "") {
  return sanitizeCompanyId(value).replace(/_/g, "-");
}

export function buildNormalizedUsernameFields(username = "") {
  const clean = String(username).trim().replace(/^@+/, "").toLowerCase();
  return {
    username: clean,
    handle: clean ? `@${clean}` : "",
    displayUsername: clean ? clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase() : ""
  };
}

export function calculateLeadEstimate(serviceCategory, serviceType, quantity, addOns = []) {
  const qty = Number(quantity || 0);
  const service = (SERVICE_LIBRARY[serviceCategory] || []).find((s) => s.id === serviceType);

  let total = 0;
  if (service?.rate) total += qty * service.rate;
  if (service?.flat) total += service.flat;

  addOns.forEach((addonId) => {
    const addon = ADD_ONS.find((a) => a.id === addonId);
    if (addon?.flat) total += addon.flat;
  });

  return Number(total.toFixed(2));
}

export function formatHandle(user) {
  return user?.handle || (user?.username ? `@${user.username}` : "@user");
}

export function formatDisplayUsername(user) {
  return user?.displayUsername || user?.username || "User";
}

export function buildNormalizedUserPayload(existing = {}) {
  const defaults = getRoleDefaults(existing.role);
  const usernameFields = buildNormalizedUsernameFields(existing.username || "");
  const companyId = sanitizeCompanyId(existing.companyId || "");

  return {
    ...usernameFields,
    role: existing.role || "customer",
    approvalStatus: existing.approvalStatus || defaults.approvalStatus,
    status: existing.status || defaults.status,
    companyId,
    companyAccessLevel: existing.companyAccessLevel || defaults.companyAccessLevel,
    organizationLevel:
      typeof existing.organizationLevel === "number"
        ? existing.organizationLevel
        : defaults.organizationLevel,
    permissions:
      Array.isArray(existing.permissions) && existing.permissions.length
        ? existing.permissions
        : defaults.permissions,
    photoUrl: existing.photoUrl || "",
    phone: existing.phone || "",
    address: existing.address || "",
    city: existing.city || "",
    state: existing.state || "",
    zip: existing.zip || "",
    preferredContactMethod: existing.preferredContactMethod || ""
  };
}

export async function normalizeUserDoc(userId) {
  const userRef = doc(db, "users", userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) throw new Error("User not found.");

  const existing = snap.data();
  const normalized = buildNormalizedUserPayload(existing);

  await updateDoc(userRef, {
    ...normalized,
    updatedAt: serverTimestamp()
  });

  if (normalized.username) {
    await syncUsernameDirectoryByUserDoc(userId);
  }

  return normalized;
}

export function buildNormalizedCompanyPayload(existing = {}, companyId = "") {
  const normalizedId = sanitizeCompanyId(
    companyId || existing.id || existing.companyId || existing.slug || existing.name || ""
  );
  const slug = String(existing.slug || companyIdToSlug(normalizedId)).trim().toLowerCase().replace(/_/g, "-");

  return {
    name: existing.name || "",
    slug,
    city: existing.city || "",
    state: existing.state || "",
    phone: existing.phone || "",
    email: existing.email || "",
    status: existing.status || "active",
    notes: existing.notes || "",
    ownerCompany: existing.ownerCompany || "Evaraos Inc",
    ownerName: existing.ownerName || "",
    ownerEmail: existing.ownerEmail || "",
    ownerUserId: existing.ownerUserId || "",
    parentCompany: existing.parentCompany || "Evaraos Inc",
    brandColor: existing.brandColor || "#E30613",
    logoUrl: existing.logoUrl || "",
    serviceCategories: Array.isArray(existing.serviceCategories) ? existing.serviceCategories : [],
    active: existing.active !== false
  };
}

export async function findCompanyDocFlexible(companyId) {
  const canonicalId = sanitizeCompanyId(companyId);
  if (!canonicalId) return null;

  const directRef = doc(db, "companies", canonicalId);
  const directSnap = await getDoc(directRef);
  if (directSnap.exists()) {
    return { id: directSnap.id, ref: directRef, data: directSnap.data(), matchedBy: "canonical_id" };
  }

  const legacyDashId = canonicalId.replace(/_/g, "-");
  if (legacyDashId && legacyDashId !== canonicalId) {
    const legacyRef = doc(db, "companies", legacyDashId);
    const legacySnap = await getDoc(legacyRef);
    if (legacySnap.exists()) {
      return { id: legacySnap.id, ref: legacyRef, data: legacySnap.data(), matchedBy: "legacy_dash_id" };
    }
  }

  const allCompanies = await getDocs(collection(db, "companies"));
  const candidates = allCompanies.docs.map((d) => ({ id: d.id, ...d.data() }));

  const bySlug = candidates.find((c) => sanitizeCompanyId(c.slug || "") === canonicalId);
  if (bySlug) {
    return {
      id: bySlug.id,
      ref: doc(db, "companies", bySlug.id),
      data: bySlug,
      matchedBy: "slug"
    };
  }

  const byName = candidates.find((c) => sanitizeCompanyId(c.name || "") === canonicalId);
  if (byName) {
    return {
      id: byName.id,
      ref: doc(db, "companies", byName.id),
      data: byName,
      matchedBy: "name"
    };
  }

  return null;
}

export async function normalizeCompanyDoc(companyId) {
  const canonicalId = sanitizeCompanyId(companyId);
  const found = await findCompanyDocFlexible(companyId);
  const canonicalRef = doc(db, "companies", canonicalId);

  if (!found) {
    const fallback = buildNormalizedCompanyPayload(
      {
        name: "Supreme TrueClean",
        slug: companyIdToSlug(canonicalId),
        city: "Jacksonville",
        state: "FL",
        phone: "",
        email: "",
        status: "active",
        notes: "",
        ownerCompany: "Evaraos Inc",
        ownerName: "Gilbert Ramos",
        ownerEmail: "gilbert37ramos@gmail.com",
        ownerUserId: "",
        parentCompany: "Evaraos Inc",
        brandColor: "#E30613",
        logoUrl: "",
        serviceCategories: [],
        active: true
      },
      canonicalId
    );

    await setDoc(
      canonicalRef,
      {
        ...fallback,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    return {
      canonicalId,
      previousId: null,
      matchedBy: "auto_created",
      normalized: fallback
    };
  }

  const normalized = buildNormalizedCompanyPayload(found.data, canonicalId);

  await setDoc(
    canonicalRef,
    {
      ...normalized,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return {
    canonicalId,
    previousId: found.id,
    matchedBy: found.matchedBy,
    normalized
  };
}

export function buildNormalizedLeadPayload(existing = {}) {
  return {
    companyId: sanitizeCompanyId(existing.companyId || ""),
    fullName: existing.fullName || "",
    phone: existing.phone || "",
    email: existing.email || "",
    address: existing.address || "",
    city: existing.city || "",
    state: existing.state || "",
    zip: existing.zip || "",
    serviceCategory: existing.serviceCategory || "",
    serviceType: existing.serviceType || "",
    serviceInterest: existing.serviceInterest || "",
    addOns: Array.isArray(existing.addOns) ? existing.addOns : [],
    leadSource: existing.leadSource || "",
    preferredContactMethod: existing.preferredContactMethod || "",
    estimatedSqFt: Number(existing.estimatedSqFt || 0),
    estimatedPrice: Number(existing.estimatedPrice || 0),
    assignedRep: existing.assignedRep || "",
    status: ["new", "contacted", "quoted", "scheduled", "won", "lost"].includes(existing.status)
      ? existing.status
      : "new",
    notes: existing.notes || "",
    appointmentDate: existing.appointmentDate || "",
    isArchived: existing.isArchived === true,
    deleteRequested: existing.deleteRequested === true,
    deleteRequestedBy: existing.deleteRequestedBy || "",
    deleteApprovedBy: existing.deleteApprovedBy || "",
    convertedToJobId: existing.convertedToJobId || ""
  };
}

export async function normalizeLeadDoc(leadId) {
  const leadRef = doc(db, "leads", leadId);
  const snap = await getDoc(leadRef);
  if (!snap.exists()) throw new Error("Lead not found.");

  const normalized = buildNormalizedLeadPayload(snap.data());

  await updateDoc(leadRef, {
    ...normalized,
    updatedAt: serverTimestamp()
  });

  return normalized;
}

export function buildNormalizedJobPayload(existing = {}) {
  const allowedStatuses = ["scheduled", "in_progress", "completed", "cancelled"];
  const allowedPaymentStatuses = ["unpaid", "paid", "refunded", "pending", "partial"];

  return {
    companyId: sanitizeCompanyId(existing.companyId || ""),
    sourceLeadId: existing.sourceLeadId || "",
    customerName: existing.customerName || "",
    customerPhone: existing.customerPhone || "",
    customerEmail: existing.customerEmail || "",
    address: existing.address || "",
    city: existing.city || "",
    state: existing.state || "",
    zip: existing.zip || "",
    serviceType: existing.serviceType || "",
    assignedRep: existing.assignedRep || "",
    assignedTechnician: existing.assignedTechnician || "",
    scheduledDate: existing.scheduledDate || "",
    scheduledTimeWindow: existing.scheduledTimeWindow || "",
    estimatedSqFt: Number(existing.estimatedSqFt || 0),
    estimatedPrice: Number(existing.estimatedPrice || 0),
    status: allowedStatuses.includes(existing.status) ? existing.status : "scheduled",
    notes: existing.notes || "",
    beforePhotos: Array.isArray(existing.beforePhotos) ? existing.beforePhotos : [],
    afterPhotos: Array.isArray(existing.afterPhotos) ? existing.afterPhotos : [],
    completionNotes: existing.completionNotes || "",
    paymentStatus: allowedPaymentStatuses.includes(existing.paymentStatus) ? existing.paymentStatus : "unpaid",
    invoiceId: existing.invoiceId || "",
    customerSignature: existing.customerSignature || "",
    routeOrder: Number(existing.routeOrder || 0),
    crewNotes: existing.crewNotes || "",
    arrivalTime: existing.arrivalTime || "",
    departureTime: existing.departureTime || "",
    assignedCrewIds: Array.isArray(existing.assignedCrewIds) ? existing.assignedCrewIds : [],
    serviceAddOns: Array.isArray(existing.serviceAddOns) ? existing.serviceAddOns : []
  };
}

export async function normalizeJobDoc(jobId) {
  const jobRef = doc(db, "jobs", jobId);
  const snap = await getDoc(jobRef);
  if (!snap.exists()) throw new Error("Job not found.");

  const normalized = buildNormalizedJobPayload(snap.data());

  await updateDoc(jobRef, {
    ...normalized,
    updatedAt: serverTimestamp()
  });

  return normalized;
}

export function buildNormalizedServicePayload(existing = {}) {
  const slug = String(existing.slug || existing.name || "").trim().toLowerCase().replace(/\s+/g, "_");
  return {
    companyId: sanitizeCompanyId(existing.companyId || ""),
    name: existing.name || "",
    slug,
    category: existing.category || "",
    pricingType: existing.pricingType || "",
    baseRate: Number(existing.baseRate || 0),
    unit: existing.unit || "",
    active: existing.active !== false,
    description: existing.description || "",
    addOnsAllowed: Array.isArray(existing.addOnsAllowed) ? existing.addOnsAllowed : [],
    bundleEligible: existing.bundleEligible === true,
    internalNotes: existing.internalNotes || "",
    featured: existing.featured === true,
    displayOrder: Number(existing.displayOrder || 0),
    minPrice: Number(existing.minPrice || 0),
    maxPrice: Number(existing.maxPrice || 0),
    defaultAddOns: Array.isArray(existing.defaultAddOns) ? existing.defaultAddOns : [],
    estimatedDurationMinutes: Number(existing.estimatedDurationMinutes || 0),
    requiresInspection: existing.requiresInspection === true,
    customerVisible: existing.customerVisible !== false
  };
}

export async function normalizeServiceDoc(serviceId) {
  const serviceRef = doc(db, "services", serviceId);
  const snap = await getDoc(serviceRef);
  if (!snap.exists()) throw new Error("Service not found.");

  const normalized = buildNormalizedServicePayload(snap.data());

  await updateDoc(serviceRef, {
    ...normalized,
    updatedAt: serverTimestamp()
  });

  return normalized;
}

export async function loadBrandSettings() {
  try {
    const snap = await getDoc(doc(db, "settings", "app"));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

export async function loadCompany(companyId) {
  try {
    if (!companyId) return null;

    const found = await findCompanyDocFlexible(companyId);
    if (!found) return null;

    if (found.id !== sanitizeCompanyId(companyId)) {
      try {
        await normalizeCompanyDoc(companyId);
      } catch (e) {
        console.warn("Company auto-heal skipped", e);
      }
    }

    const canonicalRef = doc(db, "companies", sanitizeCompanyId(companyId));
    const canonicalSnap = await getDoc(canonicalRef);
    if (canonicalSnap.exists()) {
      return { id: canonicalSnap.id, ...canonicalSnap.data() };
    }

    return { id: found.id, ...found.data };
  } catch {
    return null;
  }
}

export function getDashboardPath(role) {
  return role === "customer" ? "customer_dashboard.html" : "dashboard.html";
}

export function hasPermission(user, permission) {
  if (!user) return false;
  if (!Array.isArray(user.permissions)) return false;
  return user.permissions.includes("all") || user.permissions.includes(permission);
}

export async function bindTopbar(user = null) {
  const topbar = document.getElementById("topbar");
  if (!topbar) return;

  const settings = await loadBrandSettings();
  const company = user?.companyId ? await loadCompany(user.companyId) : null;
  const homeHref = "index.html";
  const dashboardHref = user ? getDashboardPath(user.role) : "dashboard.html";

  const identityName = user ? user.name || formatDisplayUsername(user) : "Guest";
  const identityHandle = user ? formatHandle(user) : "";
  const identityCompany = company?.name || settings?.companyName || "Supreme TrueClean";

  topbar.innerHTML = `
    <div class="app-topbar-inner">
      <a class="app-brand" href="${homeHref}">
        <img src="${settings?.logoUrl || "assets/img/evaraos_logo.png"}" alt="logo">
        <div class="app-brand-text">
          <strong>${settings?.platformName || "Evaraos Inc"}</strong>
          <span>${identityCompany}</span>
        </div>
      </a>

      ${
        user
          ? `
        <div class="topbar-identity" style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;margin-left:auto;margin-right:14px;">
          <strong style="font-size:14px;line-height:1.2;">${identityName}</strong>
          <span style="font-size:12px;color:#b8c0d0;line-height:1.2;">${identityHandle}</span>
        </div>
      `
          : ""
      }

      <nav class="app-nav">
        <a href="${homeHref}">Home</a>
        <a href="${dashboardHref}" class="active">Dashboard</a>
        <button id="logoutBtn">Logout</button>
      </nav>
    </div>
  `;

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await logout();
      window.location.href = "login.html";
    };
  }
}

export function requireAuth(renderFn) {
  listenAuth(async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    try {
      await normalizeUserDoc(user.id || user.uid);
    } catch (e) {
      console.warn("User normalization skipped", e);
    }

    if (user.approvalStatus !== "approved") {
      document.body.innerHTML = `
        <div class="auth-shell">
          <div class="auth-card">
            <h2>Waiting for approval</h2>
            <p class="muted">Your account is pending approval.</p>
          </div>
        </div>
      `;
      return;
    }

    renderFn(user);
  });
}

export async function fetchCompanyCollection(name, companyId) {
  const q = query(collection(db, name), where("companyId", "==", sanitizeCompanyId(companyId)));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchAllCollection(name) {
  const snap = await getDocs(collection(db, name));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchUsersByCompany(companyId) {
  const q = query(collection(db, "users"), where("companyId", "==", sanitizeCompanyId(companyId)));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchPendingUsersByCompany(companyId, includeAll = false) {
  let qRef;

  if (includeAll) {
    qRef = query(collection(db, "users"), where("approvalStatus", "==", "pending"));
  } else {
    qRef = query(
      collection(db, "users"),
      where("companyId", "==", sanitizeCompanyId(companyId)),
      where("approvalStatus", "==", "pending")
    );
  }

  const snap = await getDocs(qRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchActiveSalesReps(companyId) {
  const q = query(
    collection(db, "users"),
    where("companyId", "==", sanitizeCompanyId(companyId)),
    where("role", "==", "sales_rep"),
    where("status", "==", "active"),
    where("approvalStatus", "==", "approved")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchActiveTechnicians(companyId) {
  const q = query(
    collection(db, "users"),
    where("companyId", "==", sanitizeCompanyId(companyId)),
    where("role", "==", "technician"),
    where("status", "==", "active"),
    where("approvalStatus", "==", "approved")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function renderSidebar(role, active = "overview") {
  const links = [
    { key: "overview", label: "Overview", href: role === "customer" ? "customer_dashboard.html" : "dashboard.html" },
    { key: "users", label: "Users", href: "users.html" },
    { key: "leads", label: "Leads", href: "leads.html" },
    { key: "sales_reps", label: "Sales Reps", href: "sales_reps.html" },
    { key: "companies", label: "Companies", href: "companies.html" },
    { key: "jobs", label: "Jobs", href: "jobs.html" },
    { key: "customers", label: "Customers", href: "#" },
    { key: "settings", label: "Settings", href: "#" }
  ];

  if (role === "super_admin") {
    links.push({ key: "audit", label: "Audit", href: "audit.html" });
  }

  return links
    .filter((link) => link.key === "audit" || canAccess(role, link.key))
    .map((link) => `<a class="${active === link.key ? "active" : ""}" href="${link.href}">${link.label}</a>`)
    .join("");
}

export function renderRoleSummary(user) {
  const sections = getAllowedSections(user.role);
  const prettyRole = getRoleLabel(user.role);

  return `
    <strong>${user.name || user.email}</strong><br>
    Display Username: ${formatDisplayUsername(user)}<br>
    Handle: ${formatHandle(user)}<br>
    Role: ${prettyRole}<br>
    Company: ${user.companyId}<br>
    Access Level: ${user.companyAccessLevel || "subsidiary"}<br>
    Sections: ${sections.join(", ")}<br>
    Org Level: ${user.organizationLevel || "—"}
  `;
}

export function renderPermissionBadges(user) {
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  if (!permissions.length) return `<span class="muted">No permissions found</span>`;
  return permissions.map((item) => `<span class="badge">${item}</span>`).join("");
}

export function roleGuard(user, requiredSection) {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  return canAccess(user.role, requiredSection);
}

export function groupUsersByRole(users) {
  const order = [
    "super_admin",
    "admin",
    "manager",
    "operations_coordinator",
    "sales_rep",
    "technician",
    "hr",
    "customer"
  ];

  const groups = {};
  order.forEach((role) => {
    groups[role] = users.filter((user) => user.role === role);
  });

  const extras = users.filter((user) => !order.includes(user.role));
  if (extras.length) groups.other = extras;

  return groups;
}

export async function createLead(data, user) {
  return addDoc(collection(db, "leads"), {
    companyId: sanitizeCompanyId(user.companyId),
    fullName: data.fullName || "",
    phone: data.phone || "",
    email: data.email || "",
    address: data.address || "",
    city: data.city || "",
    state: data.state || "",
    zip: data.zip || "",
    serviceCategory: data.serviceCategory || "",
    serviceType: data.serviceType || "",
    serviceInterest: data.serviceLabel || "",
    addOns: data.addOns || [],
    leadSource: data.leadSource || "",
    preferredContactMethod: data.preferredContactMethod || "",
    estimatedSqFt: Number(data.estimatedSqFt || 0),
    estimatedPrice: Number(data.estimatedPrice || 0),
    assignedRep: data.assignedRep || "",
    status: data.status || "new",
    notes: data.notes || "",
    appointmentDate: data.appointmentDate || "",
    isArchived: false,
    deleteRequested: false,
    deleteRequestedBy: "",
    deleteApprovedBy: "",
    createdBy: user.email || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateLead(leadId, data) {
  return updateDoc(doc(db, "leads", leadId), {
    fullName: data.fullName || "",
    phone: data.phone || "",
    email: data.email || "",
    address: data.address || "",
    city: data.city || "",
    state: data.state || "",
    zip: data.zip || "",
    serviceCategory: data.serviceCategory || "",
    serviceType: data.serviceType || "",
    serviceInterest: data.serviceLabel || "",
    addOns: data.addOns || [],
    leadSource: data.leadSource || "",
    preferredContactMethod: data.preferredContactMethod || "",
    estimatedSqFt: Number(data.estimatedSqFt || 0),
    estimatedPrice: Number(data.estimatedPrice || 0),
    assignedRep: data.assignedRep || "",
    status: data.status || "new",
    notes: data.notes || "",
    appointmentDate: data.appointmentDate || "",
    updatedAt: serverTimestamp()
  });
}

export async function archiveLead(leadId, user) {
  return updateDoc(doc(db, "leads", leadId), {
    isArchived: true,
    archivedBy: user.email || "",
    updatedAt: serverTimestamp()
  });
}

export async function requestDeleteLead(leadId, user) {
  return updateDoc(doc(db, "leads", leadId), {
    deleteRequested: true,
    deleteRequestedBy: user.email || "",
    updatedAt: serverTimestamp()
  });
}

export async function approveDeleteLead(leadId, user) {
  await updateDoc(doc(db, "leads", leadId), {
    deleteApprovedBy: user.email || "",
    updatedAt: serverTimestamp()
  });
  return deleteDoc(doc(db, "leads", leadId));
}

export async function convertLeadToJob(lead, data, user) {
  const jobRef = await addDoc(collection(db, "jobs"), {
    companyId: sanitizeCompanyId(user.companyId),
    sourceLeadId: lead.id,
    customerName: lead.fullName || "",
    customerPhone: lead.phone || "",
    customerEmail: lead.email || "",
    address: lead.address || "",
    city: lead.city || "",
    state: lead.state || "",
    zip: lead.zip || "",
    serviceType: data.serviceType || lead.serviceInterest || "",
    assignedRep: lead.assignedRep || "",
    assignedTechnician: data.assignedTechnician || "",
    scheduledDate: data.scheduledDate || "",
    scheduledTimeWindow: data.scheduledTimeWindow || "",
    estimatedSqFt: Number(lead.estimatedSqFt || 0),
    estimatedPrice: Number(lead.estimatedPrice || 0),
    status: "scheduled",
    notes: data.notes || lead.notes || "",
    beforePhotos: [],
    afterPhotos: [],
    completionNotes: "",
    paymentStatus: "unpaid",
    invoiceId: "",
    customerSignature: "",
    routeOrder: 0,
    crewNotes: "",
    arrivalTime: "",
    departureTime: "",
    assignedCrewIds: [],
    serviceAddOns: [],
    createdBy: user.email || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await updateDoc(doc(db, "leads", lead.id), {
    status: "scheduled",
    convertedToJobId: jobRef.id,
    updatedAt: serverTimestamp()
  });

  return jobRef;
}

export async function createSalesRep(data, user) {
  const usernameFields = buildNormalizedUsernameFields(data.username || "");
  const docRef = await addDoc(collection(db, "users"), {
    companyId: sanitizeCompanyId(user.companyId),
    name: data.fullName || "",
    ...usernameFields,
    email: data.email || "",
    phone: data.phone || "",
    status: data.status || "active",
    approvalStatus: data.approvalStatus || "approved",
    role: "sales_rep",
    organizationLevel: 4,
    permissions: ["leads", "convert"],
    companyAccessLevel: "subsidiary",
    photoUrl: "",
    reportsTo: data.reportsTo || user.id || "",
    address: "",
    city: "",
    state: "",
    zip: "",
    preferredContactMethod: "",
    notes: data.notes || "",
    createdBy: user.email || "",
    createdAt: serverTimestamp(),
    lastLogin: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  if (usernameFields.username) {
    await syncUsernameDirectoryByUserDoc(docRef.id);
  }

  return docRef;
}

export async function updateSalesRep(repId, data) {
  const existingSnap = await getDoc(doc(db, "users", repId));
  if (!existingSnap.exists()) throw new Error("Sales rep not found.");

  const existingUser = existingSnap.data();
  const newUsername = String(data.username || existingUser.username || "").trim().toLowerCase();

  await updateDoc(doc(db, "users", repId), {
    name: data.fullName || existingUser.name || "",
    email: data.email || existingUser.email || "",
    phone: data.phone || existingUser.phone || "",
    status: data.status || existingUser.status || "active",
    notes: data.notes || existingUser.notes || "",
    updatedAt: serverTimestamp()
  });

  if (newUsername && newUsername !== (existingUser.username || "")) {
    await syncUsernameChangeForUser(repId, newUsername);
  } else {
    await syncUsernameDirectoryByUserDoc(repId);
  }
}

export async function createCompany(data, user) {
  const companyId = sanitizeCompanyId(data.companyId || data.slug || data.name || "");
  const slug = String(data.slug || data.name || "").trim().toLowerCase().replace(/\s+/g, "-");

  await setDoc(doc(db, "companies", companyId), {
    name: data.name || "",
    slug,
    city: data.city || "",
    state: data.state || "",
    phone: data.phone || "",
    email: data.email || "",
    status: data.status || "active",
    notes: data.notes || "",
    ownerCompany: "Evaraos Inc",
    ownerName: data.ownerName || "",
    ownerEmail: data.ownerEmail || "",
    ownerUserId: data.ownerUserId || "",
    parentCompany: "Evaraos Inc",
    brandColor: data.brandColor || "#E30613",
    logoUrl: data.logoUrl || "",
    serviceCategories: data.serviceCategories || [],
    active: data.active !== false,
    createdBy: user.email || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return doc(db, "companies", companyId);
}

export async function updateCompany(companyId, data) {
  return updateDoc(doc(db, "companies", sanitizeCompanyId(companyId)), {
    name: data.name || "",
    slug: data.slug || "",
    city: data.city || "",
    state: data.state || "",
    phone: data.phone || "",
    email: data.email || "",
    status: data.status || "active",
    notes: data.notes || "",
    ownerName: data.ownerName || "",
    ownerEmail: data.ownerEmail || "",
    ownerUserId: data.ownerUserId || "",
    parentCompany: data.parentCompany || "Evaraos Inc",
    brandColor: data.brandColor || "#E30613",
    logoUrl: data.logoUrl || "",
    serviceCategories: data.serviceCategories || [],
    active: data.active !== false,
    updatedAt: serverTimestamp()
  });
}

export async function updateUserAdmin(userId, data) {
  const existingSnap = await getDoc(doc(db, "users", userId));
  if (!existingSnap.exists()) {
    throw new Error("User not found.");
  }

  const existingUser = existingSnap.data();
  const newUsername = String(data.username || existingUser.username || "").trim().toLowerCase();

  if (existingUser.role === "super_admin") {
    await updateDoc(doc(db, "users", userId), {
      name: data.name,
      companyId: sanitizeCompanyId(data.companyId),
      status: "active",
      phone: data.phone || "",
      address: data.address || "",
      city: data.city || "",
      state: data.state || "",
      zip: data.zip || "",
      role: "super_admin",
      approvalStatus: "approved",
      organizationLevel: 1,
      permissions: ["all"],
      companyAccessLevel: "parent",
      updatedAt: serverTimestamp()
    });

    if (newUsername && newUsername !== (existingUser.username || "")) {
      await syncUsernameChangeForUser(userId, newUsername);
    } else {
      await syncUsernameDirectoryByUserDoc(userId);
    }

    return;
  }

  const defaults = getRoleDefaults(data.role);

  await updateDoc(doc(db, "users", userId), {
    name: data.name,
    role: data.role,
    approvalStatus: data.approvalStatus || defaults.approvalStatus,
    companyId: sanitizeCompanyId(data.companyId),
    status: data.status || defaults.status,
    phone: data.phone || "",
    address: data.address || "",
    city: data.city || "",
    state: data.state || "",
    zip: data.zip || "",
    organizationLevel: defaults.organizationLevel,
    permissions: defaults.permissions,
    companyAccessLevel: defaults.companyAccessLevel,
    updatedAt: serverTimestamp()
  });

  if (newUsername && newUsername !== (existingUser.username || "")) {
    await syncUsernameChangeForUser(userId, newUsername);
  } else {
    await syncUsernameDirectoryByUserDoc(userId);
  }
}

export async function approveUser(userId) {
  const existingSnap = await getDoc(doc(db, "users", userId));
  if (!existingSnap.exists()) throw new Error("User not found.");

  const existingUser = existingSnap.data();
  const defaults = getRoleDefaults(existingUser.role);

  if (existingUser.role === "super_admin") {
    await updateDoc(doc(db, "users", userId), {
      role: "super_admin",
      approvalStatus: "approved",
      status: "active",
      organizationLevel: 1,
      permissions: ["all"],
      companyAccessLevel: "parent",
      updatedAt: serverTimestamp()
    });
  } else {
    await updateDoc(doc(db, "users", userId), {
      approvalStatus: "approved",
      status: "active",
      organizationLevel: defaults.organizationLevel,
      permissions: defaults.permissions,
      companyAccessLevel: defaults.companyAccessLevel,
      updatedAt: serverTimestamp()
    });
  }

  await syncUsernameDirectoryByUserDoc(userId);
}

export async function rejectUser(userId) {
  const existingSnap = await getDoc(doc(db, "users", userId));
  if (!existingSnap.exists()) throw new Error("User not found.");

  const existingUser = existingSnap.data();
  if (existingUser.role === "super_admin") {
    throw new Error("Super Admin cannot be rejected.");
  }

  await updateDoc(doc(db, "users", userId), {
    approvalStatus: "rejected",
    status: "inactive",
    updatedAt: serverTimestamp()
  });

  await syncUsernameDirectoryByUserDoc(userId);
}

export async function updateOwnCustomerProfile(userId, data) {
  const existingSnap = await getDoc(doc(db, "users", userId));
  if (!existingSnap.exists()) throw new Error("User not found.");

  const existingUser = existingSnap.data();
  const newUsername = String(data.username || existingUser.username || "").trim().toLowerCase();

  await updateDoc(doc(db, "users", userId), {
    name: data.name,
    email: data.email,
    phone: data.phone || "",
    address: data.address || "",
    city: data.city || "",
    state: data.state || "",
    zip: data.zip || "",
    photoUrl: data.photoUrl || "",
    preferredContactMethod: data.preferredContactMethod || "",
    updatedAt: serverTimestamp()
  });

  if (newUsername && newUsername !== (existingUser.username || "")) {
    await syncUsernameChangeForUser(userId, newUsername);
  } else {
    await syncUsernameDirectoryByUserDoc(userId);
  }
}

export async function fetchCustomerServices(user) {
  return [
    {
      id: "trash-bin-monthly",
      name: "Trash Bin Cleaning Subscription",
      status: "active",
      billingType: "monthly",
      cancellationPolicy: "Early cancellation may include termination fees depending on contract terms.",
      canRequestChanges: true
    },
    {
      id: "driveway-cleaning",
      name: "Driveway Cleaning",
      status: "inactive",
      billingType: "one_time",
      cancellationPolicy: "One-time services can be removed before scheduling confirmation.",
      canRequestChanges: true
    }
  ];
}

export async function scanSystemDiscrepancies() {
  const [users, usernames, companies, leads, jobs, services] = await Promise.all([
    fetchAllCollection("users").catch(() => []),
    fetchAllCollection("usernames").catch(() => []),
    fetchAllCollection("companies").catch(() => []),
    fetchAllCollection("leads").catch(() => []),
    fetchAllCollection("jobs").catch(() => []),
    fetchAllCollection("services").catch(() => [])
  ]);

  const discrepancies = {
    users: [],
    usernames: [],
    companies: [],
    leads: [],
    jobs: [],
    services: []
  };

  const usernameMap = new Map(usernames.map((item) => [item.id, item]));

  users.forEach((user) => {
    const normalized = buildNormalizedUserPayload(user);
    const missingFields = USER_REQUIRED_FIELDS.filter((field) => {
      if (field === "permissions") return !Array.isArray(user.permissions) || !user.permissions.length;
      return user[field] === undefined;
    });

    const mismatchFields = [];

    if ((user.companyId || "") !== normalized.companyId) mismatchFields.push("companyId");
    if ((user.handle || "") !== normalized.handle) mismatchFields.push("handle");
    if ((user.displayUsername || "") !== normalized.displayUsername) mismatchFields.push("displayUsername");
    if ((user.companyAccessLevel || "") !== normalized.companyAccessLevel) mismatchFields.push("companyAccessLevel");
    if (typeof user.organizationLevel !== "number" || user.organizationLevel !== normalized.organizationLevel) {
      mismatchFields.push("organizationLevel");
    }
    if (!Array.isArray(user.permissions) || JSON.stringify(user.permissions) !== JSON.stringify(normalized.permissions)) {
      mismatchFields.push("permissions");
    }

    const usernameDoc = usernameMap.get(normalized.username);
    if (!normalized.username) mismatchFields.push("username");
    if (!usernameDoc) mismatchFields.push("username_directory_missing");

    if (missingFields.length || mismatchFields.length) {
      discrepancies.users.push({
        id: user.id,
        name: user.name || user.email || user.id,
        role: user.role || "unknown",
        missingFields,
        mismatchFields
      });
    }
  });

  usernames.forEach((entry) => {
    const linkedUser = users.find((u) => u.id === entry.uid);
    const issues = [];

    if (!linkedUser) issues.push("uid_missing_in_users");
    if (entry.id !== (linkedUser?.username || entry.id)) issues.push("doc_id_username_mismatch");
    if ((entry.companyId || "") !== sanitizeCompanyId(entry.companyId || "")) issues.push("companyId_not_standardized");
    if (entry.handle !== `@${entry.id}`) issues.push("handle_mismatch");

    if (issues.length) {
      discrepancies.usernames.push({ id: entry.id, issues });
    }
  });

  companies.forEach((company) => {
    const issues = [];
    const normalized = buildNormalizedCompanyPayload(company, company.id);

    if (company.id !== sanitizeCompanyId(company.id)) issues.push("doc_id_not_standardized");
    if ((company.slug || "") !== normalized.slug) issues.push("slug_mismatch");
    if (!company.ownerName) issues.push("ownerName_missing");
    if (!company.ownerEmail) issues.push("ownerEmail_missing");
    if (company.active === undefined) issues.push("active_missing");
    if (!company.brandColor) issues.push("brandColor_missing");

    if (issues.length) {
      discrepancies.companies.push({ id: company.id, issues });
    }
  });

  leads.forEach((lead) => {
    const issues = [];
    const normalized = buildNormalizedLeadPayload(lead);

    if ((lead.companyId || "") !== normalized.companyId) issues.push("companyId_not_standardized");
    if (lead.status !== normalized.status) issues.push("status_outside_allowed_values");
    if (!lead.createdAt) issues.push("createdAt_missing");
    if (!lead.updatedAt) issues.push("updatedAt_missing");

    if (issues.length) {
      discrepancies.leads.push({ id: lead.id, issues });
    }
  });

  jobs.forEach((job) => {
    const issues = [];
    const normalized = buildNormalizedJobPayload(job);

    if ((job.companyId || "") !== normalized.companyId) issues.push("companyId_not_standardized");
    if (job.status !== normalized.status) issues.push("status_outside_allowed_values");
    if ((job.paymentStatus || "unpaid") !== normalized.paymentStatus) issues.push("paymentStatus_outside_allowed_values");

    [
      "sourceLeadId",
      "assignedTechnician",
      "serviceAddOns",
      "assignedCrewIds",
      "arrivalTime",
      "departureTime",
      "crewNotes",
      "beforePhotos",
      "afterPhotos",
      "completionNotes",
      "paymentStatus",
      "invoiceId",
      "customerSignature",
      "routeOrder"
    ].forEach((field) => {
      if (job[field] === undefined) issues.push(`${field}_missing`);
    });

    if (issues.length) {
      discrepancies.jobs.push({ id: job.id, issues });
    }
  });

  services.forEach((service) => {
    const issues = [];
    const normalized = buildNormalizedServicePayload(service);

    if ((service.companyId || "") !== normalized.companyId) issues.push("companyId_not_standardized");
    if ((service.slug || "") !== normalized.slug) issues.push("slug_missing_or_mismatch");
    if (service.active === undefined) issues.push("active_missing");
    if (!service.category) issues.push("category_missing");
    if (!service.pricingType) issues.push("pricingType_missing");

    if (issues.length) {
      discrepancies.services.push({ id: service.id, issues });
    }
  });

  return discrepancies;
}