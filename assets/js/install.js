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

  function findTargets() {
    pill = document.getElementById("evaInstallPill");
    appleBtn = document.getElementById("evaInstallApple");
    androidBtn = document.getElementById("evaInstallAndroid");
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

  function closeGuide() {
    const overlay = document.getElementById("evaraIOSInstallGuide");
    if (!overlay) return;
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("evara-install-guide-open");
    setTimeout(function () {
      if (overlay.getAttribute("aria-hidden") === "true") overlay.remove();
    }, 180);
  }

  function createGuide() {
    const existing = document.getElementById("evaraIOSInstallGuide");
    if (existing) return existing;

    const overlay = document.createElement("div");
    overlay.id = "evaraIOSInstallGuide";
    overlay.className = "evara-ios-install-guide";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = [
      '<div class="evara-ios-install-backdrop" data-install-guide-close></div>',
      '<div class="evara-ios-share-target" aria-hidden="true"><span class="evara-ios-share-icon">^</span></div>',
      '<section class="evara-ios-install-card" role="dialog" aria-modal="true" aria-label="Install Evaraos on iPhone">',
      '<button type="button" class="evara-ios-install-close" data-install-guide-close aria-label="Close">x</button>',
      '<div class="evara-ios-install-app"><img src="/evaraos/assets/img/evaraos_logo.png" alt="" class="evara-ios-install-logo"><div><strong>Install Evaraos</strong><span>iPhone web app</span></div></div>',
      '<div class="evara-ios-system-message"><strong>Tap Safari Share</strong><p>Then choose <b>Add to Home Screen</b>.</p></div>',
      '</section>'
    ].join("");

    overlay.addEventListener("click", function (event) {
      if (event.target.closest("[data-install-guide-close]")) closeGuide();
    });

    document.body.appendChild(overlay);
    return overlay;
  }

  function openGuide() {
    if (isStandalone()) return hidePill();
    closeMenu();
    const overlay = createGuide();
    document.documentElement.classList.add("evara-install-guide-open");
    overlay.setAttribute("aria-hidden", "false");
    requestAnimationFrame(function () { overlay.classList.add("open"); });
  }

  function bindClicks() {
    if (!pill || pill.dataset.installBound === "true") return;
    pill.dataset.installBound = "true";

    appleBtn && appleBtn.addEventListener("click", function (event) {
      event.preventDefault();
      openGuide();
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
    openIOSInstallGuide: openGuide,
    closeIOSInstallGuide: closeGuide,
    runNativeInstallPrompt: runPrompt,
    isIOS: isIOS,
    isAndroid: isAndroid,
    isInStandaloneMode: isStandalone
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
