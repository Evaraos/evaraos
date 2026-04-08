function closeAllNavDropdowns() {
  document.querySelectorAll("[data-nav-dropdown]").forEach((dropdown) => {
    dropdown.classList.remove("open");
    const toggle = dropdown.querySelector("[data-nav-toggle]");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  });
}

function bindNavDropdowns() {
  document.querySelectorAll("[data-nav-dropdown]").forEach((dropdown) => {
    const toggle = dropdown.querySelector("[data-nav-toggle]");
    const menu = dropdown.querySelector("[data-nav-menu]");

    if (!toggle || !menu) return;

    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const wasOpen = dropdown.classList.contains("open");
      closeAllNavDropdowns();

      if (!wasOpen) {
        dropdown.classList.add("open");
        toggle.setAttribute("aria-expanded", "true");
      }
    });

    menu.addEventListener("click", (event) => {
      event.stopPropagation();
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

    const isMatch = currentPath === href || currentPath.endsWith(href);
    link.classList.toggle("active", isMatch);
  });
}

window.addEventListener("DOMContentLoaded", () => {
  bindNavDropdowns();
  highlightCurrentPage();

  document.addEventListener("click", () => {
    closeAllNavDropdowns();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllNavDropdowns();
    }
  });
});