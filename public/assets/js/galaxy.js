(function () {
  function stop() {
    const engine = document.getElementById("galaxyEngine");
    if (engine) {
      engine.innerHTML = "";
      engine.style.display = "none";
      engine.setAttribute("aria-hidden", "true");
    }
  }

  function noop() {
    stop();
  }

  window.EvaraGalaxy = {
    start: noop,
    stop,
    restart: noop,
    syncTheme: noop,
    getState() {
      return {
        active: false,
        visualStack: "apple-settings-glass"
      };
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", stop, { once: true });
  } else {
    stop();
  }
})();
