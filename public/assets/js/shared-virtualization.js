const DEFAULTS = {
  cacheLimit: 120,
  ttlMs: 1000 * 60 * 15,
  debounceMs: 90,
  idleBudgetMs: 8
};

const engines = new Map();
const idle = window.requestIdleCallback || ((callback) => setTimeout(() => callback({ timeRemaining: () => DEFAULTS.idleBudgetMs }), 1));

function safeJsonParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeKey(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .replace(/^-|-$/g, "") || "default";
}

function now() {
  return Date.now();
}

export function createVirtualizationEngine(name = "default", options = {}) {
  const engineName = normalizeKey(name);
  if (engines.has(engineName)) return engines.get(engineName);

  const settings = { ...DEFAULTS, ...options };
  const memory = new Map();
  const storageKey = `evaraos:virtual-engine:${engineName}:v1`;
  let timer = null;
  let lastSignature = "";

  function makeSignature(rows = [], signatureFn = JSON.stringify) {
    return rows.map((row) => signatureFn(row)).join("|");
  }

  function remember(key, signature, html) {
    const safeKey = normalizeKey(key);
    memory.set(safeKey, { signature, html, updatedAt: now() });

    while (memory.size > settings.cacheLimit) {
      const oldestKey = memory.keys().next().value;
      memory.delete(oldestKey);
    }

    return html;
  }

  function read(key, signature) {
    const item = memory.get(normalizeKey(key));
    if (!item || item.signature !== signature) return "";
    if (now() - item.updatedAt > settings.ttlMs) {
      memory.delete(normalizeKey(key));
      return "";
    }
    return item.html || "";
  }

  function save() {
    try {
      const payload = [...memory.entries()].slice(-settings.cacheLimit);
      localStorage.setItem(storageKey, JSON.stringify({ savedAt: now(), payload }));
    } catch {
      // Shared virtualization remains safe without local persistence.
    }
  }

  function hydrate() {
    try {
      const parsed = safeJsonParse(localStorage.getItem(storageKey), null);
      if (!parsed?.savedAt || now() - parsed.savedAt > settings.ttlMs) return;
      (parsed.payload || []).forEach(([key, value]) => {
        if (key && value?.html && value?.signature) memory.set(key, value);
      });
    } catch {
      // Ignore corrupted cache.
    }
  }

  function renderRow(row, { keyFn, signatureFn, htmlFn }) {
    const key = keyFn(row);
    const signature = signatureFn(row);
    const cached = read(key, signature);
    if (cached) return cached;
    return remember(key, signature, htmlFn(row));
  }

  function renderRows(rows = [], config = {}) {
    const signatureFn = config.signatureFn || JSON.stringify;
    const fullSignature = makeSignature(rows, signatureFn);

    if (config.skipWhenSame !== false && fullSignature === lastSignature && config.lastHtml) {
      return { html: config.lastHtml, changed: false, signature: fullSignature };
    }

    const html = rows.map((row) => renderRow(row, config)).join(config.joiner || "");
    lastSignature = fullSignature;
    return { html, changed: true, signature: fullSignature };
  }

  function prefetch(rows = [], config = {}) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      idle(() => {
        rows.slice(0, settings.cacheLimit).forEach((row) => renderRow(row, config));
        save();
      });
    }, settings.debounceMs);
  }

  function destroy() {
    save();
    if (timer) clearTimeout(timer);
    engines.delete(engineName);
  }

  hydrate();

  const engine = {
    name: engineName,
    memory,
    hydrate,
    save,
    read,
    remember,
    renderRow,
    renderRows,
    prefetch,
    destroy
  };

  engines.set(engineName, engine);
  return engine;
}

export function installSharedVirtualStyles() {
  if (document.getElementById("evaraSharedVirtualStyles")) return;

  const style = document.createElement("style");
  style.id = "evaraSharedVirtualStyles";
  style.textContent = `
    .virtual-paint-card,
    .shared-virtual-card {
      contain: layout paint style;
      content-visibility: auto;
      contain-intrinsic-size: 168px;
      backface-visibility: hidden;
      transform: translateZ(0);
      will-change: auto;
    }

    .shared-virtual-list {
      contain: layout paint;
    }

    @media (max-width: 760px) {
      .virtual-paint-card,
      .shared-virtual-card {
        contain-intrinsic-size: 220px;
      }
    }
  `;

  document.head.appendChild(style);
}

window.EvaraSharedVirtualization = {
  createVirtualizationEngine,
  installSharedVirtualStyles
};
