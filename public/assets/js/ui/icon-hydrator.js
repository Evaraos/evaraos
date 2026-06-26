import { iconSvg, hasIcon } from "./icons.js";

const LEGACY_MAP = Object.freeze({
  "⌂":"home","◫":"dashboard","◎":"leads","◇":"jobs","⚙":"settings","✉":"messages","◉":"account","◐":"appearance","◌":"bell","◈":"workspace","⌁":"operations","◍":"finance","✦":"ai","✧":"ai","◷":"schedule","⬢":"map","⬠":"territory","⬡":"field","◬":"analytics","◭":"payroll","▤":"ledger","◴":"history","$":"revenue","＋":"signup","⇥":"login","↗":"logout","⌕":"search","↑":"arrowUp","›":"arrowRight","×":"close"
});

const TARGETS = [
  ".settings-card-icon",
  ".settings-preview-menu",
  ".appearance-source-icon",
  ".dashboard-control-tile > span:first-child",
  ".eva-app-launcher-icon",
  ".eva-app-search-result > span:first-child"
].join(",");

function inferFromText(node) {
  const text = String(node.textContent || "").trim();
  if (LEGACY_MAP[text]) return LEGACY_MAP[text];
  const explicit = node.getAttribute("data-evara-icon");
  if (explicit && hasIcon(explicit)) return explicit;
  const copy = String(node.closest("a,button,article,section")?.textContent || "").toLowerCase();
  const pairs = [
    ["appearance","appearance"],["profile","account"],["account","account"],["notification","bell"],["workspace","workspace"],["message","messages"],["setting","settings"],["dashboard","dashboard"],["lead","leads"],["job","jobs"],["schedule","schedule"],["map","map"],["analytics","analytics"],["revenue","revenue"],["payroll","payroll"],["history","history"],["application","applications"],["user","users"],["company","company"]
  ];
  return pairs.find(([word]) => copy.includes(word))?.[1] || "";
}

function hydrateNode(node) {
  if (!(node instanceof Element) || node.dataset.evaraIconHydrated === "true") return;
  const name = inferFromText(node);
  if (!name) return;
  node.innerHTML = iconSvg(name);
  node.dataset.evaraIconHydrated = "true";
}

export function hydrateIcons(root = document) {
  root.querySelectorAll?.("[data-evara-icon]," + TARGETS).forEach(hydrateNode);
}

function start() {
  hydrateIcons();
  const observer = new MutationObserver((records) => {
    records.forEach((record) => record.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      if (node.matches?.("[data-evara-icon]," + TARGETS)) hydrateNode(node);
      hydrateIcons(node);
    }));
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
