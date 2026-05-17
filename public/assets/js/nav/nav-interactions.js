const ROW_SELECTOR = [
  ".eva-menu-folder-shell",
  ".eva-menu-top-block",
  ".eva-menu-app-launcher",
  ".eva-quick-strip a",
  ".eva-account-strip a"
].join(",");

function activate(node) {
  if (!node) return;
  node.classList.add("is-hovered");
}

function deactivate(node) {
  if (!node) return;
  node.classList.remove("is-hovered");
  node.classList.remove("is-pressed");
}

export function bindNavInteractions() {
  const panel = document.getElementById("evaMenuPanel");
  if (!panel || panel.dataset.interactionsBound === "true") return;

  panel.dataset.interactionsBound = "true";

  panel.addEventListener("pointerover", (event) => {
    const target = event.target.closest(ROW_SELECTOR);
    if (!target || !panel.contains(target)) return;
    activate(target);
  }, { passive: true });

  panel.addEventListener("pointerout", (event) => {
    const target = event.target.closest(ROW_SELECTOR);
    deactivate(target);
  }, { passive: true });

  panel.addEventListener("pointerdown", (event) => {
    const target = event.target.closest(ROW_SELECTOR);
    if (!target) return;
    target.classList.add("is-pressed");
  }, { passive: true });

  panel.addEventListener("pointerup", (event) => {
    const target = event.target.closest(ROW_SELECTOR);
    if (!target) return;

    window.setTimeout(() => {
      target.classList.remove("is-pressed");
    }, 120);
  }, { passive: true });

  panel.addEventListener("pointercancel", (event) => {
    const target = event.target.closest(ROW_SELECTOR);
    deactivate(target);
  }, { passive: true });
}