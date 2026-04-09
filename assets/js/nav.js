function closeAllNavDropdowns(except = null) {
  document.querySelectorAll("[data-nav-dropdown]").forEach((dropdown) => {
    if (except && dropdown === except) return;
    dropdown.classList.remove("open");

    const toggle = dropdown.querySelector("[data-nav-toggle]");
    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

function toggleNavDropdown(dropdown) {
  if (!dropdown) return;

  const isOpen = dropdown.classList.contains("open");
  const toggle = dropdown.querySelector("[data-nav-toggle]");

  closeAllNavDropdowns(dropdown);

  if (!isOpen) {
    dropdown.classList.add("open");
    if (toggle) toggle.setAttribute("aria-expanded", "true");
  } else {
    dropdown.classList.remove("open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  }
}

function markActiveLinks() {
  const currentPath = window.location.pathname;

  document.querySelectorAll("[data-nav-link]").forEach((link) => {
    const href = link.getAttribute("href") || "";
    const normalizedHref = new URL(href, window.location.origin).pathname;

    const isActive =
      currentPath === normalizedHref ||
      (currentPath.endsWith("/index.html") && normalizedHref.endsWith("/index.html")) ||
      (currentPath.endsWith("/") && normalizedHref.endsWith("/index.html"));

    link.classList.toggle("active", isActive);
  });
}

function bindNavDropdowns() {
  document.querySelectorAll("[data-nav-dropdown]").forEach((dropdown) => {
    if (dropdown.dataset.navBound === "true") return;
    dropdown.dataset.navBound = "true";

    const toggle = dropdown.querySelector("[data-nav-toggle]");
    const menu = dropdown.querySelector("[data-nav-menu]");

    if (!toggle || !menu) return;

    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleNavDropdown(dropdown);
    });

    menu.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    menu.querySelectorAll("a, button").forEach((item) => {
      item.addEventListener("click", () => {
        if (!item.classList.contains("dashboard-menu-button")) {
          closeAllNavDropdowns();
        }
      });
    });
  });
}

function bindGlobalNavClose() {
  if (document.body.dataset.globalNavCloseBound === "true") return;
  document.body.dataset.globalNavCloseBound = "true";

  document.addEventListener("click", () => {
    closeAllNavDropdowns();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllNavDropdowns();

      const sidebar = document.getElementById("dashboardSidebar");
      const sidebarToggle = document.getElementById("dashboardSidebarToggle");

      if (sidebar) sidebar.classList.remove("open");
      if (sidebarToggle) sidebarToggle.setAttribute("aria-expanded", "false");

      if (window.closeAllThemeMenus) {
        window.closeAllThemeMenus();
      }
    }
  });
}

function bindDashboardSidebar() {
  const sidebar = document.getElementById("dashboardSidebar");
  const sidebarToggle = document.getElementById("dashboardSidebarToggle");

  if (!sidebar || !sidebarToggle || sidebar.dataset.sidebarBound === "true") return;
  sidebar.dataset.sidebarBound = "true";

  document.addEventListener("click", (event) => {
    const clickedInsideSidebar = sidebar.contains(event.target);
    const clickedToggle = sidebarToggle.contains(event.target);

    if (!clickedInsideSidebar && !clickedToggle && window.innerWidth <= 980) {
      sidebar.classList.remove("open");
      sidebarToggle.setAttribute("aria-expanded", "false");
    }
  });
}

function bindAuraGroups() {
  document.querySelectorAll(".glass-card, .dashboard-panel, .dashboard-overview, .dashboard-hero").forEach((group) => {
    if (group.dataset.auraBound === "true") return;
    group.dataset.auraBound = "true";

    const focusables = group.querySelectorAll(
      ".btn, .dashboard-nav-link, .dashboard-list-item, .dashboard-role-card, .dashboard-stat-card, .dashboard-portal-card, .dashboard-feed-item, .input-shell, .dashboard-inline-link"
    );

    focusables.forEach((item) => {
      item.addEventListener("pointerdown", () => {
        group.classList.add("active-glow");
        item.classList.add("active-glow");
      });

      item.addEventListener("mouseenter", () => {
        group.classList.add("active-glow");
      });

      item.addEventListener("mouseleave", () => {
        group.classList.remove("active-glow");
        item.classList.remove("active-glow");
      });

      item.addEventListener("focusin", () => {
        group.classList.add("active-glow");
        item.classList.add("active-glow");
      });

      item.addEventListener("focusout", () => {
        setTimeout(() => {
          if (!group.contains(document.activeElement)) {
            group.classList.remove("active-glow");
          }
          item.classList.remove("active-glow");
        }, 40);
      });
    });
  });
}

function initNav() {
  bindNavDropdowns();
  bindGlobalNavClose();
  bindDashboardSidebar();
  bindAuraGroups();
  markActiveLinks();
}

window.closeAllNavDropdowns = closeAllNavDropdowns;
window.initNav = initNav;

document.addEventListener("DOMContentLoaded", initNav);