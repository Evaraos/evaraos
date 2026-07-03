const EVARAOS_MARK_PATH = '<path d="M4.2 20.5c2.1-2.3 4-4.3 5.8-6.1 2.4-2.4 4.9-4.7 7.5-6.9h3.4c.3 0 .5.4.3.6l-2 2.6c-.2.3-.5.4-.8.4h-4.2c-.8.7-1.6 1.4-2.3 2.1h6.7c.3 0 .5.4.3.6l-1.9 2.5c-.2.3-.5.4-.8.4H9.1c-1.3 1.4-2.7 2.9-4.2 4.6-.3.4-.8.1-.8-.3 0-.2 0-.4.1-.5Z"/><path d="M4.6 8.6c1.4-1.5 3-2.7 4.7-3.6h10.6c.3 0 .5.4.3.6l-1.9 2.5c-.2.3-.5.4-.8.4H4.6Z"/><path d="M4.8 12.6h11.5c.3 0 .5.4.3.6l-1.8 2.4c-.2.3-.5.4-.8.4H4.8Z"/>';

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
  login:'<path d="M10 5H5v14h5M13 8l4 4-4 4M8 12h9"/>',
  signup:'<circle cx="9" cy="8" r="3"/><path d="M3 20c.8-4 2.8-6 6-6M17 8v8M13 12h8"/>',
  logout:'<path d="M14 5h5v14h-5M11 8l-4 4 4 4M16 12H7"/>',
  company:'<path d="M4 21V5h10v16M14 9h6v12M7 8h4M7 12h4M7 16h4M17 12h1M17 16h1"/>',
  users:'<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c.8-4 2.9-6 6-6s5.2 2 6 6M14 15c3.2 0 5.3 1.7 6 5"/>',
  applications:'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  dispatch:'<path d="M3 6h12v10H3zM15 9h3l3 3v4h-6z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  field:'<path d="M12 21s7-5.1 7-12a7 7 0 1 0-14 0c0 6.9 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/>',
  schedule:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18"/>',
  map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/>',
  territory:'<path d="M12 21s7-5.1 7-12a7 7 0 1 0-14 0c0 6.9 7 12 7 12Z"/><path d="M9 9h6M12 6v6"/>',
  predictive:'<path d="M4 18 9 12l4 3 7-9"/><path d="M15 6h5v5"/>',
  ai:'<path d="M12 3 14 9l6 2-6 2-2 6-2-6-6-2 6-2 2-6Z"/>',
  analytics:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  revenue:'<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5c-.8-.8-2-1.2-3.4-1.2-1.9 0-3.1.9-3.1 2.2 0 3.4 7 1.7 7 5 0 1.4-1.4 2.4-3.5 2.4-1.5 0-2.9-.5-3.8-1.4M12 5v14"/>',
  payroll:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 9h18M7 14h4"/>',
  ledger:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>',
  payments:'<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M3 10h18M7 14h4"/>',
  history:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  account:'<circle cx="12" cy="8" r="4"/><path d="M4.5 21c1.6-4 4.1-6 7.5-6s5.9 2 7.5 6"/>',
  appearance:'<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18V3Z"/>',
  themeSystem:'<rect x="3" y="4" width="18" height="14" rx="2.5"/><path d="M8 21h8M12 18v3"/>',
  themeLight:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
  themeDark:'<path d="M20 15.2A8.5 8.5 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2Z"/>',
  themeImage:'<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9" r="1.5"/><path d="m5 18 4.5-4.5 3.2 3.2 2.3-2.3L19 18"/>',
  workspace:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 20v-4h8v4M3 10h18"/>',
  operations:'<path d="M4 7h10M4 12h16M4 17h7"/><circle cx="17" cy="7" r="2"/><circle cx="14" cy="17" r="2"/>',
  finance:'<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',
  customer:'<circle cx="12" cy="8" r="4"/><path d="M4.5 21c1.6-4 4.1-6 7.5-6s5.9 2 7.5 6"/>',
  system:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
  evaraos:EVARAOS_MARK_PATH,
  brand:EVARAOS_MARK_PATH,
  brandMark:EVARAOS_MARK_PATH,
  favicon:EVARAOS_MARK_PATH,
  fabricCoin:'<circle cx="12" cy="12" r="9"/><g transform="scale(.72) translate(4.65 4.15)">'+EVARAOS_MARK_PATH+'</g>',
  brandCoin:'<circle cx="12" cy="12" r="9"/><g transform="scale(.72) translate(4.65 4.15)">'+EVARAOS_MARK_PATH+'</g>',
  loading:'<circle cx="12" cy="12" r="9" opacity=".18"/><path d="M21 12a9 9 0 0 1-9 9"/><g transform="scale(.72) translate(4.65 4.15)">'+EVARAOS_MARK_PATH+'</g>'
});

const APP_ICON_MAP = Object.freeze({
  dashboard:"dashboard","customer-dashboard":"dashboard",organization:"company",companies:"company",users:"users",applications:"applications",jobs:"jobs",leads:"leads",dispatch:"dispatch",field:"field",schedule:"schedule","operations-map":"map","territory-intelligence":"territory","predictive-ops":"predictive","ai-command":"ai",analytics:"analytics",revenue:"revenue",payroll:"payroll",ledger:"ledger","payment-ops":"payments",messages:"messages","service-history":"history",settings:"settings","app-icons":"brandMark",icons:"brandMark",brand:"brandMark",loading:"loading",favicon:"favicon"
});

const CATEGORY_ICON_MAP = Object.freeze({operations:"operations",organizations:"company",finance:"finance",customer:"customer",intelligence:"analytics",system:"system",brand:"brandMark"});

export function iconSvg(name, className = "eva-icon") {
  const body = ICONS[name] || ICONS.dashboard;
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
}

export function iconNameForApp(id = "") { return APP_ICON_MAP[id] || "dashboard"; }
export function iconNameForCategory(category = "") { return CATEGORY_ICON_MAP[category] || "dashboard"; }
export function hasIcon(name) { return Object.prototype.hasOwnProperty.call(ICONS, name); }
export const ICON_NAMES = Object.freeze(Object.keys(ICONS));

window.EvaraIcons = { iconSvg, iconNameForApp, iconNameForCategory, hasIcon, names: ICON_NAMES };
