(function () {
  const ENGINE_ID = "galaxyEngine";
  const FAR_COUNT = 90;
  const NEAR_COUNT = 46;

  function random(min, max) {
    return Math.random() * (max - min) + min;
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function createLayer(className) {
    const layer = document.createElement("div");
    layer.className = className;
    return layer;
  }

  function createStar(sizeClass, twinkleClass) {
    const star = document.createElement("span");
    star.className = `galaxy-star ${sizeClass} ${twinkleClass}`;
    star.style.left = `${random(0, 100)}%`;
    star.style.top = `${random(0, 100)}%`;
    star.style.animationDelay = `${random(0, 6)}s`;
    star.style.animationDuration = `${random(2.6, 6.4)}s`;
    return star;
  }

  function populateStars(layer, count, near = false) {
    const sizePool = near
      ? ["small", "medium", "medium", "large"]
      : ["tiny", "tiny", "small", "small", "medium"];

    const twinklePool = near
      ? ["twinkle", "twinkle", "twinkle-slow"]
      : ["twinkle-slow", "twinkle", "twinkle-slow"];

    for (let i = 0; i < count; i += 1) {
      layer.appendChild(createStar(pick(sizePool), pick(twinklePool)));
    }
  }

  function ensureEngine() {
    let engine = document.getElementById(ENGINE_ID);
    if (engine) return engine;

    engine = document.createElement("div");
    engine.id = ENGINE_ID;
    engine.className = "galaxy-engine";
    engine.setAttribute("aria-hidden", "true");
    document.body.appendChild(engine);
    return engine;
  }

  function buildGalaxy() {
    const engine = ensureEngine();
    if (engine.dataset.built === "true") return;

    const far = createLayer("galaxy-starfield galaxy-starfield-far");
    const near = createLayer("galaxy-starfield galaxy-starfield-near");
    const dust = createLayer("galaxy-dust");
    const milkyway = createLayer("galaxy-milkyway");

    populateStars(far, FAR_COUNT, false);
    populateStars(near, NEAR_COUNT, true);

    engine.appendChild(far);
    engine.appendChild(near);
    engine.appendChild(dust);
    engine.appendChild(milkyway);

    engine.dataset.built = "true";

    animateLayers(far, near);
  }

  function animateLayers(far, near) {
    let rafId = null;
    let start = performance.now();

    function tick(now) {
      const t = (now - start) / 1000;

      const farX = Math.sin(t * 0.06) * 6;
      const farY = Math.cos(t * 0.05) * 4;

      const nearX = Math.sin(t * 0.11) * 10;
      const nearY = Math.cos(t * 0.09) * 7;

      far.style.transform = `translate3d(${farX}px, ${farY}px, 0)`;
      near.style.transform = `translate3d(${nearX}px, ${nearY}px, 0)`;

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      } else if (document.visibilityState === "visible" && !rafId) {
        start = performance.now();
        rafId = requestAnimationFrame(tick);
      }
    });
  }

  function init() {
    buildGalaxy();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();