import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db, COMPANY_ID } from "./firebase.js";
import { listenAuth, logout } from "./auth.js";

export async function loadBrandSettings() {
  try {
    const snap = await getDoc(doc(db, "settings", "app"));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

export async function bindTopbar() {
  const topbar = document.getElementById("topbar");
  if (!topbar) return;

  const settings = await loadBrandSettings();

  topbar.innerHTML = `
    <div class="app-topbar-inner">
      <div class="app-brand">
        <img src="${settings?.logoUrl || "./assets/img/logo.png"}" alt="logo">
        <div>
          <div>${settings?.platformName || "Evaraos Inc"}</div>
          <div class="muted">${settings?.companyName || "Supreme TrueClean"}</div>
        </div>
      </div>
      <button class="btn secondary" id="logoutBtn">Logout</button>
    </div>
  `;

  document.getElementById("logoutBtn").onclick = async () => {
    await logout();
    window.location.href = "login.html";
  };
}

export function requireAuth(renderFn) {
  listenAuth((user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
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

export async function fetchCompanyCollection(name) {
  const q = query(collection(db, name), where("companyId", "==", COMPANY_ID));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
