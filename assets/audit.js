import {
  bindTopbar,
  requireAuth,
  renderSidebar,
  scanSystemDiscrepancies,
  normalizeUserDoc,
  normalizeCompanyDoc,
  normalizeLeadDoc,
  normalizeJobDoc,
  normalizeServiceDoc,
  fetchAllCollection,
  sanitizeCompanyId
} from "./app.js";

import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "./firebase.js";

const CANONICAL_COMPANY_ID = "supreme_trueclean";

function renderSection(title, items, type, repairable = false) {
  if (!items.length) {
    return `
      <div class="audit-card">
        <div style="display:flex;justify-content:space-between;">
          <h2>${title}</h2>
          ${repairable ? `<button class="btn repair-section-btn" data-type="${type}">Repair ${title}</button>` : ``}
        </div>
        <p>No discrepancies found.</p>
      </div>
    `;
  }

  return `
    <div class="audit-card">
      <div style="display:flex;justify-content:space-between;">
        <h2>${title}</h2>
        ${repairable ? `<button class="btn repair-section-btn" data-type="${type}">Repair ${title}</button>` : ``}
      </div>

      ${items.map(item => `
        <div class="audit-row">
          <strong>${item.name || item.id}</strong><br>

          ${item.issues?.map(i => `<span class="badge">${i}</span>`).join("") || ""}

          <div style="margin-top:10px;">
            ${repairable ? `<button class="btn repair-item-btn" data-type="${type}" data-id="${item.id}">Repair</button>` : ""}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderFullRepairCard() {
  return `
    <div class="audit-card">
      <h2>Full System Repair</h2>
      <p>Repairs everything including users, usernames, companies, leads, jobs.</p>

      <button id="repairEverythingBtn" class="btn">Repair All System Data</button>
      <button id="repairUsernameDirectoryBtn" class="btn secondary">Repair Username Directory</button>
      <button id="canonicalizeCompaniesBtn" class="btn secondary">Canonicalize Companies</button>
    </div>
  `;
}

async function repairItem(type, id) {
  if (type === "users") return normalizeUserDoc(id);
  if (type === "companies") return normalizeCompanyDoc(id);
  if (type === "leads") return normalizeLeadDoc(id);
  if (type === "jobs") return normalizeJobDoc(id);
  if (type === "services") return normalizeServiceDoc(id);
}

/* =========================
   🔥 USERNAME DIRECTORY FIX
========================= */

async function repairUsernameDirectory() {
  const users = await fetchAllCollection("users");
  const usernames = await fetchAllCollection("usernames");

  const validUsernames = new Set();

  for (const user of users) {
    if (!user.username) continue;

    const clean = user.username.toLowerCase();
    validUsernames.add(clean);

    await setDoc(doc(db, "usernames", clean), {
      uid: user.id,
      username: clean,
      handle: `@${clean}`,
      companyId: sanitizeCompanyId(user.companyId || ""),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  // delete stale usernames
  for (const entry of usernames) {
    if (!validUsernames.has(entry.id)) {
      await deleteDoc(doc(db, "usernames", entry.id));
    }
  }
}

/* =========================
   🔥 COMPANY CANONICAL FIX
========================= */

async function canonicalizeCompanies() {
  const companies = await fetchAllCollection("companies");

  const canonicalRef = doc(db, "companies", CANONICAL_COMPANY_ID);

  let canonicalData = null;

  // find best existing company
  for (const c of companies) {
    if (
      c.id === CANONICAL_COMPANY_ID ||
      c.slug === "supreme-trueclean" ||
      c.name?.toLowerCase().includes("supreme")
    ) {
      canonicalData = c;
      break;
    }
  }

  if (!canonicalData) {
    // create default
    await setDoc(canonicalRef, {
      name: "Supreme TrueClean",
      slug: "supreme-trueclean",
      ownerName: "Gilbert Ramos",
      ownerEmail: "gilbert37ramos@gmail.com",
      brandColor: "#E30613",
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } else {
    await setDoc(canonicalRef, {
      ...canonicalData,
      id: undefined,
      updatedAt: serverTimestamp(),
      active: true,
      brandColor: canonicalData.brandColor || "#E30613"
    }, { merge: true });
  }

  // delete legacy duplicates
  for (const c of companies) {
    if (c.id !== CANONICAL_COMPANY_ID) {
      await deleteDoc(doc(db, "companies", c.id));
    }
  }
}

/* =========================
   🔥 FULL SYSTEM REPAIR
========================= */

async function repairAll() {
  const data = await scanSystemDiscrepancies();

  for (const u of data.users) await normalizeUserDoc(u.id);
  for (const l of data.leads) await normalizeLeadDoc(l.id);
  for (const j of data.jobs) await normalizeJobDoc(j.id);
  for (const s of data.services) await normalizeServiceDoc(s.id);

  await repairUsernameDirectory();
  await canonicalizeCompanies();
}

/* =========================
   🔥 UI BINDINGS
========================= */

async function wireButtons() {
  document.getElementById("repairEverythingBtn")?.addEventListener("click", async () => {
    await repairAll();
    await loadAudit();
  });

  document.getElementById("repairUsernameDirectoryBtn")?.addEventListener("click", async () => {
    await repairUsernameDirectory();
    await loadAudit();
  });

  document.getElementById("canonicalizeCompaniesBtn")?.addEventListener("click", async () => {
    await canonicalizeCompanies();
    await loadAudit();
  });

  document.querySelectorAll(".repair-item-btn").forEach(btn => {
    btn.onclick = async () => {
      await repairItem(btn.dataset.type, btn.dataset.id);
      await loadAudit();
    };
  });
}

/* =========================
   🔥 LOAD AUDIT
========================= */

async function loadAudit() {
  const root = document.getElementById("auditRoot");

  root.innerHTML = renderFullRepairCard() + `<div>Loading...</div>`;

  const data = await scanSystemDiscrepancies();

  root.innerHTML = [
    renderFullRepairCard(),
    renderSection("Users", data.users, "users", true),
    renderSection("Username Directory", data.usernames, "usernames", false),
    renderSection("Companies", data.companies, "companies", true),
    renderSection("Leads", data.leads, "leads", true),
    renderSection("Jobs", data.jobs, "jobs", true),
    renderSection("Services", data.services, "services", true)
  ].join("");

  await wireButtons();
}

/* =========================
   🔥 INIT
========================= */

requireAuth(async (user) => {
  if (user.role !== "super_admin") {
    document.body.innerHTML = "Access denied";
    return;
  }

  await bindTopbar(user);
  document.getElementById("sidebar").innerHTML = renderSidebar(user.role, "audit");

  document.getElementById("runAuditBtn")?.addEventListener("click", loadAudit);

  await loadAudit();
});