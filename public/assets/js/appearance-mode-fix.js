// Compatibility shim only. The appearance page is owned by settings-appearance-v2.js
// and the universal API in theme.js. Do not intercept mode button clicks here.
function syncAppearanceCompatibility() {
  const appearance = window.EvaraTheme?.getAppearance?.() || { mode: "light" };
  document.querySelectorAll("[data-appearance-mode]").forEach(button => {
    const active = button.dataset.appearanceMode === appearance.mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  const label = document.getElementById("appearanceModeLabel");
  if (label) label.textContent = appearance.mode.charAt(0).toUpperCase() + appearance.mode.slice(1);

  const panel = document.getElementById("appearanceImagePanel");
  if (panel) panel.hidden = appearance.mode !== "image";
}

function initAppearanceCompatibility() {
  document.querySelectorAll(".settings-block").forEach(section => {
    if (section.querySelector(".settings-preview")) section.querySelector(".settings-preview")?.remove();
  });
  window.addEventListener("evara:appearance-updated", syncAppearanceCompatibility);
  window.addEventListener("evara:theme-applied", syncAppearanceCompatibility);
  syncAppearanceCompatibility();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAppearanceCompatibility, { once: true });
} else {
  initAppearanceCompatibility();
}
