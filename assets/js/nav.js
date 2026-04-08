function closeAllDropdowns() {
  document.querySelectorAll("[data-nav-dropdown]").forEach((dropdown) => {
    dropdown.classList.remove("open");
  });
}

function bindDropdowns() {
  document.querySelectorAll("[data-nav-dropdown]").forEach((dropdown) => {
    const toggle = dropdown.querySelector("[data-nav-toggle]");
    const menu = dropdown.querySelector("[data-nav-menu]");

    if (!toggle || !menu) return;

    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const isOpen = dropdown.classList.contains("open");
      closeAllDropdowns();

      if (!isOpen) {
        dropdown.classList.add("open");
      }
    });

    menu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        dropdown.classList.remove("open");
      });
    });
  });

  document.addEventListener("click", () => {
    closeAllDropdowns();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAllDropdowns();
    }
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
  bindDropdowns();
  highlightCurrentPage();
});
