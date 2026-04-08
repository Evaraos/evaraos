function setExpanded(element, isExpanded) {
  if (!element) return;
  element.setAttribute("aria-expanded", isExpanded ? "true" : "false");
}

function closeAllNavDropdowns() {
  document.querySelectorAll("[data-nav-dropdown]").forEach((dropdown) => {
    dropdown.classList.remove("open");
    setExpanded(dropdown.querySelector("[data-nav-toggle]"), false);
  });
}

function openDropdown(dropdown) {
  if (!dropdown) return;
  dropdown.classList.add("open");
  setExpanded(dropdown.querySelector("[data-nav-toggle]"), true);
}

function bindSingleDropdown(dropdown) {
  if (!dropdown || dropdown.dataset.navBound === "true") return;

  const toggle = dropdown.querySelector("[data-nav-toggle]");
  const menu = dropdown.querySelector("[data-nav-menu]");

  if (!toggle || !menu) return;

  dropdown.dataset.navBound = "true";

  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const wasOpen = dropdown.classList.contains("open");

    closeAllNavDropdowns();
    if (window.closeAllThemeMenus) {
      window.closeAllThemeMenus();
    }

    if (!wasOpen) {
      openDropdown(dropdown);
    }
  });

  menu.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      dropdown.classList.remove("open");
      setExpanded(toggle, false);
    });
  });
}

function bindNavDropdowns(root = document) {
  root.querySelectorAll("[data-nav-dropdown]").forEach(bindSingleDropdown);
}

function normalizePath(path) {
  if (!path) return "/";
  return path.replace(/\/+$/, "") || "/";
}

function highlightCurrentPage() {
  const currentPath = normalizePath(window.location.pathname);

  document.querySelectorAll("[data-nav-link]").forEach((link) => {
    const href = link.getAttribute("href");
    if (!href) return;

    let targetPath = href;

    try {
      targetPath = new URL(href, window.location.origin).pathname;
    } catch {
      targetPath = href;
    }

    const isMatch = normalizePath(targetPath) === currentPath;
    link.classList.toggle("active", isMatch);
  });
}

function initNav() {
  bindNavDropdowns();
  highlightCurrentPage();
}

window.closeAllNavDropdowns = closeAllNavDropdowns;
window.initNav = initNav;

window.addEventListener("DOMContentLoaded", () => {
  initNav();

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
});