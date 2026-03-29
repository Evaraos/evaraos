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
  syncUsernameDirectoryByUserDoc
} from "./auth.js";
import { canAccess, getAllowedSections, getRoleLabel } from "./roles.js";

export const SERVICE_LIBRARY = {
  exterior: [
    { id: "driveway_cleaning", label: "Driveway Cleaning", rate: 0.2, unit: "sqft" },
    { id: "sidewalk_cleaning", label: "Sidewalk Cleaning", rate: 0.12, unit: "sqft" },
    { id: "patio_cleaning", label: "Patio Cleaning", rate: 0.18, unit: "sqft" },
    { id: "deck_cleaning", label: "Deck Cleaning", rate: 0.2, unit: "sqft" },
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

export async function cleanupLegacyCompanyDocs() {
  const companies = await fetchAllCollection("companies");
  const grouped = new Map();
  const deleted = [];
  const canonicalized = [];

  companies.forEach((company) => {
    const canonicalId = sanitizeCompanyId(company.id || company.slug || company.name || "");
    if (!canonicalId) return;
    if (!grouped.has(canonicalId)) grouped.set(canonicalId, []);
    grouped.get(canonicalId).push(company);
  });

  for (const [canonicalId, docs] of grouped.entries()) {
    await normalizeCompanyDoc(canonicalId);
    canonicalized.push(canonicalId);

    for (const legacy of docs) {
      if (legacy.id !== canonicalId) {
        try {
          await deleteDoc(doc(db, "companies", legacy.id));
          deleted.push(legacy.id);
        } catch (e) {
          console.warn("Could not delete legacy company doc", legacy.id, e);
        }
      }
    }
  }

  return { canonicalized, deleted };
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

export async function cleanupUsernameDirectory() {
  const [users, usernames] = await Promise.all([
    fetchAllCollection("users"),
    fetchAllCollection("usernames")
  ]);

  const removed = [];
  const repaired = [];

  for (const entry of usernames) {
    const linkedUser = users.find((u) => u.id === entry.uid);

    if (!linkedUser) {
      try {
        await deleteDoc(doc(db, "usernames", entry.id));
        removed.push(entry.id);
      } catch (e) {
        console.warn("Could not delete orphan username doc", entry.id, e);
      }
      continue;
    }

    const currentUsername = buildNormalizedUsernameFields(linkedUser.username || "").username;
    const expectedHandle = currentUsername ? `@${currentUsername}` : "";

    if (!currentUsername) {
      try {
        await deleteDoc(doc(db, "usernames", entry.id));
        removed.push(entry.id);
      } catch (e) {
        console.warn("Could not delete blank username doc", entry.id, e);
      }
      continue;
    }

    if (entry.id !== currentUsername || entry.handle !== expectedHandle) {
      await syncUsernameDirectoryByUserDoc(linkedUser.id);

      if (entry.id !== currentUsername) {
        try {
          await deleteDoc(doc(db, "usernames", entry.id));
          removed.push(entry.id);
        } catch (e) {
          console.warn("Could not delete stale username doc", entry.id, e);
        }
      } else {
        repaired.push(entry.id);
      }
    }
  }

  for (const user of users) {
    const normalized = buildNormalizedUserPayload(user);
    if (normalized.username) {
      const snap = await getDoc(doc(db, "usernames", normalized.username));
      if (!snap.exists()) {
        await syncUsernameDirectoryByUserDoc(user.id);
        repaired.push(normalized.username);
      }
    }
  }

  return { removed, repaired };
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

function injectTopbarStyles() {
  if (document.getElementById("appTopbarEnhancements")) return;

  const style = document.createElement("style");
  style.id = "appTopbarEnhancements";
  style.textContent = `
    .app-topbar-shell{
      display:flex;
      flex-direction:column;
      gap:18px;
      padding:22px 22px 10px;
    }
    .app-topbar-inner{
      display:grid;
      grid-template-columns:minmax(0,1fr) auto;
      align-items:center;
      gap:16px;
    }
    .app-brand{
      display:flex;
      align-items:center;
      gap:14px;
      color:#fff;
      text-decoration:none;
      min-width:0;
    }
    .app-brand img{
      width:48px;
      height:48px;
      border-radius:50%;
      object-fit:cover;
      flex-shrink:0;
    }
    .app-brand-text{
      display:flex;
      flex-direction:column;
      min-width:0;
    }
    .app-brand-text strong{
      font-size:18px;
      line-height:1.1;
    }
    .app-brand-text span{
      color:#c0c8d6;
      font-size:13px;
      line-height:1.2;
      margin-top:4px;
    }
    .topbar-identity{
      display:flex;
      flex-direction:column;
      align-items:flex-end;
      gap:3px;
      min-width:0;
    }
    .topbar-identity strong{
      font-size:14px;
      line-height:1.2;
      text-align:right;
    }
    .topbar-identity span{
      font-size:12px;
      color:#b8c0d0;
      line-height:1.2;
      text-align:right;
    }
    .app-nav{
      display:grid;
      grid-template-columns:repeat(4,minmax(0,auto));
      justify-content:start;
      align-items:center;
      gap:12px;
    }
    .app-nav a,
    .app-nav button,
    .topbar-menu-btn{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-height:50px;
      min-width:118px;
      padding:12px 18px;
      border-radius:999px;
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.08);
      color:#fff;
      text-decoration:none;
      font:inherit;
      cursor:pointer;
      transition:.2s ease;
      box-sizing:border-box;
    }
    .app-nav a:hover,
    .app-nav button:hover,
    .app-nav a.active,
    .topbar-menu-btn:hover,
    .topbar-menu-btn.open{
      background:rgba(255,255,255,.10);
      transform:translateY(-1px);
    }
    .topbar-menu-wrap{
      position:relative;
      display:inline-flex;
    }
    .topbar-menu-btn{
      gap:8px;
    }
    .topbar-menu-caret{
      transition:transform .22s ease;
    }
    .topbar-menu-btn.open .topbar-menu-caret{
      transform:rotate(180deg);
    }
    .topbar-dropdown{
      position:absolute;
      top:calc(100% + 10px);
      right:0;
      min-width:300px;
      max-width:360px;
      padding:12px;
      border-radius:22px;
      background:rgba(18,20,28,.96);
      border:1px solid rgba(255,255,255,.09);
      backdrop-filter:blur(18px);
      box-shadow:0 22px 50px rgba(0,0,0,.36);
      display:flex;
      flex-direction:column;
      gap:10px;
      opacity:0;
      pointer-events:none;
      transform:translateY(-8px) scale(.98);
      transition:opacity .22s ease, transform .22s ease;
      z-index:9990;
      max-height:70vh;
      overflow:auto;
    }
    .topbar-dropdown.open{
      opacity:1;
      pointer-events:auto;
      transform:translateY(0) scale(1);
    }
    .topbar-dropdown a{
      display:flex;
      flex-direction:column;
      gap:4px;
      padding:14px 16px;
      border-radius:18px;
      text-decoration:none;
      color:#fff;
      background:rgba(255,255,255,.03);
      border:1px solid rgba(255,255,255,.07);
      transition:.18s ease;
    }
    .topbar-dropdown a:hover{
      background:rgba(255,255,255,.08);
      transform:translateY(-1px);
    }
    .topbar-dropdown a strong{
      font-size:15px;
      line-height:1.2;
    }
    .topbar-dropdown a span{
      font-size:12px;
      color:#b2bbca;
      line-height:1.35;
    }
    @media (max-width: 900px){
      .app-topbar-inner{
        grid-template-columns:1fr;
        align-items:flex-start;
      }
      .topbar-identity{
        align-items:flex-start;
      }
      .app-nav{
        grid-template-columns:repeat(2,minmax(0,1fr));
        width:100%;
      }
      .app-nav a,
      .app-nav button,
      .topbar-menu-btn,
      .topbar-menu-wrap{
        width:100%;
      }
      .topbar-dropdown{
        left:0;
        right:0;
        min-width:unset;
        max-width:unset;
      }
    }
    @media (max-width: 560px){
      .app-nav{
        grid-template-columns:1fr 1fr;
      }
    }
  `;
  document.head.appendChild(style);
}

function getGlobalNavItems(role) {
  const items = [
    { key: "overview", label: "Overview", href: "dashboard.html", desc: "Main dashboard and KPIs" },
    { key: "users", label: "Users", href: "users.html", desc: "User accounts and staff records" },
    { key: "leads", label: "Leads", href: "leads.html", desc: "Pipeline, assignments, conversions" },
    { key: "sales_reps", label: "Sales Reps", href: "sales_reps.html", desc: "Rep creation and management" },
    { key: "companies", label: "Companies", href: "companies.html", desc: "Company records and brand settings" },
    { key: "jobs", label: "Jobs", href: "jobs.html", desc: "Scheduling and operations" },
    { key: "users", label: "Org Chart", href: "org.html", desc: "Interactive hierarchy and reporting lines" },
    { key: "users", label: "Performance", href: "performance.html", desc: "User performance and productivity metrics" },
    { key: "customers", label: "Customers", href: "#", desc: "Customer tools and accounts" },
    { key: "settings", label: "Settings", href: "#", desc: "Application preferences" }
  ];

  if (role === "super_admin") {
    items.push({
      key: "audit",
      label: "Audit",
      href: "audit.html",
      desc: "Repair and integrity tools"
    });
  }

  return items.filter((item) => item.key === "overview" || canAccess(role, item.key));
}

function closeAllTopbarMenus() {
  document.querySelectorAll(".topbar-menu-btn").forEach((btn) => btn.classList.remove("open"));
  document.querySelectorAll(".topbar-dropdown").forEach((menu) => menu.classList.remove("open"));
}

function wireTopbarMenu() {
  const menuBtn = document.getElementById("topbarMenuBtn");
  const dropdown = document.getElementById("topbarDropdown");

  if (!menuBtn || !dropdown) return;

  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains("open");
    closeAllTopbarMenus();
    if (!isOpen) {
      menuBtn.classList.add("open");
      dropdown.classList.add("open");
    }
  });

  dropdown.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", closeAllTopbarMenus, { once: false });
}

export async function bindTopbar(user = null) {
  const topbar = document.getElementById("topbar");
  if (!topbar) return;

  injectTopbarStyles();

  const settings = await loadBrandSettings();
  const company = user?.companyId ? await loadCompany(user.companyId) : null;
  const homeHref = "index.html";
  const dashboardHref = user ? getDashboardPath(user.role) : "dashboard.html";

  const identityName = user ? user.name || formatDisplayUsername(user) : "Guest";
  const identityHandle = user ? formatHandle(user) : "";
  const identityCompany = company?.name || settings?.companyName || "Supreme TrueClean";
  const menuItems = user ? getGlobalNavItems(user.role) : [];

  topbar.innerHTML = `
    <div class="app-topbar-shell">
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
          <div class="topbar-identity">
            <strong>${identityName}</strong>
            <span>${identityHandle}</span>
          </div>
        `
            : ""
        }
      </div>

      <nav class="app-nav">
        <a href="${homeHref}">Home</a>
        <a href="${dashboardHref}" class="active">Dashboard</a>

        ${
          user
            ? `
          <div class="topbar-menu-wrap">
            <button type="button" class="topbar-menu-btn" id="topbarMenuBtn">
              Menu
              <span class="topbar-menu-caret">⌄</span>
            </button>
            <div class="topbar-dropdown" id="topbarDropdown">
              ${menuItems
                .map(
                  (item) => `
                    <a href="${item.href}">
                      <strong>${item.label}</strong>
                      <span>${item.desc}</span>
                    </a>
                  `
                )
                .join("")}
            </div>
          </div>
        `
            : ""
        }

        <button id="logoutBtn">Logout</button>
      </nav>
    </div>
  `;

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await logout();
    window.location.href = "login.html";
  });

  wireTopbarMenu();
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

export async function createSalesRep(payload, currentUser) {
  const username = String(payload.username || "").trim().toLowerCase();
  if (!username) throw new Error("Username is required.");

  const userDoc = await addDoc(collection(db, "users"), {
    name: payload.fullName || "",
    username,
    handle: `@${username}`,
    displayUsername: username.charAt(0).toUpperCase() + username.slice(1),
    email: payload.email || "",
    phone: payload.phone || "",
    role: "sales_rep",
    approvalStatus: "approved",
    status: payload.status || "active",
    companyId: sanitizeCompanyId(currentUser.companyId || "supreme_trueclean"),
    companyAccessLevel: "subsidiary",
    photoUrl: "",
    reportsTo: currentUser.id || currentUser.uid || currentUser.email || "",
    organizationLevel: 4,
    permissions: ["leads", "convert"],
    preferredContactMethod: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    notes: payload.notes || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLogin: null
  });

  await syncUsernameDirectoryByUserDoc(userDoc.id);
  return userDoc.id;
}

export async function updateSalesRep(userId, payload) {
  const username = String(payload.username || "").trim().toLowerCase();
  if (!username) throw new Error("Username is required.");

  await updateDoc(doc(db, "users", userId), {
    name: payload.fullName || "",
    username,
    handle: `@${username}`,
    displayUsername: username.charAt(0).toUpperCase() + username.slice(1),
    email: payload.email || "",
    phone: payload.phone || "",
    status: payload.status || "active",
    notes: payload.notes || "",
    updatedAt: serverTimestamp()
  });

  await syncUsernameDirectoryByUserDoc(userId);
}

export async function createCompany(payload, currentUser) {
  const companyId = sanitizeCompanyId(payload.companyId || payload.slug || payload.name || "");
  if (!companyId) throw new Error("Company ID is required.");

  await setDoc(
    doc(db, "companies", companyId),
    {
      name: payload.name || "",
      slug: payload.slug || companyIdToSlug(companyId),
      city: payload.city || "",
      state: payload.state || "",
      phone: payload.phone || "",
      email: payload.email || "",
      status: payload.status || "active",
      notes: payload.notes || "",
      ownerCompany: "Evaraos Inc",
      ownerName: payload.ownerName || currentUser.name || "",
      ownerEmail: payload.ownerEmail || currentUser.email || "",
      ownerUserId: currentUser.id || currentUser.uid || "",
      parentCompany: "Evaraos Inc",
      brandColor: payload.brandColor || "#E30613",
      logoUrl: "",
      serviceCategories: [],
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return companyId;
}

export async function updateCompany(companyId, payload) {
  await updateDoc(doc(db, "companies", companyId), {
    name: payload.name || "",
    slug: payload.slug || companyIdToSlug(companyId),
    city: payload.city || "",
    state: payload.state || "",
    phone: payload.phone || "",
    email: payload.email || "",
    status: payload.status || "active",
    notes: payload.notes || "",
    ownerName: payload.ownerName || "",
    ownerEmail: payload.ownerEmail || "",
    brandColor: payload.brandColor || "#E30613",
    updatedAt: serverTimestamp()
  });
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
