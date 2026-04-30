(function () {
  let deferredPrompt = null;
  let pill = null;
  let appleBtn = null;
  let androidBtn = null;
  let promptBound = false;
  let installedBound = false;

  function isIOS() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  }

  function isAndroid() {
    return /android/i.test(window.navigator.userAgent);
  }

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function notify(title, message, tone = "info") {
    window.dispatchEvent(new CustomEvent("evara:notify", { detail: { title, message, tone } }));
  }

  function findTargets() {
    pill = document.getElementById("evaInstallPill") || document.querySelector(".eva-install-pill");
    appleBtn = document.getElementById("evaInstallApple") || document.querySelector(".eva-install-ios");
    androidBtn = document.getElementById("evaInstallAndroid") || document.querySelector(".eva-install-android");
    return !!pill;
  }

  function showPill() {
    if (!pill || isStandalone()) return;
    pill.hidden = false;
    pill.style.display = "flex";
    pill.dataset.platform = isIOS() ? "ios" : isAndroid() ? "android" : "desktop";
    pill.dataset.installReady = deferredPrompt ? "true" : "false";
  }

  function hidePill() {
    if (!pill) return;
    pill.hidden = true;
    pill.style.display = "none";
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
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch {}
    deferredPrompt = null;
    showPill();
    return true;
  }

  async function attemptShareSheet() {
    if (!navigator.share) return false;
    try {
      await navigator.share({
        title: "Evaraos Inc",
        text: "Install Evaraos by adding it to your Home Screen.",
        url: window.location.origin + "/evaraos/"
      });
      return true;
    } catch {
      return false;
    }
  }

  function createGuide() {
    const existing = document.getElementById("evaraIOSInstallGuide");
    if (existing) return existing;

    const overlay = document.createElement("div");
    overlay.id = "evaraIOSInstallGuide";
    overlay.className = "evara-ios-install-guide";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="evara-ios-install-backdrop" data-install-guide-close></div>
      <section class="evara-ios-install-card" role="dialog" aria-modal="true" aria-label="Install Evaraos">
        <button type="button" class="evara-ios-install-close" data-install-guide-close aria-label="Close">×</button>

        <div class="evara-ios-install-app">
          <img src="/evaraos/assets/img/evaraos_logo.png" alt="" class="evara-ios-install-logo">
          <div>
            <strong>Install Evaraos</strong>
            <span>Get the iPhone app experience</span>
          </div>
        </div>

        <div class="evara-ios-system-message">
          <strong>Tap Add to Home Screen</strong>
          <p>On iPhone, Apple requires the Safari Share menu. Tap the Share icon, then choose <b>Add to Home Screen</b>, then tap <b>Add</b>.</p>
        </div>

        <div class="evara-ios-arrow-note" aria-hidden="true">
          <span class="evara-ios-arrow">↗</span>
          <span>Share icon is in Safari’s bar</span>
        </div>

        <div class="evara-ios-mini-final" aria-hidden="true">
          <div class="evara-ios-mini-top">
            <span>Cancel</span>
            <strong>Add to Home Screen</strong>
            <span>Add</span>
          </div>
          <div class="evara-ios-mini-row">
            <img src="/evaraos/assets/img/evaraos_logo.png" alt="">
            <div><b>Evaraos</b><small>evaraos.github.io/evaraos/</small></div>
          </div>
        </div>

        <div class="evara-ios-install-actions">
          <button type="button" class="evara-ios-install-copy" id="evaraOpenShareSheet">Open Share</button>
          <button type="button" class="evara-ios-install-done" data-install-guide-close>Got it</button>
        </div>
      </section>
    `;

    document.body.appendChild(overlay);
    overlay.addEventListener("click", async (event) => {
      if (event.target.closest("[data-install-guide-close]")) return closeGuide();
      if (event.target.closest("#evaraOpenShareSheet")) {
        await attemptShareSheet();
      }
    });
    return overlay;
  }

  function openGuide() {
    const overlay = createGuide();
    overlay.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("evara-install-guide-open");
    requestAnimationFrame(() => overlay.classList.add("open"));
  }

  function closeGuide() {
    const overlay = document.getElementById("evaraIOSInstallGuide");
    if (!overlay) return;
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("evara-install-guide-open");
  }

  function bindClicks() {
    if (!pill || pill.dataset.installBound === "true") return;
    pill.dataset.installBound = "true";

    appleBtn?.addEventListener("click", async () => {
      if (isStandalone()) return hidePill();
      openGuide();
    });

    androidBtn?.addEventListener("click", () => {
      if (isStandalone()) return hidePill();
      if (deferredPrompt) return runPrompt();
      notify("Install Evaraos", "On Android, use Chrome and choose Install app from the browser menu if a prompt is not visible yet.", "info");
    });
  }

  function bindPromptEvents() {
    if (!promptBound) {
      promptBound = true;
      window.addEventListener("beforeinstallprompt", function (event) {
        event.preventDefault();
        deferredPrompt = event;
        showPill();
      });
    }

    if (!installedBound) {
      installedBound = true;
      window.addEventListener("appinstalled", function () {
        deferredPrompt = null;
        notify("Installed", "Evaraos has been installed on this device.", "success");
        hidePill();
      });
    }
  }

  function initInstallPrompt() {
    if (!findTargets()) return false;
    bindClicks();
    bindPromptEvents();
    if (isStandalone()) hidePill();
    else showPill();
    return true;
  }

  function waitForTargets() {
    if (initInstallPrompt()) return;
    const observer = new MutationObserver(() => {
      if (initInstallPrompt()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    registerServiceWorker();
    waitForTargets();
  }

  window.EvaraInstall = {
    openIOSInstallGuide: openGuide,
    closeIOSInstallGuide: closeGuide,
    runNativeInstallPrompt: runPrompt,
    isIOS,
    isAndroid,
    isInStandaloneMode: isStandalone
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
