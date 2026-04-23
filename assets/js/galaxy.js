(function () {
  const ENGINE_ID = "galaxyEngine";
  const CANVAS_ID = "galaxyCanvas";
  const STAR_COUNT = 80;

  let canvas = null;
  let ctx = null;
  let stars = [];
  let rafId = null;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let active = false;

  function isGalaxyTheme() {
    return document.documentElement.getAttribute("data-theme") === "galaxy";
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

  function resize() {
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.8 + 0.4,
      a: Math.random() * 0.8 + 0.2,
      drift: Math.random() * 0.18 + 0.04,
      tw: Math.random() * 0.012 + 0.003
    }));
  }

  function drawNebula(t) {
    const driftA = Math.sin(t * 0.00014) * 26;
    const driftB = Math.cos(t * 0.00011) * 20;
    const driftC = Math.sin(t * 0.00009) * 18;

    const gradA = ctx.createRadialGradient(
      width * 0.2 + driftA, height * 0.72,
      0,
      width * 0.2 + driftA, height * 0.72,
      width * 0.42
    );
    gradA.addColorStop(0, "rgba(132, 104, 255, 0.18)");
    gradA.addColorStop(1, "rgba(132, 104, 255, 0)");

    const gradB = ctx.createRadialGradient(
      width * 0.78 + driftB, height * 0.34,
      0,
      width * 0.78 + driftB, height * 0.34,
      width * 0.34
    );
    gradB.addColorStop(0, "rgba(255, 118, 214, 0.12)");
    gradB.addColorStop(1, "rgba(255, 118, 214, 0)");

    const gradC = ctx.createRadialGradient(
      width * 0.56 + driftC, height * 0.54,
      0,
      width * 0.56 + driftC, height * 0.54,
      width * 0.3
    );
    gradC.addColorStop(0, "rgba(92, 124, 255, 0.12)");
    gradC.addColorStop(1, "rgba(92, 124, 255, 0)");

    ctx.fillStyle = gradA;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = gradB;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = gradC;
    ctx.fillRect(0, 0, width, height);
  }

  function drawBeam(t) {
    const shift = Math.sin(t * 0.00011) * 40;

    const beam = ctx.createLinearGradient(
      width * 0.08 + shift, 0,
      width * 0.92 - shift, height
    );
    beam.addColorStop(0.18, "rgba(120, 102, 255, 0)");
    beam.addColorStop(0.34, "rgba(120, 102, 255, 0.06)");
    beam.addColorStop(0.48, "rgba(214, 124, 255, 0.10)");
    beam.addColorStop(0.62, "rgba(88, 132, 255, 0.08)");
    beam.addColorStop(0.78, "rgba(120, 102, 255, 0)");

    ctx.fillStyle = beam;
    ctx.fillRect(0, 0, width, height);
  }

  function drawStars(t) {
    for (const star of stars) {
      const alpha = star.a + Math.sin(t * star.tw + star.x * 0.02) * 0.18;
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0.1, Math.min(1, alpha))})`;
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

    ctx.clearRect(0, 0, width, height);
    drawNebula(t);
    drawBeam(t);
    drawStars(t);

    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (active) return;
    if (!isGalaxyTheme()) return;

    canvas = ensureCanvas();
    ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    active = true;
    resize();
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    active = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (ctx) ctx.clearRect(0, 0, width, height);
  }

  function syncTheme() {
    if (isGalaxyTheme()) start();
    else stop();
  }

  function init() {
    ensureEngine();
    ensureCanvas();
    syncTheme();

    window.addEventListener("resize", resize, { passive: true });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") stop();
      else syncTheme();
    });

    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();