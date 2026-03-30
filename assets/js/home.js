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

function closeHomeMenu() {
  const menuBtn = document.getElementById("homeMenuBtn");
  const dropdown = document.getElementById("homeMenuDropdown");

  menuBtn?.classList.remove("open");
  dropdown?.classList.remove("open");
}

function openHomeMenu() {
  const menuBtn = document.getElementById("homeMenuBtn");
  const dropdown = document.getElementById("homeMenuDropdown");

  menuBtn?.classList.add("open");
  dropdown?.classList.add("open");
}

function wireHomeMenu() {
  const menuBtn = document.getElementById("homeMenuBtn");
  const dropdown = document.getElementById("homeMenuDropdown");

  if (!menuBtn || !dropdown) return;

  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains("open");
    if (isOpen) {
      closeHomeMenu();
    } else {
      openHomeMenu();
    }
  });

  dropdown.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  document.addEventListener("click", () => {
    closeHomeMenu();
  });
}

async function bootHome() {
  const loginNavLink = document.getElementById("loginNavLink");
  const dashboardNavLink = document.getElementById("dashboardNavLink");
  const logoutHomeBtn = document.getElementById("logoutHomeBtn");
  const heroEnterLink = document.getElementById("heroEnterLink");
  const heroSecondaryLink = document.getElementById("heroSecondaryLink");

  const homeMenuWrap = document.getElementById("homeMenuWrap");
  const homeMenuDashboardLink = document.getElementById("homeMenuDashboardLink");
  const homeMenuCompaniesLink = document.getElementById("homeMenuCompaniesLink");
  const homeMenuLogoutBtn = document.getElementById("homeMenuLogoutBtn");

  wireHomeMenu();

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      setDisplay(loginNavLink, "");
      setDisplay(dashboardNavLink, "none");
      setDisplay(logoutHomeBtn, "none");

      if (heroEnterLink) {
        heroEnterLink.href = "/evaraos/login.html";
        heroEnterLink.textContent = "Enter Platform";
      }

      if (heroSecondaryLink) {
        heroSecondaryLink.href = "/evaraos/companies.html";
        heroSecondaryLink.textContent = "Get Started";
      }

      if (homeMenuWrap) {
        homeMenuWrap.classList.remove("hidden");
      }

      if (homeMenuDashboardLink) {
        homeMenuDashboardLink.href = "/evaraos/login.html";
        homeMenuDashboardLink.innerHTML = `
          <strong>Login</strong>
          <span>Sign in to enter the platform</span>
        `;
      }

      if (homeMenuCompaniesLink) {
        homeMenuCompaniesLink.href = "/evaraos/companies.html";
        homeMenuCompaniesLink.innerHTML = `
          <strong>Companies</strong>
          <span>Open companies and platform setup</span>
        `;
      }

      if (homeMenuLogoutBtn) {
        homeMenuLogoutBtn.classList.add("hidden");
      }

      return;
    }

    const userDoc = await getCurrentUserDoc(user);
    const path = dashboardPath(userDoc?.role || "customer");

    setDisplay(loginNavLink, "none");
    setDisplay(dashboardNavLink, "");
    setDisplay(logoutHomeBtn, "");

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

    if (logoutHomeBtn) {
      logoutHomeBtn.onclick = async () => {
        await signOut(auth);
        window.location.href = "/evaraos/index.html";
      };
    }

    if (homeMenuWrap) {
      homeMenuWrap.classList.remove("hidden");
    }

    if (homeMenuDashboardLink) {
      homeMenuDashboardLink.href = path;
      homeMenuDashboardLink.innerHTML = `
        <strong>Dashboard</strong>
        <span>Go to your account dashboard</span>
      `;
    }

    if (homeMenuCompaniesLink) {
      homeMenuCompaniesLink.href = "/evaraos/companies.html";
      homeMenuCompaniesLink.innerHTML = `
        <strong>Companies</strong>
        <span>Open companies and platform setup</span>
      `;
    }

    if (homeMenuLogoutBtn) {
      homeMenuLogoutBtn.classList.remove("hidden");
      homeMenuLogoutBtn.innerHTML = `
        <strong>Logout</strong>
        <span>End your current session</span>
      `;
      homeMenuLogoutBtn.onclick = async () => {
        await signOut(auth);
        window.location.href = "/evaraos/index.html";
      };
    }
  });
}

window.addEventListener("DOMContentLoaded", bootHome);