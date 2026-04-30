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

  async function runIOSInstallFlow() {
    notify("Install Evaraos", "Tap Share, then Add to Home Screen. Apple does not allow one-tap web app installs from Safari yet.", "info");

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Evaraos Inc",
          text: "Add Evaraos to your iPhone Home Screen.",
          url: window.location.origin + "/evaraos/"
        });
      } catch {}
    }
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
