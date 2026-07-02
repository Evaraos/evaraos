(() => {
  if (window.__evaraAdaptiveBootV4Requested) return;
  window.__evaraAdaptiveBootV4Requested = true;
  document.documentElement.classList.add("boot-pending", "evara-boot-lock");
  document.documentElement.dataset.theme = "adaptive";
  import("/assets/js/adaptive-appearance-boot-v4.js?v=4");
})();
