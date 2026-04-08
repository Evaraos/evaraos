function closeAllNavDropdowns() {
  document.querySelectorAll("[data-nav-dropdown]").forEach((dropdown) => {
    dropdown.classList.remove("open");
    const toggle = dropdown.querySelector("[data-nav-toggle]");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  });
}

window.closeAllThemeMenus = function () {
  document.querySelectorAll("[data-theme-menu]").forEach((menu) => {
    menu.classList.remove("open");
  });
  document.querySelectorAll("[data-theme-toggle]").forEach((toggle) => {
    toggle.setAttribute("aria-expanded", "false");
  });
};

function bindNavDropdowns() {
  document.querySelectorAll("[data-nav-dropdown]").forEach((dropdown) => {
    const toggle = dropdown.querySelector("[data-nav-toggle]");
    const menu = dropdown.querySelector("[data-nav-menu]");

    if (!toggle || !menu) return;

    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const isOpen = dropdown.classList.contains("open");
      closeAllNavDropdowns();
      if (window.closeAllThemeMenus) window.closeAllThemeMenus();

      if (!isOpen) {
        dropdown.classList.add("open");
        toggle.setAttribute("aria-expanded", "true");
      }
    });

    menu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        dropdown.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  });
}

function highlightCurrentPage() {
  const currentPath = window.location.pathname;

  document.querySelectorAll("[data-nav-link]").forEach((link) => {
    const href = link.getAttribute("href");
    if (!href) return;

    if (currentPath === href || currentPath.endsWith(href)) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  bindNavDropdowns();
  highlightCurrentPage();

  document.addEventListener("click", () => {
    closeAllNavDropdowns();
    if (window.closeAllThemeMenus) window.closeAllThemeMenus();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAllNavDropdowns();
      if (window.closeAllThemeMenus) window.closeAllThemeMenus();
    }
  });
});