function loadGalaxyCss() {
  let link = document.getElementById(GALAXY_CSS_ID);

  if (link && galaxyLoaded) {
    link.disabled = false;

    if (window.EvaraGalaxy && typeof window.EvaraGalaxy.syncTheme === "function") {
      window.EvaraGalaxy.syncTheme();
    }

    return;
  }

  if (pending) return;

  pending = true;

  if (!link) {
    link = document.createElement("link");
    link.id = GALAXY_CSS_ID;
    link.rel = "stylesheet";
    link.href = GALAXY_CSS_HREF;
    link.media = "all";

    link.onload = () => {
      galaxyLoaded = true;
      pending = false;
      link.disabled = false;

      window.dispatchEvent(
        new CustomEvent("evara:galaxy-css-ready", {
          detail: { loaded: true }
        })
      );

      if (window.EvaraGalaxy && typeof window.EvaraGalaxy.syncTheme === "function") {
        window.EvaraGalaxy.syncTheme();
      }
    };

    link.onerror = () => {
      pending = false;
    };

    document.head.appendChild(link);
    return;
  }

  link.disabled = false;
  galaxyLoaded = true;
  pending = false;
}