import { getMount, getBasePath, buildHref, getVisibleLinks, isCurrentPage } from "./nav-utils.js";
import { APP_CATEGORIES, appsByCategory } from "../navigation/app-registry.js";

const NAV_RENDER_BUILD = "nav-v5-connected";
const CATEGORY_ORDER = [APP_CATEGORIES.operations,APP_CATEGORIES.organizations,APP_CATEGORIES.finance,APP_CATEGORIES.customer,APP_CATEGORIES.intelligence,APP_CATEGORIES.system];
const CATEGORY_LABELS = {
  operations:{title:"Operations",icon:"⌁"},organizations:{title:"Organizations",icon:"⌂"},finance:{title:"Finance",icon:"◍"},customer:{title:"Customer",icon:"◌"},intelligence:{title:"Executive",icon:"✦"},system:{title:"System",icon:"◎"}
};

function clean(value=""){return String(value||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function activeAttrs(route=""){return isCurrentPage(route)?' aria-current="page" data-active="true"':""}
function normalizeRole(role="customer"){
  const value=String(role||"customer").toLowerCase();
  if(["owner","super_admin"].includes(value))return"owner";
  if(["admin","manager","operations_manager"].includes(value))return"admin";
  if(["organization","organization_owner","office_owner","branch_owner"].includes(value))return"organization";
  if(["vendor","lead_vendor","service_vendor","management_program"].includes(value))return"vendor";
  if(["hr","hr_manager"].includes(value))return"hr";
  if(["staff","sales","sales_rep","technician","cleaner","field_staff","crew_lead"].includes(value))return"staff";
  return"customer";
}

function quickLinks(){
  const items=[
    ["Home","index.html","⌂"],["Dashboard","dashboard.html","◫"],["Leads","leads.html","◎"],["Jobs","jobs.html","◇"],["Settings","settings.html","⚙"]
  ];
  return `<section class="eva-menu-top-block"><div class="eva-top-block-head"><span class="eva-top-block-icon">⌁</span><div><p>NAVIGATION</p><h3>Essential destinations</h3></div></div><div class="eva-quick-strip">${items.map(([label,page,icon])=>{const href=buildHref(page);return `<a href="${href}" data-menu-link="${href}"${activeAttrs(href)}><span>${icon}</span><strong>${label}</strong></a>`}).join("")}</div></section>`;
}

function accountLinks(authed){
  if(!authed){
    const items=[["Login","login.html","⇥"],["Signup","signup.html","＋"],["Apply","staff_application.html","◐"]];
    return `<section class="eva-menu-top-block"><div class="eva-top-block-head"><span class="eva-top-block-icon">◌</span><div><p>ACCESS</p><h3>Authentication and onboarding</h3></div></div><div class="eva-account-strip eva-access-strip">${items.map(([label,page,icon])=>{const href=buildHref(page);return `<a href="${href}" data-menu-link="${href}"><span>${icon}</span><strong>${label}</strong></a>`}).join("")}</div></section>`;
  }
  const items=[
    ["Account","settings/account.html","◉"],["Appearance","settings/appearance.html","◐"],["Alerts","notifications_center.html","◌"],["Workspace","settings/workspace.html","◈"]
  ];
  return `<section class="eva-menu-top-block"><div class="eva-top-block-head"><span class="eva-top-block-icon">◌</span><div><p>ACCOUNT</p><h3>Profile and preferences</h3></div></div><div class="eva-account-strip">${items.map(([label,page,icon])=>{const href=buildHref(page);return `<a href="${href}" data-menu-link="${href}"${activeAttrs(href)}><span>${icon}</span><strong>${label}</strong></a>`}).join("")}<a href="#logout" id="evaLogoutBtn" data-action="logout"><span>↗</span><strong>Logout</strong></a></div></section>`;
}

function appSections(role){
  const groups=appsByCategory(normalizeRole(role));
  return CATEGORY_ORDER.map((category)=>{
    const apps=groups[category]||[];
    if(!apps.length)return"";
    const meta=CATEGORY_LABELS[category]||{title:category,icon:"◈"};
    return `<section class="eva-app-section"><div class="eva-app-section-head"><span>${meta.icon}</span><strong>${clean(meta.title)}</strong><small>${apps.length}</small></div><div class="eva-app-list">${apps.map((app)=>{const href=buildHref(app.route);return `<a class="eva-app-link" href="${href}" data-menu-link="${href}"${activeAttrs(href)}><span>${clean(app.icon||"◈")}</span><strong>${clean(app.title)}</strong><small>›</small></a>`}).join("")}</div></section>`;
  }).join("");
}

function aiPrompt(authed){return `<div class="eva-menu-search-bottom"><div class="eva-ai-prompt-head"><span class="eva-ai-orb">AI</span><div><strong>Evaraos AI Command</strong><small>Search and open tools.</small></div></div><form class="eva-search-shell" id="evaAiPromptForm"><span class="eva-search-icon">✦</span><input id="evaSearchInput" type="search" placeholder="${authed?"Search apps or ask Evaraos AI...":"Search access and onboarding..."}"/><button class="eva-ai-send-btn" id="evaAiSendBtn" type="submit">Send</button></form><div id="evaSearchResults" class="eva-search-results" aria-live="polite"></div></div>`}

export function renderNav(){
  const mount=getMount();if(!mount)return false;
  const groups=getVisibleLinks();
  mount.innerHTML=`<div class="eva-nav-layer" data-render-build="${NAV_RENDER_BUILD}"><header class="eva-nav-shell" id="evaNavShell"><div class="eva-nav-pill glass-shell" id="evaNavPill"><div class="eva-brand" id="evaBrandBlock" data-home-link="${buildHref("index.html")}" tabindex="0"><img src="${getBasePath()}/assets/img/evaraos_logo.png" alt="Evaraos" class="eva-logo"/><div class="eva-brand-copy"><strong>Evaraos Inc</strong><span>Operating System</span></div></div><div class="eva-menu-zone" id="evaMenuZone"><button class="eva-nav-action-btn eva-menu-btn" type="button" id="evaMenuBtn" aria-expanded="false" aria-label="Open menu"><span class="eva-burger"><span class="eva-burger-line"></span><span class="eva-burger-line"></span><span class="eva-burger-line"></span></span></button></div></div></header><div class="eva-backdrop" id="evaBackdrop"></div><div class="eva-menu-panel" id="evaMenuPanel"><nav class="eva-menu-apps" id="evaLinks" data-nav-role="${clean(normalizeRole(groups.role))}">${quickLinks()}${accountLinks(groups.authed)}${groups.authed?appSections(groups.role):""}</nav>${aiPrompt(groups.authed)}</div></div>`;
  return true;
}
