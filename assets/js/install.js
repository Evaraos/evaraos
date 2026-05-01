(function () {
  let deferredPrompt = null;
  let pill = null;
  let appleBtn = null;
  let androidBtn = null;
  let noticeTimer = null;

  const APP_ICON = "/evaraos/assets/img/icon-192.png";

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent || "") ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function isAndroid() {
    return /android/i.test(navigator.userAgent || "");
  }

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function findTargets() {
    pill = document.getElementById("evaInstallPill");
    appleBtn = document.getElementById("evaInstallApple");
    androidBtn = document.getElementById("evaInstallAndroid");
    return Boolean(pill);
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

  function getNotice() {
    let notice = document.getElementById("evaraInstallNotice");
    if (notice) return notice;

    notice = document.createElement("div");
    notice.id = "evaraInstallNotice";
    notice.className = "evara-install-notice";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    notice.innerHTML = [
      '<div class="evara-install-notice-card">',
      '  <span class="evara-install-notice-icon" aria-hidden="true"></span>',
      '  <span class="evara-install-notice-copy">',
      '    <strong></strong>',
      '    <small></small>',
      '  </span>',
      '  <button type="button" class="evara-install-notice-close" aria-label="Close"><span aria-hidden="true">×</span></button>',
      '</div>'
    ].join("");

    notice.querySelector(".evara-install-notice-close")?.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      notice.classList.remove("show");
    });

    document.body.appendChild(notice);
    return notice;
  }

  function showInstallNotice(title, message, tone) {
    const notice = getNotice();
    notice.dataset.tone = tone || "android";

    const titleNode = notice.querySelector("strong");
    const messageNode = notice.querySelector("small");
    if (titleNode) titleNode.textContent = title;
    if (messageNode) messageNode.textContent = message;

    clearTimeout(noticeTimer);
    requestAnimationFrame(function () {
      notice.classList.add("show");
    });

    noticeTimer = setTimeout(function () {
      notice.classList.remove("show");
    }, 5200);
  }

  async function runPrompt() {
    if (!deferredPrompt) return false;

    showInstallNotice("Android Install", "Follow the Chrome install prompt to add Evaraos.", "android");

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
    }, 220);
  }

  function stopInstallCardEvent(event) {
    event.stopPropagation();
  }

  function createAppleGuide() {
    const existing = document.getElementById("evaraIOSInstallGuide");
    if (existing) return existing;

    const overlay = document.createElement("div");
    overlay.id = "evaraIOSInstallGuide";
    overlay.className = "evara-ios-install-guide";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = [
      '<div class="evara-ios-install-backdrop" data-install-guide-close></div>',
      '<section class="evara-ios-install-card" role="dialog" aria-modal="false" aria-label="Install Evaraos on iPhone">',
      '  <button type="button" class="evara-ios-install-close" data-install-guide-close aria-label="Close"><span aria-hidden="true">×</span></button>',
      '  <div class="evara-ios-install-app">',
      '    <img src="' + APP_ICON + '" alt="Evaraos" class="evara-ios-install-logo">',
      '    <div class="evara-ios-install-title"><strong>Install Evaraos</strong><span>iPhone Home Screen app</span></div>',
      '  </div>',
      '  <div class="evara-ios-system-message">',
      '    <strong><span class="evara-share-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M12 16V4m0 0 4 4m-4-4-4 4"/><path d="M6 12v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6"/></svg></span>Tap Share</strong>',
      '    <p>Use the browser share button, then select <b>Add to Home Screen</b>.</p>',
      '  </div>',
      '  <div class="evara-ios-step-list">',
      '    <div class="evara-ios-step"><span class="evara-ios-step-number" data-step="1" aria-label="Step 1">1</span><div><strong>Tap the Share button</strong><span>Use Safari or your browser share icon.</span></div></div>',
      '    <div class="evara-ios-step"><span class="evara-ios-step-number" data-step="2" aria-label="Step 2">2</span><div><strong>Add to Home Screen</strong><span>Confirm the Evaraos icon, then tap Add.</span></div></div>',
      '  </div>',
      '</section>'
    ].join("");

    const card = overlay.querySelector(".evara-ios-install-card");
    card?.addEventListener("click", stopInstallCardEvent, true);
    card?.addEventListener("pointerdown", stopInstallCardEvent, true);
    card?.addEventListener("touchstart", stopInstallCardEvent, { capture: true, passive: true });

    overlay.addEventListener("click", function (event) {
      if (!event.target.closest("[data-install-guide-close]")) return;
      event.preventDefault();
      event.stopPropagation();
      closeGuide();
    }, true);

    document.body.appendChild(overlay);
    return overlay;
  }

  function openAppleGuide() {
    if (isStandalone()) return hidePill();

    const overlay = createAppleGuide();
    document.documentElement.classList.add("evara-install-guide-open");
    overlay.setAttribute("aria-hidden", "false");

    requestAnimationFrame(function () {
      overlay.classList.add("open");
    });
  }

  function bindClicks() {
    if (!pill || pill.dataset.installBound === "true") return;
    pill.dataset.installBound = "true";

    appleBtn?.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      openAppleGuide();
    });

    androidBtn?.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();

      if (isStandalone()) return hidePill();
      if (deferredPrompt) return runPrompt();

      showInstallNotice("Android Install", "Open Chrome menu and tap Install app.", "android");
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
      showInstallNotice("Installed", "Evaraos has been added to this device.", "success");
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
    bindEvents();
    waitForTargets();
  }

  window.EvaraInstall = {
    openIOSInstallGuide: openAppleGuide,
    closeIOSInstallGuide: closeGuide,
    runNativeInstallPrompt: runPrompt,
    isIOS,
    isAndroid,
    isInStandaloneMode: isStandalone
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
