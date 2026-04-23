(function () {
  const ENGINE_ID = "galaxyEngine";
  const FAR_COUNT = 120;
  const NEAR_COUNT = 64;
  const HERO_COUNT = 24;

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
    star.style.animationDelay = `${random(0, 8)}s`;
    star.style.animationDuration = `${random(3.4, 8.8)}s`;
    return star;
  }

  function populateStars(layer, count, near = false, hero = false) {
    const sizePool = hero
      ? ["medium", "large", "large"]
      : near
        ? ["small", "medium", "medium", "large"]
        : ["tiny", "tiny", "small", "small", "medium"];

    const twinklePool = hero
      ? ["twinkle", "twinkle-slow"]
      : near
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
    const hero = createLayer("galaxy-starfield galaxy-starfield-hero");
    const dust = createLayer("galaxy-dust");
    const dustTwo = createLayer("galaxy-dust galaxy-dust-two");
    const nebula = createLayer("galaxy-nebula");
    const fog = createLayer("galaxy-fog-band");
    const rift = createLayer("galaxy-rift");
    const milkyway = createLayer("galaxy-milkyway");

    populateStars(far, FAR_COUNT, false, false);
    populateStars(near, NEAR_COUNT, true, false);
    populateStars(hero, HERO_COUNT, true, true);

    engine.appendChild(nebula);
    engine.appendChild(milkyway);
    engine.appendChild(rift);
    engine.appendChild(dust);
    engine.appendChild(dustTwo);
    engine.appendChild(fog);
    engine.appendChild(far);
    engine.appendChild(near);
    engine.appendChild(hero);

    engine.dataset.built = "true";
    animateLayers({
      far,
      near,
      hero,
      dust,
      dustTwo,
      nebula,
      fog,
      rift,
      milkyway
    });
  }

  function animateLayers(layers) {
    let rafId = null;
    let start = performance.now();

    function tick(now) {
      const t = (now - start) / 1000;

      const farX = Math.sin(t * 0.024) * 10;
      const farY = Math.cos(t * 0.018) * 8;

      const nearX = Math.sin(t * 0.044) * 18;
      const nearY = Math.cos(t * 0.036) * 12;

      const heroX = Math.sin(t * 0.062) * 26;
      const heroY = Math.cos(t * 0.056) * 18;

      const dustX = Math.sin(t * 0.016) * 24;
      const dustY = Math.cos(t * 0.012) * 14;

      const dustTwoX = Math.cos(t * 0.014) * 18;
      const dustTwoY = Math.sin(t * 0.018) * 16;

      const fogX = Math.sin(t * 0.01) * 12;
      const fogY = Math.cos(t * 0.008) * 8;

      const nebulaX = Math.sin(t * 0.008) * 10;
      const nebulaY = Math.cos(t * 0.006) * 10;

      const riftX = Math.sin(t * 0.011) * 8;
      const riftY = Math.cos(t * 0.01) * 6;

      const milkyX = Math.cos(t * 0.007) * 14;
      const milkyY = Math.sin(t * 0.006) * 10;

      layers.far.style.transform = `translate3d(${farX}px, ${farY}px, 0)`;
      layers.near.style.transform = `translate3d(${nearX}px, ${nearY}px, 0)`;
      layers.hero.style.transform = `translate3d(${heroX}px, ${heroY}px, 0)`;
      layers.dust.style.transform = `translate3d(${dustX}px, ${dustY}px, 0)`;
      layers.dustTwo.style.transform = `translate3d(${dustTwoX}px, ${dustTwoY}px, 0)`;
      layers.fog.style.transform = `translate3d(${fogX}px, ${fogY}px, 0)`;
      layers.nebula.style.transform = `translate3d(${nebulaX}px, ${nebulaY}px, 0) scale(1.03)`;
      layers.rift.style.transform = `translate3d(${riftX}px, ${riftY}px, 0)`;
      layers.milkyway.style.transform = `translate3d(${milkyX}px, ${milkyY}px, 0)`;

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