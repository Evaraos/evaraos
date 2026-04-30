(function () {
  let deferredPrompt = null;
  let installBtn = null;

  function isIOS() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  }

  function isInStandaloneMode() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function notify(title, message, tone = "info") {
    window.dispatchEvent(new CustomEvent("evara:notify", { detail: { title, message, tone } }));
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
    notify("Install Evaraos", "On iPhone, tap Share, then Add to Home Screen. Apple does not allow one-tap web app installs yet.", "info");

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Evaraos Inc",
          text: "Install Evaraos by adding it to your iPhone Home Screen.",
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

  function initInstallPrompt() {
    installBtn = document.getElementById("installBtn");
    if (!installBtn) return;

    bindClick();

    if (isInStandaloneMode()) {
      hideButton();
      return;
    }

    if (isIOS()) {
      setInstallState("ios", "Install");
      showButton();
    } else {
      setInstallState("waiting", "Install");
    }

    window.addEventListener("beforeinstallprompt", function (event) {
      event.preventDefault();
      deferredPrompt = event;
      setInstallState("ready", "Install");
      showButton();
    });

    window.addEventListener("appinstalled", function () {
      deferredPrompt = null;
      notify("Installed", "Evaraos has been installed on this device.", "success");
      hideButton();
    });
  }

  function waitForNavButton() {
    initInstallPrompt();
    if (installBtn) return;

    const observer = new MutationObserver(() => {
      initInstallPrompt();
      if (installBtn) observer.disconnect();
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
