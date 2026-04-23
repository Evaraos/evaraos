(function () {
  let deferredPrompt = null;
  let installBtn = null;

  function isIOS() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  }

  function isInStandaloneMode() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function showButton() {
    if (!installBtn || isInStandaloneMode()) return;
    installBtn.style.display = "inline-flex";
  }

  function hideButton() {
    if (!installBtn) return;
    installBtn.style.display = "none";
  }

  function bindClick() {
    if (!installBtn) return;

    installBtn.addEventListener("click", async function () {
      if (isIOS()) {
        window.alert("On iPhone: tap Share, then tap Add to Home Screen.");
        return;
      }

      if (!deferredPrompt) return;

      deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } catch {}
      deferredPrompt = null;
      hideButton();
    });
  }

  function init() {
    installBtn = document.getElementById("installBtn");
    if (!installBtn) return;

    bindClick();

    window.addEventListener("beforeinstallprompt", function (event) {
      event.preventDefault();
      deferredPrompt = event;
      showButton();
    });

    window.addEventListener("appinstalled", function () {
      deferredPrompt = null;
      hideButton();
    });

    if (isIOS() && !isInStandaloneMode()) {
      showButton();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
