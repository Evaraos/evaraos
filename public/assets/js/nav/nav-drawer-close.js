import { closeMenu } from "./nav-menu.js";

let escapeBound = false;

function bindCloseButton() {
  const button = document.getElementById("evaMenuCloseBtn");
  if (!button || button.dataset.drawerCloseBound === "true") return false;
  button.dataset.drawerCloseBound = "true";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeMenu(true);
  });
  return true;
}

function start() {
  bindCloseButton();
  if (!escapeBound) {
    escapeBound = true;
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && document.body.classList.contains("nav-menu-open")) closeMenu(true);
    });
  }
  const observer = new MutationObserver(() => {
    if (bindCloseButton()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 12000);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
