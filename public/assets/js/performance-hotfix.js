(function () {
  var hideTimerA = null;
  var hideTimerB = null;

  function qs(id) {
    return document.getElementById(id);
  }

  function unblockElement(el) {
    if (!el) return;
    el.style.pointerEvents = "none";
    el.setAttribute("aria-hidden", "true");
    el.classList.remove("active", "is-entering", "is-exiting");
  }

  function unlockApp() {
    document.documentElement.classList.remove("boot-pending", "auth-pending", "eva-transitioning");
    if (document.body) {
      document.body.classList.remove("app-loading", "auth-pending");
      document.body.classList.add("app-ready");
    }

    unblockElement(qs("evaraFastLoader"));
    unblockElement(qs("evaraGlobalLoader"));
    unblockElement(qs("evaPageTransition"));
  }

  function speedUpBoot() {
    clearTimeout(hideTimerA);
    clearTimeout(hideTimerB);
    hideTimerA = setTimeout(unlockApp, 450);
    hideTimerB = setTimeout(unlockApp, 1200);
  }

  function ensureMenuButtonIsClickable() {
    var btn = qs("evaMenuBtn");
    var shell = qs("evaNavShell");
    var layer = document.querySelector(".eva-nav-layer");

    if (btn) {
      btn.style.pointerEvents = "auto";
      btn.style.touchAction = "manipulation";
      btn.style.webkitTapHighlightColor = "transparent";
    }

    if (shell) {
      shell.style.pointerEvents = "auto";
      shell.style.zIndex = "9999";
    }

    if (layer) {
      layer.style.pointerEvents = "none";
      layer.style.zIndex = "9999";
    }

    var pill = qs("evaNavPill");
    var panel = qs("evaMenuPanel");
    var backdrop = qs("evaBackdrop");
    if (pill) pill.style.pointerEvents = "auto";
    if (panel) panel.style.pointerEvents = "auto";
    if (backdrop) backdrop.style.pointerEvents = "auto";
  }

  function boot() {
    unlockApp();
    speedUpBoot();
    ensureMenuButtonIsClickable();

    setTimeout(ensureMenuButtonIsClickable, 250);
    setTimeout(ensureMenuButtonIsClickable, 900);

    window.addEventListener("load", unlockApp, { once: true });
    window.addEventListener("pageshow", function () {
      unlockApp();
      ensureMenuButtonIsClickable();
    });
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") {
        unlockApp();
        ensureMenuButtonIsClickable();
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
