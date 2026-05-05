import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function dashboardPath(role) {
  return role === "customer"
    ? "/customer_dashboard.html"
    : "/dashboard.html";
}

async function getCurrentUserDoc(user) {
  if (!user?.uid) return null;

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (error) {
    console.error("Failed to load current user doc:", error);
    return null;
  }
}

function qs(id) {
  return document.getElementById(id);
}

function setDisplay(el, value) {
  if (!el) return;
  el.style.display = value;
}

function setHidden(el, hidden) {
  if (!el) return;
  el.classList.toggle("hidden", hidden);
}

function closeHomeMenu() {
  const menuBtn = qs("homeMenuBtn");
  const dropdown = qs("homeMenuDropdown");

  if (menuBtn) {
    menuBtn.setAttribute("aria-expanded", "false");
  }

  if (dropdown) {
    dropdown.classList.remove("open");
  }
}

function openHomeMenu() {
  const menuBtn = qs("homeMenuBtn");
  const dropdown = qs("homeMenuDropdown");

  if (menuBtn) {
    menuBtn.setAttribute("aria-expanded", "true");
  }

  if (dropdown) {
    dropdown.classList.add("open");
  }
}

function bindHomeMenu() {
  const menuBtn = qs("homeMenuBtn");
  const dropdown = qs("homeMenuDropdown");

  if (!menuBtn || !dropdown) return;

  menuBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const expanded = menuBtn.getAttribute("aria-expanded") === "true";

    if (expanded) {
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

function bindLogoutButtons() {
  const logoutHomeBtn = qs("logoutHomeBtn");
  const homeMenuLogoutBtn = qs("homeMenuLogoutBtn");

  const logoutHandler = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      window.location.href = "/index.html";
    }
  };

  if (logoutHomeBtn) {
    logoutHomeBtn.onclick = logoutHandler;
  }

  if (homeMenuLogoutBtn) {
    homeMenuLogoutBtn.onclick = logoutHandler;
  }
}

function applyGuestState() {
  const loginNavLink = qs("loginNavLink");
  const dashboardNavLink = qs("dashboardNavLink");
  const logoutHomeBtn = qs("logoutHomeBtn");
  const heroEnterLink = qs("heroEnterLink");
  const heroSecondaryLink = qs("heroSecondaryLink");

  const homeMenuLoginLink = qs("homeMenuLoginLink");
  const homeMenuDashboardLink = qs("homeMenuDashboardLink");
  const homeMenuLogoutBtn = qs("homeMenuLogoutBtn");

  setDisplay(loginNavLink, "");
  setDisplay(dashboardNavLink, "none");
  setDisplay(logoutHomeBtn, "none");

  setHidden(homeMenuLoginLink, false);
  setHidden(homeMenuDashboardLink, true);
  setHidden(homeMenuLogoutBtn, true);

  if (heroEnterLink) {
    heroEnterLink.href = "/login.html";
    heroEnterLink.textContent = "Enter Platform";
  }

  if (heroSecondaryLink) {
    heroSecondaryLink.href = "/signup.html";
    heroSecondaryLink.textContent = "Get Started";
  }
}

function applyAuthedState(userDoc) {
  const loginNavLink = qs("loginNavLink");
  const dashboardNavLink = qs("dashboardNavLink");
  const logoutHomeBtn = qs("logoutHomeBtn");
  const heroEnterLink = qs("heroEnterLink");
  const heroSecondaryLink = qs("heroSecondaryLink");

  const homeMenuLoginLink = qs("homeMenuLoginLink");
  const homeMenuDashboardLink = qs("homeMenuDashboardLink");
  const homeMenuLogoutBtn = qs("homeMenuLogoutBtn");

  const path = dashboardPath(userDoc?.role || "customer");

  setDisplay(loginNavLink, "none");
  setDisplay(dashboardNavLink, "");
  setDisplay(logoutHomeBtn, "");

  if (dashboardNavLink) {
    dashboardNavLink.href = path;
  }

  setHidden(homeMenuLoginLink, true);
  setHidden(homeMenuDashboardLink, false);
  setHidden(homeMenuLogoutBtn, false);

  if (homeMenuDashboardLink) {
    homeMenuDashboardLink.href = path;
  }

  if (heroEnterLink) {
    heroEnterLink.href = path;
    heroEnterLink.textContent = "Go to Dashboard";
  }

  if (heroSecondaryLink) {
    heroSecondaryLink.href = path;
    heroSecondaryLink.textContent = "Stay in Session";
  }
}

function enhanceHeroVisual() {
  const heroTitle = document.querySelector(".hero-copy h1");
  const heroSubtitle = document.querySelector(".hero-card-subtitle");

  if (heroTitle) {
    heroTitle.style.textWrap = "balance";
  }

  if (heroSubtitle) {
    heroSubtitle.style.textWrap = "pretty";
  }
}

function bindFeatureHover() {
  document.querySelectorAll(".feature-card").forEach((card) => {
    card.addEventListener("mouseenter", () => {
      card.style.transform = "translateY(-2px)";
    });

    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  });
}

function initHomePage() {
  bindHomeMenu();
  bindLogoutButtons();
  enhanceHeroVisual();
  bindFeatureHover();

  onAuthStateChanged(auth, async (user) => {
    closeHomeMenu();

    if (!user) {
      applyGuestState();
      return;
    }

    const userDoc = await getCurrentUserDoc(user);
    applyAuthedState(userDoc || { role: "customer" });
  });
}

window.addEventListener("DOMContentLoaded", initHomePage);
