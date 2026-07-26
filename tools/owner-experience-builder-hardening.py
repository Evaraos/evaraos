from pathlib import Path
import re


def write(path, text):
    Path(path).write_text(text)


def replace_once(text, old, new, label):
    if new in text:
        print(f"SKIP already applied: {label}")
        return text
    if old not in text:
        raise SystemExit(f"Missing source contract: {label}")
    print(f"APPLY: {label}")
    return text.replace(old, new, 1)


# Trusted publisher authority.
path = "functions/experience-config-service.js"
text = Path(path).read_text()
text = replace_once(
    text,
    "const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');\n",
    "const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');\nconst { normalizeRole, isActiveProfile, canPublishStudio } = require('./studio-journal-core');\n",
    "trusted Studio authority import",
)
text = re.sub(
    r"\nfunction accountIsActive\(profile = \{\}\) \{.*?\n\}\n\nasync function resolveOwner",
    "\nasync function resolveOwner",
    text,
    count=1,
    flags=re.S,
)
text = replace_once(
    text,
    "  const role = cleanText(profile.role, 80).toLowerCase().replace(/[\\s-]+/g, '_');\n  const elevatedAdmin = role === 'admin' && profile.platformAccess === true;\n  if (!accountIsActive(profile) || !['owner', 'super_admin', 'platform_admin'].includes(role) && !elevatedAdmin) {\n",
    "  const role = normalizeRole(profile.role);\n  if (!isActiveProfile(profile) || !canPublishStudio(profile)) {\n",
    "trusted publisher enforcement",
)
write(path, text)

# Stable editor typing.
path = "public/assets/js/studio/studio-experience-builder.js"
text = Path(path).read_text()
text = replace_once(
    text,
    "    setPath(draft, path, value);\n    draft = normalizeExperienceConfig(draft);\n    window.EvaraExperience?.applyConfig?.(draft);\n    render();\n",
    "    setPath(draft, path, value);\n    draft = normalizeExperienceConfig(draft);\n    const normalized = getPath(draft, path);\n    shell.querySelectorAll('[data-experience-field]').forEach((peer) => {\n      if (peer === control || peer.dataset.experienceField !== path) return;\n      if (peer.type === 'checkbox') peer.checked = Boolean(normalized);\n      else peer.value = control.dataset.transform === 'seconds' ? String(Math.round(Number(normalized || 45000) / 1000)) : String(normalized ?? '');\n    });\n    window.EvaraExperience?.applyConfig?.(draft);\n    const preview = shell.querySelector('.experience-builder-preview');\n    if (preview) preview.replaceWith(renderPreview());\n",
    "stable editor typing",
)
write(path, text)

# Early cached runtime.
path = "public/assets/js/nav.js"
text = Path(path).read_text()
text = replace_once(
    text,
    'window.addEventListener("evara:nav-ready", onNavReady, { once: true });\n',
    'loadExperienceRuntime();\nwindow.addEventListener("evara:nav-ready", onNavReady, { once: true });\n',
    "early experience runtime",
)
write(path, text)

# Global brand propagation and idle refresh.
path = "public/assets/js/experience/experience-runtime.js"
text = Path(path).read_text()
text = replace_once(
    text,
    "function applyLoaderConfig(config) {\n  const welcome = config.loaders.welcome;\n  const page = config.loaders.page;\n",
    "function applyLoaderConfig(config) {\n  const welcome = config.loaders.welcome;\n  const page = config.loaders.page;\n  const markUrl = safeAssetUrl(config.brand.markUrl, DEFAULT_CONFIG.brand.markUrl);\n  const appIconUrl = safeAssetUrl(config.brand.appIconUrl, DEFAULT_CONFIG.brand.appIconUrl);\n  document.documentElement.style.setProperty('--evaraos-brand-icon', `url(\"${markUrl.replaceAll('\\\"', '%22')}\")`);\n  document.querySelectorAll('[data-evaraos-brand-icon]').forEach((node) => {\n    node.style.backgroundImage = `url(\"${markUrl.replaceAll('\\\"', '%22')}\")`;\n    node.style.backgroundSize = 'contain';\n    node.style.backgroundPosition = 'center';\n    node.style.backgroundRepeat = 'no-repeat';\n  });\n  document.querySelectorAll('link[rel=\"icon\"],link[rel=\"shortcut icon\"],link[rel=\"apple-touch-icon\"]').forEach((link) => { link.href = appIconUrl; });\n  window.EvaraLoader?.applyExperienceConfig?.(config);\n",
    "global brand propagation",
)
text = replace_once(
    text,
    "  refreshExperienceConfig().catch((error) => console.warn('Published experience refresh skipped:', error));\n",
    "  const refresh = () => refreshExperienceConfig().catch((error) => console.warn('Published experience refresh skipped:', error));\n  if ('requestIdleCallback' in window) requestIdleCallback(refresh, { timeout: 1600 });\n  else setTimeout(refresh, 180);\n",
    "idle public config refresh",
)
write(path, text)

# Loader adapter.
path = "public/assets/js/loader.js"
text = Path(path).read_text()
for old, new, label in [
    ("  const LONG_RESUME_MS=45000;", "  let LONG_RESUME_MS=45000;", "editable resume threshold"),
    ("  const WELCOME_MIN_MS=1200;", "  let WELCOME_MIN_MS=1200;", "editable welcome duration"),
    ("  const BRAND_MARK_SRC='/assets/brand/evaraos-mark.png?v=brand-png-3';", "  let BRAND_MARK_SRC='/assets/brand/evaraos-mark.png?v=brand-png-3';", "editable visible logo"),
    ("  const APP_ICON_SRC='/assets/brand/evaraos-app-icon.png?v=brand-png-1';", "  let APP_ICON_SRC='/assets/brand/evaraos-app-icon.png?v=brand-png-1';", "editable app icon"),
]:
    text = replace_once(text, old, new, label)

anchor = '  let launchMode=document.documentElement.dataset.evaraLaunchMode||"";\n'
insert = '''  let launchMode=document.documentElement.dataset.evaraLaunchMode||"";
  let welcomeEnabled=true,pageEnabled=true,resumeEnabled=true;
  let welcomeTitle='Welcome to Evaraos',welcomeSubtitle='Preparing your operating system.';
  let pageLabel='Loading EvaraOS',resumeTitle='Welcome back to Evaraos',resumeSubtitle='Refreshing your workspace.';

  function safeExperienceAsset(value,fallback){
    const candidate=String(value||'').trim();
    if(candidate.startsWith('/assets/'))return candidate;
    try{const url=new URL(candidate,location.origin);return url.protocol==='https:'||url.origin===location.origin?url.href:fallback}catch{return fallback}
  }

  function cachedExperience(){
    try{const stored=JSON.parse(localStorage.getItem('evaraos-experience-config-v1')||'null');return stored?.config||stored||null}catch{return null}
  }

  function applyExperienceConfig(config={}){
    const brand=config.brand||{},theme=config.loaderTheme||{},loaders=config.loaders||{};
    const welcome=loaders.welcome||{},page=loaders.page||{},resume=loaders.resume||{};
    BRAND_MARK_SRC=safeExperienceAsset(brand.markUrl,BRAND_MARK_SRC);
    APP_ICON_SRC=safeExperienceAsset(brand.appIconUrl,APP_ICON_SRC);
    welcomeEnabled=welcome.enabled!==false;pageEnabled=page.enabled!==false;resumeEnabled=resume.enabled!==false;
    welcomeTitle=welcome.title===undefined?welcomeTitle:String(welcome.title);
    welcomeSubtitle=welcome.subtitle===undefined?welcomeSubtitle:String(welcome.subtitle);
    pageLabel=page.label===undefined?pageLabel:String(page.label);
    resumeTitle=resume.title===undefined?resumeTitle:String(resume.title);
    resumeSubtitle=resume.subtitle===undefined?resumeSubtitle:String(resume.subtitle);
    WELCOME_MIN_MS=Math.min(5000,Math.max(400,Number(welcome.minimumMs)||WELCOME_MIN_MS));
    LONG_RESUME_MS=Math.min(600000,Math.max(10000,Number(resume.minimumAwayMs)||LONG_RESUME_MS));
    document.documentElement.style.setProperty('--evara-loader-background',/^#[0-9a-f]{6}$/i.test(theme.background||'')?theme.background:'#eef5fb');
    document.documentElement.style.setProperty('--evara-loader-radius',`${Math.min(52,Math.max(16,Number(theme.radius)||34))}px`);
    document.documentElement.style.setProperty('--evara-loader-mark-size',`${Math.min(96,Math.max(24,Number(theme.markSize)||42))}px`);
    const node=document.getElementById(WELCOME_ID);
    const title=node?.querySelector('[data-evara-welcome-title]');
    const subtitle=node?.querySelector('[data-evara-welcome-subtitle]');
    const progress=node?.querySelector('.evara-welcome-progress');
    if(title)title.textContent=welcomeTitle;if(subtitle)subtitle.textContent=welcomeSubtitle;
    if(progress)progress.hidden=theme.showProgress===false;
    document.querySelectorAll('#evaraFastLoader [role="status"]').forEach(item=>item.setAttribute('aria-label',pageLabel));
    applyBrand();
    if(window.EvaraBrand){window.EvaraBrand.mark=BRAND_MARK_SRC;window.EvaraBrand.appIcon=APP_ICON_SRC}
    if(!welcomeEnabled)deactivate(node,true);
    if(!pageEnabled)deactivate(document.getElementById(FAST_ID),true);
  }
'''
text = replace_once(text, anchor, insert, "loader experience adapter")
text = replace_once(text, "  function showFastLoader(){\n    ensure();", "  function showFastLoader(){\n    if(!pageEnabled)return;\n    ensure();", "page loader enable switch")
text = replace_once(text, "  function showWelcomeLoader(options={}){\n    ensure();", "  function showWelcomeLoader(options={}){\n    if(!welcomeEnabled)return;\n    ensure();", "welcome loader enable switch")
text = replace_once(text, "    if(title)title.textContent=options.title||'Welcome to Evaraos';\n    if(subtitle)subtitle.textContent=options.subtitle||'Preparing your operating system.';", "    if(title)title.textContent=options.title??welcomeTitle;\n    if(subtitle)subtitle.textContent=options.subtitle??welcomeSubtitle;", "published loader copy")
text = replace_once(text, "    if(!hiddenAt||Date.now()-hiddenAt<LONG_RESUME_MS||isTransitioning)return;", "    if(!resumeEnabled||!hiddenAt||Date.now()-hiddenAt<LONG_RESUME_MS||isTransitioning)return;", "resume loader enable switch")
text = replace_once(text, "    showWelcomeLoader({title:'Welcome back to Evaraos',subtitle:'Refreshing your workspace.'});", "    showWelcomeLoader({title:resumeTitle,subtitle:resumeSubtitle});", "published resume copy")
text = replace_once(text, "  function init(){\n    ensureCriticalStyles();", "  function init(){\n    applyExperienceConfig(cachedExperience()||{});\n    ensureCriticalStyles();", "cached loader boot")
text = replace_once(text, "      health\n    };", "      health,\n      applyExperienceConfig\n    };", "loader public config API")
text = replace_once(text, "    addEventListener('evara:session-ready',markSessionReady);", "    addEventListener('evara:session-ready',markSessionReady);\n    addEventListener('evara:experience-config',event=>applyExperienceConfig(event.detail?.config||{}));", "published config event")
write(path, text)
