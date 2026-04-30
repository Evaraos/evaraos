const NOTIFICATION_ROOT_ID = "evaraToastRoot";

function ensureStyles() {
  if (document.getElementById("evaraToastStyles")) return;

  const style = document.createElement("style");
  style.id = "evaraToastStyles";
  style.textContent = `
    #${NOTIFICATION_ROOT_ID} {
      position: fixed;
      left: 50%;
      bottom: max(18px, env(safe-area-inset-bottom));
      z-index: 2147483000;
      width: min(92vw, 440px);
      display: grid;
      gap: 10px;
      transform: translateX(-50%);
      pointer-events: none;
    }

    .evara-toast {
      pointer-events: auto;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 12px;
      align-items: center;
      padding: 14px 16px;
      border-radius: 22px;
      background: rgba(255,255,255,0.82);
      border: 1px solid rgba(255,255,255,0.72);
      box-shadow: 0 18px 42px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.9);
      backdrop-filter: blur(24px) saturate(180%);
      -webkit-backdrop-filter: blur(24px) saturate(180%);
      color: #1c1c1e;
      font-family: inherit;
      animation: evaraToastIn 240ms ease both;
    }

    html[data-theme="dark"] .evara-toast,
    html[data-theme="galaxy"] .evara-toast,
    html[data-theme$="-dark"] .evara-toast {
      background: rgba(28,28,30,0.88);
      border-color: rgba(255,255,255,0.12);
      color: #f5f5f7;
      box-shadow: 0 18px 42px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.1);
    }

    .evara-toast strong {
      display: block;
      font-size: 0.94rem;
      line-height: 1.15;
      font-weight: 760;
      letter-spacing: -0.02em;
    }

    .evara-toast span {
      display: block;
      margin-top: 3px;
      font-size: 0.82rem;
      line-height: 1.25;
      color: rgba(60,60,67,0.68);
    }

    html[data-theme="dark"] .evara-toast span,
    html[data-theme="galaxy"] .evara-toast span,
    html[data-theme$="-dark"] .evara-toast span {
      color: rgba(235,235,245,0.62);
    }

    .evara-toast button {
      width: 30px;
      height: 30px;
      border: 0;
      border-radius: 999px;
      background: rgba(118,118,128,0.14);
      color: currentColor;
      font: inherit;
      cursor: pointer;
    }

    .evara-toast[data-tone="success"] { border-color: rgba(52,199,89,0.34); }
    .evara-toast[data-tone="warning"] { border-color: rgba(255,204,0,0.42); }
    .evara-toast[data-tone="error"] { border-color: rgba(255,59,48,0.38); }

    @keyframes evaraToastIn {
      from { opacity: 0; transform: translateY(12px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `;

  document.head.appendChild(style);
}

function ensureRoot() {
  ensureStyles();
  let root = document.getElementById(NOTIFICATION_ROOT_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = NOTIFICATION_ROOT_ID;
    root.setAttribute("aria-live", "polite");
    root.setAttribute("aria-label", "Evaraos notifications");
    document.body.appendChild(root);
  }
  return root;
}

export function notify({ title = "Evaraos", message = "", tone = "info", timeout = 4200 } = {}) {
  const root = ensureRoot();
  const toast = document.createElement("div");
  toast.className = "evara-toast";
  toast.dataset.tone = tone;
  toast.innerHTML = `
    <div>
      <strong>${String(title).replace(/</g, "&lt;")}</strong>
      <span>${String(message).replace(/</g, "&lt;")}</span>
    </div>
    <button type="button" aria-label="Dismiss notification">×</button>
  `;

  const close = () => toast.remove();
  toast.querySelector("button")?.addEventListener("click", close);
  root.appendChild(toast);

  if (timeout > 0) setTimeout(close, timeout);
  return toast;
}

window.EvaraNotify = notify;

window.addEventListener("evara:notify", (event) => {
  notify(event.detail || {});
});
