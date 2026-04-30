(function () {
  let deferredPrompt = null;
  let pill = null;
  let appleBtn = null;
  let androidBtn = null;
  let noticeTimer = null;

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent || "");
  }

  function isAndroid() {
    return /android/i.test(navigator.userAgent || "");
  }

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function ensureInstallPolishStyles() {
    if (document.getElementById("evaraInstallPolishStyles")) return;
    const style = document.createElement("style");
    style.id = "evaraInstallPolishStyles";
    style.textContent = `
      .evara-install-notice {
        position: fixed !important;
        left: 50% !important;
        right: auto !important;
        top: auto !important;
        bottom: max(118px, calc(env(safe-area-inset-bottom) + 96px)) !important;
        z-index: 2147483647 !important;
        width: min(92vw, 430px) !important;
        display: grid !important;
        place-items: center !important;
        opacity: 0;
        pointer-events: none !important;
        transform: translateX(-50%) translateY(16px) scale(.98) !important;
        transition: opacity .18s ease, transform .18s ease !important;
      }
      .evara-install-notice.show {
        opacity: 1 !important;
        transform: translateX(-50%) translateY(0) scale(1) !important;
      }
      .evara-install-notice-card {
        width: 100% !important;
        grid-template-columns: auto 1fr auto !important;
        padding: 13px 13px !important;
        border-radius: 26px !important;
        background: rgba(255,255,255,.92) !important;
        border: 1px solid rgba(255,255,255,.96) !important;
        box-shadow: 0 20px 58px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.98) !important;
        backdrop-filter: blur(30px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(30px) saturate(180%) !important;
      }
      .evara-install-notice-icon {
        width: 42px !important;
        height: 42px !important;
        border-radius: 16px !important;
        background: rgba(255,255,255,.78) url('/evaraos/assets/img/evaraos_logo.png') center / 78% 78% no-repeat !important;
        border: 1px solid rgba(255,255,255,.92) !important;
        box-shadow: 0 10px 22px rgba(0,0,0,.13), inset 0 1px 0 rgba(255,255,255,.96) !important;
      }
      .evara-install-notice-icon:before,
      .evara-install-notice-icon:after { content: none !important; display: none !important; }
      .evara-install-notice-close,
      .evara-ios-install-close {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 0 !important;
        line-height: 1 !important;
        text-align: center !important;
      }
      .evara-install-notice-close span,
      .evara-ios-install-close span {
        display: block !important;
        transform: translateY(-1px) !important;
        line-height: 1 !important;
      }
      .evara-ios-install-guide {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483646 !important;
        display: grid !important;
        place-items: center !important;
        padding: max(16px, env(safe-area-inset-top)) 14px max(18px, env(safe-area-inset-bottom)) !important;
      }
      .evara-ios-install-backdrop {
        background: rgba(10,12,14,.22) !important;
        backdrop-filter: blur(18px) saturate(160%) !important;
        -webkit-backdrop-filter: blur(18px) saturate(160%) !important;
      }
      .evara-ios-install-card {
        width: min(92vw, 430px) !important;
        max-width: 430px !important;
        border-radius: 38px !important;
        padding: 18px !important;
        overflow: visible !important;
        background:
          radial-gradient(circle at 18% 0%, rgba(200,0,18,.14), transparent 34%),
          linear-gradient(180deg, rgba(255,255,255,.96), rgba(255,255,255,.84)) !important;
        border: 1px solid rgba(255,255,255,.98) !important;
        box-shadow: 0 30px 95px rgba(0,0,0,.30), inset 0 1px 0 rgba(255,255,255,.99) !important;
        backdrop-filter: blur(34px) saturate(185%) !important;
        -webkit-backdrop-filter: blur(34px) saturate(185%) !important;
      }
      .evara-ios-install-close {
        top: -13px !important;
        right: 5px !important;
        width: 44px !important;
        height: 44px !important;
        font-size: 1.28rem !important;
        border-radius: 999px !important;
      }
      .evara-ios-install-app {
        grid-template-columns: auto 1fr !important;
        gap: 13px !important;
        padding: 10px 48px 12px 4px !important;
        margin-bottom: 4px !important;
      }
      .evara-ios-install-logo {
        width: 58px !important;
        height: 58px !important;
        padding: 6px !important;
        border-radius: 20px !important;
        background: rgba(255,255,255,.78) !important;
        border: 1px solid rgba(255,255,255,.92) !important;
        box-shadow: 0 14px 28px rgba(0,0,0,.12), inset 0 1px 0 rgba(255,255,255,.96) !important;
      }
      .evara-ios-install-app strong {
        font-size: 1.2rem !important;
        letter-spacing: -.045em !important;
      }
      .evara-ios-install-app span {
        font-size: .82rem !important;
        font-weight: 800 !important;
      }
      .evara-ios-system-message {
        margin-top: 8px !important;
        padding: 16px !important;
        border-radius: 26px !important;
        background: rgba(255,255,255,.64) !important;
        border: 1px solid rgba(255,255,255,.84) !important;
      }
      .evara-ios-system-message strong {
        font-size: 1.18rem !important;
      }
      .evara-ios-step-list {
        display: grid !important;
        gap: 10px !important;
        margin-top: 12px !important;
      }
      .evara-ios-step {
        display: grid !important;
        grid-template-columns: 38px 1fr !important;
        gap: 11px !important;
        align-items: center !important;
        padding: 12px !important;
        border-radius: 22px !important;
        background: rgba(255,255,255,.58) !important;
        border: 1px solid rgba(255,255,255,.78) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.86) !important;
      }
      .evara-ios-step-number {
        width: 38px !important;
        height: 38px !important;
        border-radius: 999px !important;
        display: grid !important;
        place-items: center !important;
        color: #101917 !important;
        background: rgba(255,255,255,.88) !important;
        font-weight: 950 !important;
        box-shadow: 0 10px 20px rgba(0,0,0,.10), inset 0 1px 0 rgba(255,255,255,.96) !important;
      }
      .evara-ios-step strong {
        display: block !important;
        font-size: .94rem !important;
        font-weight: 950 !important;
        line-height: 1.08 !important;
        letter-spacing: -.035em !important;
      }
      .evara-ios-step span {
        display: block !important;
        margin-top: 4px !important;
        color: rgba(60,60,67,.70) !important;
        font-size: .76rem !important;
        font-weight: 740 !important;
        line-height: 1.25 !important;
      }
      html[data-theme="dark"] .evara-install-notice-card,
      html[data-theme="galaxy"] .evara-install-notice-card,
      html[data-theme$="-dark"] .evara-install-notice-card,
      html[data-theme="dark"] .evara-ios-install-card,
      html[data-theme="galaxy"] .evara-ios-install-card,
      html[data-theme$="-dark"] .evara-ios-install-card {
        color: #f5f5f7 !important;
        background:
          radial-gradient(circle at 18% 0%, rgba(255,45,85,.18), transparent 34%),
          linear-gradient(180deg, rgba(36,36,38,.96), rgba(28,28,30,.86)) !important;
        border-color: rgba(255,255,255,.14) !important;
      }
      html[data-theme="dark"] .evara-ios-step,
      html[data-theme="galaxy"] .evara-ios-step,
      html[data-theme$="-dark"] .evara-ios-step,
      html[data-theme="dark"] .evara-ios-system-message,
      html[data-theme="galaxy"] .evara-ios-system-message,
      html[data-theme$="-dark"] .evara-ios-system-message {
        background: rgba(255,255,255,.07) !important;
        border-color: rgba(255,255,255,.10) !important;
      }
      html[data-theme="dark"] .evara-ios-step-number,
      html[data-theme="galaxy"] .evara-ios-step-number,
      html[data-theme$="-dark"] .evara-ios-step-number {
        color: #f5f5f7 !important;
        background: rgba(255,255,255,.12) !important;
      }
      html[data-theme="dark"] .evara-ios-step span,
      html[data-theme="galaxy"] .evara-ios-step span,
      html[data-theme$="-dark"] .evara-ios-step span {
        color: rgba(235,235,245,.64) !important;
      }
      @media (max-width: 480px) {
        .evara-install-notice {
          bottom: max(104px, calc(env(safe-area-inset-bottom) + 86px)) !important;
          width: min(92vw, 410px) !important;
        }
        .evara-ios-install-card { width: min(92vw, 410px) !important; }
      }
    `;
    document.head.appendChild(style);
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
    const panel = document.getElementById("evaMenuPanel");
    const backdrop = document.getElementById("evaBackdrop");

    zone && zone.classList.remove("open");
    panel && panel.classList.remove("open");
    backdrop && backdrop.classList.remove("open");
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

    notice.querySelector(".evara-install-notice-close")?.addEventListener("click", function () {
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
    closeMenu();
    showInstallNotice("Installing Evaraos", "Follow the Android install prompt to add the app.", "android");

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

  function createAppleGuide() {
    const existing = document.getElementById("evaraIOSInstallGuide");
    if (existing) return existing;

    const overlay = document.createElement("div");
    overlay.id = "evaraIOSInstallGuide";
    overlay.className = "evara-ios-install-guide";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = [
      '<div class="evara-ios-install-backdrop" data-install-guide-close></div>',
      '<section class="evara-ios-install-card" role="dialog" aria-modal="true" aria-label="Install Evaraos on iPhone">',
      '  <button type="button" class="evara-ios-install-close" data-install-guide-close aria-label="Close"><span aria-hidden="true">×</span></button>',
      '  <div class="evara-ios-install-app">',
      '    <img src="/evaraos/assets/img/evaraos_logo.png" alt="Evaraos" class="evara-ios-install-logo">',
      '    <div><strong>Install Evaraos</strong><span>Add the command center to your iPhone Home Screen.</span></div>',
      '  </div>',
      '  <div class="evara-ios-system-message">',
      '    <strong>iPhone install steps</strong>',
      '    <p>Keep this menu open, tap Share in the browser bar, then choose <b>Add to Home Screen</b>.</p>',
      '  </div>',
      '  <div class="evara-ios-step-list">',
      '    <div class="evara-ios-step"><span class="evara-ios-step-number">1</span><div><strong>Tap the Share button</strong><span>Use the browser share icon at the bottom or top of Safari.</span></div></div>',
      '    <div class="evara-ios-step"><span class="evara-ios-step-number">2</span><div><strong>Add to Home Screen</strong><span>Confirm the Evaraos icon, then tap Add.</span></div></div>',
      '  </div>',
      '</section>'
    ].join("");

    overlay.addEventListener("click", function (event) {
      if (event.target.closest("[data-install-guide-close]")) closeGuide();
    });

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

    appleBtn && appleBtn.addEventListener("click", function (event) {
      event.preventDefault();
      openAppleGuide();
    });

    androidBtn && androidBtn.addEventListener("click", function (event) {
      event.preventDefault();
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
    ensureInstallPolishStyles();
    registerServiceWorker();
    bindEvents();
    waitForTargets();
  }

  window.EvaraInstall = {
    openIOSInstallGuide: openAppleGuide,
    closeIOSInstallGuide: closeGuide,
    runNativeInstallPrompt: runPrompt,
    isIOS: isIOS,
    isAndroid: isAndroid,
    isInStandaloneMode: isStandalone
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
