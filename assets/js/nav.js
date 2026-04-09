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
      (currentPath.endsWith("/index.html") && normalizedHref.endsWith("/index.html"));

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

    menu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        closeAllNavDropdowns();
      });
    });
  });
}

function bindGlobalNavClose() {
  document.addEventListener("click", () => {
    closeAllNavDropdowns();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllNavDropdowns();
      if (window.closeAllThemeMenus) {
        window.closeAllThemeMenus();
      }
    }
  });
}

function initNav() {
  bindNavDropdowns();
  bindGlobalNavClose();
  markActiveLinks();
}

window.closeAllNavDropdowns = closeAllNavDropdowns;
window.initNav = initNav;

document.addEventListener("DOMContentLoaded", initNav);