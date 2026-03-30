import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

function closeHomeMenu() {
  const menuBtn = document.getElementById("homeMenuBtn");
  const dropdown = document.getElementById("homeMenuDropdown");

  if (menuBtn) menuBtn.classList.remove("open");
  if (dropdown) dropdown.classList.remove("open");
}

function openHomeMenu() {
  const menuBtn = document.getElementById("homeMenuBtn");
  const dropdown = document.getElementById("homeMenuDropdown");

  if (menuBtn) menuBtn.classList.add("open");
  if (dropdown) dropdown.classList.add("open");
}

function wireHomeMenu() {
  const menuBtn = document.getElementById("homeMenuBtn");
  const dropdown = document.getElementById("homeMenuDropdown");

  if (!menuBtn || !dropdown) return;

  menuBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = dropdown.classList.contains("open");

    if (isOpen) {
      closeHomeMenu();
    } else {
      openHomeMenu();
    }
  });

  dropdown.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener("click", () => {
    closeHomeMenu();
  });

  window.addEventListener("resize", () => {
    closeHomeMenu();
  });
}

function setLoggedOutState() {
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
    heroEnterLink.textContent = "Enter Platform";
  }

  if (heroSecondaryLink) {
    heroSecondaryLink.href = "/evaraos/companies.html";
    heroSecondaryLink.textContent = "Get Started";
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

function setLoggedInState(role) {
  const loginNavLink = document.getElementById("loginNavLink");
  const dashboardNavLink = document.getElementById("dashboardNavLink");
  const logoutHomeBtn = document.getElementById("logoutHomeBtn");
  const heroEnterLink = document.getElementById("heroEnterLink");
  const heroSecondaryLink = document.getElementById("heroSecondaryLink");
  const homeMenuWrap = document.getElementById("homeMenuWrap");
  const homeMenuDashboardLink = document.getElementById("homeMenuDashboardLink");
  const homeMenuCompaniesLink = document.getElementById("homeMenuCompaniesLink");
  const homeMenuLogoutBtn = document.getElementById("homeMenuLogoutBtn");

  const path = dashboardPath(role || "customer");

  setDisplay(loginNavLink, "none");
  setDisplay(dashboardNavLink, "");
  setDisplay(logoutHomeBtn, "");
  setDisplay(homeMenuWrap, "");

  if (dashboardNavLink) {
    dashboardNavLink.href = path;
  }

  if (heroEnterLink) {
    heroEnterLink.href = path;
    heroEnterLink.textContent = "Go to Dashboard";
  }

  if (heroSecondaryLink) {
    heroSecondaryLink.href = path;
    heroSecondaryLink.textContent = "Stay in Session";
  }

  if (homeMenuDashboardLink) {
    homeMenuDashboardLink.href = path;
  }

  if (homeMenuCompaniesLink) {
    homeMenuCompaniesLink.href = "/evaraos/companies.html";
  }

  if (logoutHomeBtn) {
    logoutHomeBtn.onclick = async () => {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("Logout failed:", error);
      } finally {
        window.location.href = "/evaraos/index.html";
      }
    };
  }

  if (homeMenuLogoutBtn) {
    homeMenuLogoutBtn.onclick = async () => {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("Logout failed:", error);
      } finally {
        window.location.href = "/evaraos/index.html";
      }
    };
  }
}

window.addEventListener("DOMContentLoaded", () => {
  wireHomeMenu();

  onAuthStateChanged(auth, async (user) => {
    closeHomeMenu();

    if (!user) {
      setLoggedOutState();
      return;
    }

    const userDoc = await getCurrentUserDoc(user);
    const role = userDoc?.role || "customer";
    setLoggedInState(role);
  });
});