(function () {
  const ENGINE_ID = "galaxyEngine";
  const CANVAS_ID = "galaxyCanvas";

  const QUALITY = {
    low: {
      stars: 42,
      dpr: 1,
      frameSkip: 2,
      nebulaPasses: 2
    },
    medium: {
      stars: 64,
      dpr: 1.35,
      frameSkip: 1,
      nebulaPasses: 3
    },
    high: {
      stars: 88,
      dpr: 1.6,
      frameSkip: 1,
      nebulaPasses: 3
    }
  };

  let canvas = null;
  let ctx = null;
  let stars = [];
  let rafId = null;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let active = false;
  let quality = "medium";
  let frame = 0;
  let resizeTimer = null;
  let observer = null;
  let hasInitialized = false;

  function prefersReducedMotion() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || false;
  }

  function isSmallDevice() {
    return window.innerWidth <= 640 || navigator.hardwareConcurrency <= 4;
  }

  function isFastDevice() {
    return navigator.hardwareConcurrency >= 8 && window.innerWidth > 780;
  }

  function chooseQuality() {
    if (prefersReducedMotion()) return "low";
    if (isSmallDevice()) return "low";
    if (isFastDevice()) return "high";
    return "medium";
  }

  function getConfig() {
    return QUALITY[quality] || QUALITY.medium;
  }

  function isGalaxyTheme() {
    return document.documentElement.getAttribute("data-theme") === "galaxy";
  }

  function shouldDelayForLoader() {
    return (
      document.body?.classList.contains("app-loading") ||
      document.documentElement.classList.contains("boot-pending") ||
      document.documentElement.classList.contains("auth-pending")
    );
  }

  function ensureEngine() {
    let engine = document.getElementById(ENGINE_ID);

    if (!engine) {
      engine = document.createElement("div");
      engine.id = ENGINE_ID;
      engine.className = "galaxy-engine";
      engine.setAttribute("aria-hidden", "true");
      document.body.appendChild(engine);
    }

    return engine;
  }

  function ensureCanvas() {
    const engine = ensureEngine();
    let existing = document.getElementById(CANVAS_ID);

    if (existing) return existing;

    existing = document.createElement("canvas");
    existing.id = CANVAS_ID;
    existing.className = "galaxy-canvas";
    existing.setAttribute("aria-hidden", "true");
    engine.appendChild(existing);

    return existing;
  }

  function createStars(count) {
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.45 + 0.35,
      a: Math.random() * 0.7 + 0.22,
      drift: Math.random() * 0.12 + 0.035,
      tw: Math.random() * 0.009 + 0.002,
      hue: Math.random()
    }));
  }

  function resize() {
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const nextWidth = Math.max(1, rect.width || window.innerWidth);
    const nextHeight = Math.max(1, rect.height || window.innerHeight);

    quality = chooseQuality();

    const config = getConfig();
    const nextDpr = Math.min(window.devicePixelRatio || 1, config.dpr);

    const changed =
      Math.abs(width - nextWidth) > 4 ||
      Math.abs(height - nextHeight) > 4 ||
      Math.abs(dpr - nextDpr) > 0.05 ||
      stars.length !== config.stars;

    width = nextWidth;
    height = nextHeight;
    dpr = nextDpr;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (changed || !stars.length) {
      createStars(config.stars);
    }
  }

  function scheduleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  }

  function drawNebula(t) {
    const config = getConfig();

    const driftA = Math.sin(t * 0.00011) * 24;
    const driftB = Math.cos(t * 0.00009) * 18;
    const driftC = Math.sin(t * 0.000075) * 16;

    const gradA = ctx.createRadialGradient(
      width * 0.18 + driftA,
      height * 0.74,
      0,
      width * 0.18 + driftA,
      height * 0.74,
      width * 0.44
    );
    gradA.addColorStop(0, "rgba(132, 104, 255, 0.18)");
    gradA.addColorStop(1, "rgba(132, 104, 255, 0)");

    const gradB = ctx.createRadialGradient(
      width * 0.80 + driftB,
      height * 0.32,
      0,
      width * 0.80 + driftB,
      height * 0.32,
      width * 0.36
    );
    gradB.addColorStop(0, "rgba(255, 118, 214, 0.13)");
    gradB.addColorStop(1, "rgba(255, 118, 214, 0)");

    ctx.fillStyle = gradA;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = gradB;
    ctx.fillRect(0, 0, width, height);

    if (config.nebulaPasses >= 3) {
      const gradC = ctx.createRadialGradient(
        width * 0.56 + driftC,
        height * 0.54,
        0,
        width * 0.56 + driftC,
        height * 0.54,
        width * 0.3
      );
      gradC.addColorStop(0, "rgba(92, 124, 255, 0.11)");
      gradC.addColorStop(1, "rgba(92, 124, 255, 0)");

      ctx.fillStyle = gradC;
      ctx.fillRect(0, 0, width, height);
    }
  }

  function drawBeam(t) {
    const shift = Math.sin(t * 0.00009) * 40;

    const beam = ctx.createLinearGradient(
      width * 0.06 + shift,
      0,
      width * 0.94 - shift,
      height
    );

    beam.addColorStop(0.16, "rgba(120, 102, 255, 0)");
    beam.addColorStop(0.32, "rgba(120, 102, 255, 0.052)");
    beam.addColorStop(0.48, "rgba(214, 124, 255, 0.092)");
    beam.addColorStop(0.62, "rgba(88, 132, 255, 0.072)");
    beam.addColorStop(0.80, "rgba(120, 102, 255, 0)");

    ctx.fillStyle = beam;
    ctx.fillRect(0, 0, width, height);
  }

  function drawStars(t) {
    for (const star of stars) {
      const alpha = star.a + Math.sin(t * star.tw + star.x * 0.02) * 0.16;
      const safeAlpha = Math.max(0.08, Math.min(0.92, alpha));

      ctx.beginPath();

      if (star.hue > 0.82) {
        ctx.fillStyle = `rgba(255,210,248,${safeAlpha})`;
      } else if (star.hue > 0.68) {
        ctx.fillStyle = `rgba(210,220,255,${safeAlpha})`;
      } else {
        ctx.fillStyle = `rgba(255,255,255,${safeAlpha})`;
      }

      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();

      star.y += star.drift;

      if (star.y > height + 4) {
        star.y = -4;
        star.x = Math.random() * width;
      }
    }
  }

  function tick(t) {
    if (!active || !canvas || !ctx) return;

    const config = getConfig();
    frame += 1;

    if (config.frameSkip > 1 && frame % config.frameSkip !== 0) {
      rafId = requestAnimationFrame(tick);
      return;
    }

    ctx.clearRect(0, 0, width, height);
    drawNebula(t);
    drawBeam(t);
    drawStars(t);

    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (active) return;
    if (!isGalaxyTheme()) return;

    if (shouldDelayForLoader()) {
      window.addEventListener(
        "evara:session-ready",
        () => {
          if (isGalaxyTheme()) start();
        },
        { once: true }
      );
      return;
    }

    canvas = ensureCanvas();
    ctx = canvas.getContext("2d", {
      alpha: true,
      desynchronized: true
    });

    if (!ctx) return;

    active = true;
    frame = 0;
    resize();
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    active = false;

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    if (ctx) {
      ctx.clearRect(0, 0, width, height);
    }
  }

  function restart() {
    stop();
    start();
  }

  function syncTheme() {
    if (isGalaxyTheme()) {
      start();
    } else {
      stop();
    }
  }

  function init() {
    if (hasInitialized) return;
    hasInitialized = true;

    ensureEngine();

    if (isGalaxyTheme()) {
      ensureCanvas();
    }

    syncTheme();

    window.addEventListener("resize", scheduleResize, { passive: true });

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", scheduleResize, { passive: true });
    }

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        stop();
      } else {
        restart();
      }
    });

    window.addEventListener("evara:session-ready", syncTheme);
    window.addEventListener("evara:theme-ready", syncTheme);
    window.addEventListener("evara:theme-changed", syncTheme);

    observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });
  }

  window.EvaraGalaxy = {
    start,
    stop,
    restart,
    syncTheme,
    getState() {
      return {
        active,
        quality,
        stars: stars.length,
        width,
        height,
        dpr
      };
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();