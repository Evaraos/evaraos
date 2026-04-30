(function () {
  let deferredPrompt = null;
  let installBtn = null;
  let promptListenerBound = false;
  let installedListenerBound = false;

  function isIOS() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  }

  function isInStandaloneMode() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function notify(title, message, tone = "info") {
    window.dispatchEvent(new CustomEvent("evara:notify", { detail: { title, message, tone } }));
  }

  function findInstallButton() {
    return document.querySelector("#evaMenuPanel #installBtn") || document.querySelector(".eva-install-chip");
  }

  function setInstallState(state, label) {
    if (!installBtn) return;
    installBtn.dataset.installState = state;
    const labelNode = installBtn.querySelector(".eva-install-label") || installBtn;
    if (labelNode) labelNode.textContent = label;
  }

  function showButton() {
    if (!installBtn || isInStandaloneMode()) return;
    installBtn.hidden = false;
    installBtn.style.display = "inline-flex";
  }

  function hideButton() {
    if (!installBtn) return;
    installBtn.hidden = true;
    installBtn.style.display = "none";
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.register("/evaraos/sw.js", {
        scope: "/evaraos/"
      });

      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;

        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            worker.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });
    } catch (error) {
      console.warn("Evaraos service worker registration skipped:", error);
    }
  }

  async function runNativeInstallPrompt() {
    if (!deferredPrompt) return false;

    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } catch {}
    deferredPrompt = null;
    hideButton();
    return true;
  }

  function getShareIconHint() {
    const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
    return isSafari
      ? "Tap the Safari share icon, then choose Add to Home Screen."
      : "Open this page in Safari, tap Share, then choose Add to Home Screen.";
  }

  function createIOSInstallGuide() {
    const existing = document.getElementById("evaraIOSInstallGuide");
    if (existing) return existing;

    const overlay = document.createElement("div");
    overlay.id = "evaraIOSInstallGuide";
    overlay.className = "evara-ios-install-guide";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="evara-ios-install-backdrop" data-install-guide-close></div>
      <section class="evara-ios-install-card" role="dialog" aria-modal="true" aria-label="Install Evaraos on iPhone">
        <button type="button" class="evara-ios-install-close" data-install-guide-close aria-label="Close install guide">×</button>
        <div class="evara-ios-install-app">
          <img src="/evaraos/assets/img/evaraos_logo.png" alt="" class="evara-ios-install-logo">
          <div>
            <strong>Evaraos Inc</strong>
            <span>Install as a Home Screen app</span>
          </div>
        </div>

        <div class="evara-ios-install-steps">
          <div class="evara-ios-step">
            <span class="evara-ios-step-icon">⇧</span>
            <div>
              <strong>1. Tap Share</strong>
              <p>${getShareIconHint()}</p>
            </div>
          </div>

          <div class="evara-ios-step">
            <span class="evara-ios-step-icon">＋</span>
            <div>
              <strong>2. Add to Home Screen</strong>
              <p>Scroll the share sheet options until you see Add to Home Screen.</p>
            </div>
          </div>

          <div class="evara-ios-step">
            <span class="evara-ios-step-icon">✓</span>
            <div>
              <strong>3. Tap Add</strong>
              <p>Evaraos will open like an app with full-screen navigation and offline caching.</p>
            </div>
          </div>
        </div>

        <div class="evara-ios-install-actions">
          <button type="button" class="evara-ios-install-copy" id="evaraCopyInstallUrl">Copy App Link</button>
          <button type="button" class="evara-ios-install-done" data-install-guide-close>Got it</button>
        </div>
      </section>
    `;

    document.body.appendChild(overlay);

    overlay.addEventListener("click", async (event) => {
      if (event.target.closest("[data-install-guide-close]")) {
        closeIOSInstallGuide();
        return;
      }

      if (event.target.closest("#evaraCopyInstallUrl")) {
        try {
          await navigator.clipboard.writeText(window.location.origin + "/evaraos/");
          notify("Copied", "Evaraos app link copied.", "success");
        } catch {
          notify("Copy failed", "Copy this link manually from the address bar.", "warning");
        }
      }
    });

    return overlay;
  }

  function openIOSInstallGuide() {
    const overlay = createIOSInstallGuide();
    overlay.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("evara-install-guide-open");
    requestAnimationFrame(() => overlay.classList.add("open"));
  }

  function closeIOSInstallGuide() {
    const overlay = document.getElementById("evaraIOSInstallGuide");
    if (!overlay) return;
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("evara-install-guide-open");
  }

  async function runIOSInstallFlow() {
    openIOSInstallGuide();
  }

  function bindClick() {
    if (!installBtn || installBtn.dataset.installBound === "true") return;
    installBtn.dataset.installBound = "true";

    installBtn.addEventListener("click", async function () {
      if (isInStandaloneMode()) {
        hideButton();
        return;
      }

      if (deferredPrompt) {
        await runNativeInstallPrompt();
        return;
      }

      if (isIOS()) {
        await runIOSInstallFlow();
        return;
      }

      notify("Install unavailable", "Your browser is not offering the install prompt yet. Try Chrome, Edge, or reopen after the app finishes caching.", "warning");
    });
  }

  function bindPromptListeners() {
    if (!promptListenerBound) {
      promptListenerBound = true;
      window.addEventListener("beforeinstallprompt", function (event) {
        event.preventDefault();
        deferredPrompt = event;
        setInstallState("ready", "Install");
        showButton();
      });
    }

    if (!installedListenerBound) {
      installedListenerBound = true;
      window.addEventListener("appinstalled", function () {
        deferredPrompt = null;
        notify("Installed", "Evaraos has been installed on this device.", "success");
        hideButton();
      });
    }
  }

  function initInstallPrompt() {
    installBtn = findInstallButton();
    if (!installBtn) return false;

    bindClick();
    bindPromptListeners();

    if (isInStandaloneMode()) {
      hideButton();
      return true;
    }

    if (isIOS()) {
      setInstallState("ios", "Install");
      showButton();
    } else if (deferredPrompt) {
      setInstallState("ready", "Install");
      showButton();
    } else {
      setInstallState("waiting", "Install");
      hideButton();
    }

    return true;
  }

  function waitForNavButton() {
    if (initInstallPrompt()) return;

    const observer = new MutationObserver(() => {
      if (initInstallPrompt()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    registerServiceWorker();
    waitForNavButton();
  }

  window.EvaraInstall = {
    openIOSInstallGuide,
    closeIOSInstallGuide,
    isIOS,
    isInStandaloneMode
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
