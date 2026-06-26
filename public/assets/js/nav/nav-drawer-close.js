import { closeMenu } from "./nav-menu.js";

function bindDrawerClose() {
  const closeButton = document.getElementById("evaMenuCloseBtn");
  if (closeButton && closeButton.dataset.bound !== "true") {
    closeButton.dataset.bound = "true";
    closeButton.addEventListener("click", () => closeMenu(true));
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("nav-menu-open")) closeMenu(true);
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindDrawerClose, { once: true });
else bindDrawerClose();
