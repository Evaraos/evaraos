import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function dashboardPath(role) {
  return role === "customer"
    ? "/evaraos/customer_dashboard.html"
    : "/evaraos/dashboard.html";
}

async function getCurrentUserDoc(user) {
  if (!user?.uid) return null;

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    console.error("Failed to load current user doc:", error);
    return null;
  }
}

function setDisplay(el, value) {
  if (!el) return;
  el.style.display = value;
}

function setText(el, value) {
  if (!el) return;
  el.textContent = value;
}

function closeHomeMenu() {
  const btn = document.getElementById("homeMenuBtn");
  const dropdown = document.getElementById("homeMenuDropdown");

  btn?.classList.remove("open");
  dropdown?.classList.remove("open");
}

function wireHomeMenu() {
  const menuWrap = document.getElementById("homeMenuWrap");
  const menuBtn = document.getElementById("homeMenuBtn");
  const dropdown = document.getElementById("homeMenuDropdown");

  if (!menuWrap || !menuBtn || !dropdown) return;

  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains("open");

    closeHomeMenu();

    if (!isOpen) {
      menuBtn.classList.add("open");
      dropdown.classList.add("open");
    }
  });

  dropdown.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  document.addEventListener("click", closeHomeMenu);
}

function syncPublicNavForGuest() {
  const loginNavLink = document.getElementById("loginNavLink");
  const dashboardNavLink = document.getElementById("dashboardNavLink");
  const logoutHomeBtn = document.getElementById("logoutHomeBtn");
  const heroEnterLink = document.getElementById("heroEnterLink");
  const heroSecondaryLink = document.getElementById("heroSecondaryLink");
  const homeMenuWrap = document.getElementById("homeMenuWrap");
  const homeMenuDashboardLink = document.getElementById("homeMenuDashboardLink");
  const homeMenuCompaniesLink = document.getElementById("homeMenuCompaniesLink");
  const homeMenuLogoutBtn = document.getElementById("homeMenuLogoutBtn");

  setDisplay(loginNavLink, "");
  setDisplay(dashboardNavLink, "none");
  setDisplay(logoutHomeBtn, "none");
  setDisplay(homeMenuWrap, "none");

  if (heroEnterLink) {
    heroEnterLink.href = "/evaraos/login.html";
    setText(heroEnterLink, "Enter Platform");
  }

  if (heroSecondaryLink) {
    heroSecondaryLink.href = "/evaraos/companies.html";
    setText(heroSecondaryLink, "Get Started");
  }

  if (homeMenuDashboardLink) {
    homeMenuDashboardLink.href = "/evaraos/login.html";
  }

  if (homeMenuCompaniesLink) {
    homeMenuCompaniesLink.href = "/evaraos/companies.html";
  }

  if (homeMenuLogoutBtn) {
    homeMenuLogoutBtn.onclick = null;
  }
}

function syncPublicNavForUser(path) {
  const loginNavLink = document.getElementById("loginNavLink");
  const dashboardNavLink = document.getElementById("dashboardNavLink");
  const logoutHomeBtn = document.getElementById("logoutHomeBtn");
  const heroEnterLink = document.getElementById("heroEnterLink");
  const heroSecondaryLink = document.getElementById("heroSecondaryLink");
  const homeMenuWrap = document.getElementById("homeMenuWrap");
  const homeMenuDashboardLink = document.getElementById("homeMenuDashboardLink");
  const homeMenuCompaniesLink = document.getElementById("homeMenuCompaniesLink");
  const homeMenuLogoutBtn = document.getElementById("homeMenuLogoutBtn");

  setDisplay(loginNavLink, "none");
  setDisplay(dashboardNavLink, "");
  setDisplay(logoutHomeBtn, "none");
  setDisplay(homeMenuWrap, "");

  if (dashboardNavLink) {
    dashboardNavLink.href = path;
  }

  if (heroEnterLink) {
    heroEnterLink.href = path;
    setText(heroEnterLink, "Go to Dashboard");
  }

  if (heroSecondaryLink) {
    heroSecondaryLink.href = path;
    setText(heroSecondaryLink, "Stay in Session");
  }

  if (homeMenuDashboardLink) {
    homeMenuDashboardLink.href = path;
  }

  if (homeMenuCompaniesLink) {
    homeMenuCompaniesLink.href = "/evaraos/companies.html";
  }

  const logoutHandler = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Home logout failed:", error);
    }
    window.location.href = "/evaraos/index.html";
  };

  if (logoutHomeBtn) {
    logoutHomeBtn.onclick = logoutHandler;
  }

  if (homeMenuLogoutBtn) {
    homeMenuLogoutBtn.onclick = logoutHandler;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  wireHomeMenu();

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      syncPublicNavForGuest();
      return;
    }

    const userDoc = await getCurrentUserDoc(user);
    const path = dashboardPath(userDoc?.role || "customer");
    syncPublicNavForUser(path);
  });
});