const ICONS = Object.freeze({
  home:'<path d="M3.5 10.5 12 3l8.5 7.5V21h-5.2v-6.1H8.7V21H3.5V10.5Z"/>',
  dashboard:'<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  leads:'<circle cx="12" cy="8" r="4"/><path d="M4.5 20c1.8-3.5 4.3-5.2 7.5-5.2S17.7 16.5 19.5 20"/>',
  jobs:'<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M8.5 6V4.8A1.8 1.8 0 0 1 10.3 3h3.4a1.8 1.8 0 0 1 1.8 1.8V6M3 11h18"/>',
  messages:'<path d="M4 5.5h16v11H9l-5 4v-15Z"/><path d="M8 10h8M8 13h5"/>',
  settings:'<circle cx="12" cy="12" r="3.2"/><path d="m19.4 15 1.2 2.1-2.1 2.1-2.1-1.2a8 8 0 0 1-2.3 1l-.6 2.3h-3l-.6-2.3a8 8 0 0 1-2.3-1l-2.1 1.2-2.1-2.1L4.6 15a8 8 0 0 1-1-2.3L1.3 12v-3l2.3-.6a8 8 0 0 1 1-2.3L3.4 4l2.1-2.1 2.1 1.2a8 8 0 0 1 2.3-1L10.5 0h3l.6 2.1a8 8 0 0 1 2.3 1L18.5 2l2.1 2.1-1.2 2.1a8 8 0 0 1 1 2.3l2.3.6v3l-2.3.6a8 8 0 0 1-1 2.3Z" transform="scale(.86) translate(2 2)"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  arrowRight:'<path d="M5 12h14M14 7l5 5-5 5"/>',
  arrowUp:'<path d="M12 19V5M7 10l5-5 5 5"/>',
  company:'<path d="M4 21V5h10v16M14 9h6v12M7 8h4M7 12h4M7 16h4M17 12h1M17 16h1"/>',
  users:'<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c.8-4 2.9-6 6-6s5.2 2 6 6M14 15c3.2 0 5.3 1.7 6 5"/>',
  applications:'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  dispatch:'<path d="M3 6h12v10H3zM15 9h3l3 3v4h-6z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  field:'<path d="M12 21s7-5.1 7-12a7 7 0 1 0-14 0c0 6.9 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/>',
  schedule:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18"/>',
  map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/>',
  ai:'<path d="M12 3 14 9l6 2-6 2-2 6-2-6-6-2 6-2 2-6Z"/>',
  analytics:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  revenue:'<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5c-.8-.8-2-1.2-3.4-1.2-1.9 0-3.1.9-3.1 2.2 0 3.4 7 1.7 7 5 0 1.4-1.4 2.4-3.5 2.4-1.5 0-2.9-.5-3.8-1.4M12 5v14"/>',
  payroll:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 9h18M7 14h4"/>',
  ledger:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>',
  history:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  account:'<circle cx="12" cy="8" r="4"/><path d="M4.5 21c1.6-4 4.1-6 7.5-6s5.9 2 7.5 6"/>',
  appearance:'<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18V3Z"/>',
  workspace:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 20v-4h8v4M3 10h18"/>'
});

export function iconSvg(name, className = "eva-icon") {
  const body = ICONS[name] || ICONS.dashboard;
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
}

export function hasIcon(name) { return Object.prototype.hasOwnProperty.call(ICONS, name); }
export const ICON_NAMES = Object.freeze(Object.keys(ICONS));

window.EvaraIcons = { iconSvg, hasIcon, names: ICON_NAMES };
