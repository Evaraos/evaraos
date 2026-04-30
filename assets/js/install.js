(function () {
  let deferredPrompt = null;
  let pill = null;
  let appleBtn = null;
  let androidBtn = null;

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent || "");
  }

  function isAndroid() {
    return /android/i.test(navigator.userAgent || "");
  }

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function notify(title, message, tone) {
    window.dispatchEvent(new CustomEvent("evara:notify", { detail: { title, message, tone: tone || "info" } }));
  }

  function applyAndroidInstallLook() {
    if (!androidBtn) return;

    const title = androidBtn.querySelector(".eva-install-copy strong");
    const sub = androidBtn.querySelector(".eva-install-copy small");
    const mark = androidBtn.querySelector(".eva-install-android-mark");

    androidBtn.classList.add("eva-install-android-pro");
    androidBtn.setAttribute("aria-label", "Install Evaraos on Android");

    if (title) title.textContent = "Android";
    if (sub) sub.textContent = "Install";

    if (mark) {
      mark.innerHTML = '<svg viewBox="0 0 48 48" focusable="false" aria-hidden="true"><path fill="currentColor" d="M14.8 18.2h18.4c1.9 0 3.4 1.5 3.4 3.4v10.8c0 1.9-1.5 3.4-3.4 3.4H14.8c-1.9 0-3.4-1.5-3.4-3.4V21.6c0-1.9 1.5-3.4 3.4-3.4Z"/><path fill="currentColor" d="M9 21.7c1 0 1.8.8 1.8 1.8v8.3c0 1-.8 1.8-1.8 1.8s-1.8-.8-1.8-1.8v-8.3c0-1 .8-1.8 1.8-1.8Zm30 0c1 0 1.8.8 1.8 1.8v8.3c0 1-.8 1.8-1.8 1.8s-1.8-.8-1.8-1.8v-8.3c0-1 .8-1.8 1.8-1.8ZM17 35.3c1 0 1.8.8 1.8 1.8v4.2c0 1-.8 1.8-1.8 1.8s-1.8-.8-1.8-1.8v-4.2c0-1 .8-1.8 1.8-1.8Zm14 0c1 0 1.8.8 1.8 1.8v4.2c0 1-.8 1.8-1.8 1.8s-1.8-.8-1.8-1.8v-4.2c0-1 .8-1.8 1.8-1.8Z"/><path fill="currentColor" d="M14.1 16.5c.9-4.1 4.9-7.2 9.9-7.2s9 3.1 9.9 7.2H14.1Z"/><path stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M18 9.8 15.7 5.7M30 9.8l2.3-4.1"/><circle cx="19.2" cy="13.7" r="1.15" fill="#fff"/><circle cx="28.8" cy="13.7" r="1.15" fill="#fff"/></svg>';
    }
  }

  function findTargets() {
    pill = document.getElementById("evaInstallPill");
    appleBtn = document.getElementById("evaInstallApple");
    androidBtn = document.getElementById("evaInstallAndroid");
    applyAndroidInstallLook();
    return !!pill;
  }

  function showPill() {
    if (!pill || isStandalone()) return hidePill();
    pill.hidden = false;
    pill.style.display = "grid";
    pill.dataset.platform = isIOS() ? "ios" : isAndroid() ? "android" : "desktop";
    pill.dataset.installReady = deferredPrompt ? "true" : "false";
  }

  function hidePill() {
    if (!pill) return;
    pill.hidden = true;
    pill.style.display = "none";
  }

  function closeMenu() {
    document.body.classList.remove("nav-menu-open");
    const zone = document.getElementById("evaMenuZone");
    const button = document.getElementById("evaMenuBtn");
    zone && zone.classList.remove("open");
    button && button.setAttribute("aria-expanded", "false");
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    document.body.style.overflow = "";
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register("/evaraos/sw.js", { scope: "/evaraos/" });
      if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
    } catch (error) {
      console.warn("Evaraos service worker registration skipped:", error);
    }
  }

  async function runPrompt() {
    if (!deferredPrompt) return false;
    try {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } catch (error) {
      console.warn("Evaraos install prompt skipped:", error);
    }
    deferredPrompt = null;
    showPill();
    return true;
  }

  function bindClicks() {
    if (!pill || pill.dataset.installBound === "true") return;
    pill.dataset.installBound = "true";

    appleBtn && appleBtn.addEventListener("click", function (event) {
      event.preventDefault();
      closeMenu();
      notify("iPhone App Coming Soon", "Evaraos will use a proper Apple App Store or TestFlight install when the native iPhone app is ready.", "info");
    });

    androidBtn && androidBtn.addEventListener("click", function (event) {
      event.preventDefault();
      if (isStandalone()) return hidePill();
      if (deferredPrompt) return runPrompt();
      notify("Install Evaraos", "On Android, open Chrome menu and choose Install app if the prompt is not visible yet.", "info");
    });
  }

  function bindEvents() {
    window.addEventListener("beforeinstallprompt", function (event) {
      event.preventDefault();
      deferredPrompt = event;
      showPill();
    });

    window.addEventListener("appinstalled", function () {
      deferredPrompt = null;
      hidePill();
      notify("Installed", "Evaraos has been installed on this device.", "success");
    });
  }

  function initInstallPrompt() {
    if (!findTargets()) return false;
    bindClicks();
    if (isStandalone()) hidePill();
    else showPill();
    return true;
  }

  function waitForTargets() {
    if (initInstallPrompt()) return;
    const observer = new MutationObserver(function () {
      if (initInstallPrompt()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    registerServiceWorker();
    bindEvents();
    waitForTargets();
  }

  window.EvaraInstall = {
    runNativeInstallPrompt: runPrompt,
    isIOS: isIOS,
    isAndroid: isAndroid,
    isInStandaloneMode: isStandalone
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
