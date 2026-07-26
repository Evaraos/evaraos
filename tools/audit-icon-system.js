#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const publicRoot = path.join(root, "public");
const include = new Set([".html", ".js", ".css"]);
const legacyGlyphs = ["⚙", "◈", "◉", "◎", "◌", "◍", "◐", "◒", "◇", "◷", "⬡", "⬢", "⬠", "✦", "✧", "◬", "◭", "▤", "◫", "✉", "◴", "⌁", "⌂", "⌕", "＋", "⇥", "↗"];
const allowedLegacyFiles = new Set([
  "public/assets/js/navigation/app-registry.js",
  "public/assets/js/ui/icon-hydrator.js"
]);

const BRAND_VERSION = "brand-contract-2";
const LOGO_PATH = "public/assets/img/evaraos_logo.png";
const ICON_PATH = "public/assets/brand/evaraos-app-icon.png";
const LOGO_URL = `/assets/img/evaraos_logo.png?v=${BRAND_VERSION}`;
const ICON_URL = `/assets/brand/evaraos-app-icon.png?v=${BRAND_VERSION}`;
const MANIFEST_URL = `/manifest.json?v=${BRAND_VERSION}`;

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(absolute, files);
    else if (include.has(path.extname(entry.name))) files.push(absolute);
  }
  return files;
}

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function assertPng(relative, label, failures) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) {
    failures.push(`Missing ${label}: ${relative}`);
    return;
  }
  const data = fs.readFileSync(absolute);
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (data.length < 1024) failures.push(`${label} is unexpectedly small: ${relative} (${data.length} bytes)`);
  if (!data.subarray(0, 8).equals(pngSignature)) failures.push(`${label} is not a decodable PNG payload: ${relative}`);
}

const failures = [];
const warnings = [];
const files = walk(publicRoot);
for (const file of files) {
  const relative = path.relative(root, file).replace(/\\/g, "/");
  const source = fs.readFileSync(file, "utf8");
  const glyphs = legacyGlyphs.filter((glyph) => source.includes(glyph));
  if (glyphs.length && !allowedLegacyFiles.has(relative)) warnings.push(`${relative}: legacy glyphs ${glyphs.join(" ")}`);
}

const required = [
  "public/assets/js/ui/icons.js",
  "public/assets/js/ui/icon-hydrator.js",
  "public/assets/css/components/icons.css"
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) failures.push(`Missing ${file}`);

const navEntry = read("public/assets/js/nav.js");
if (!navEntry.includes("icon-hydrator.js")) failures.push("Universal nav entry does not load icon hydrator");
const themeEntry = read("public/assets/css/theme.css");
if (!themeEntry.includes("components/icons.css")) failures.push("Theme entry does not load icon styles");

assertPng(LOGO_PATH, "OG brand logo", failures);
assertPng(ICON_PATH, "E app icon", failures);

const loader = read("public/assets/js/loader.js");
if (!loader.includes("const BRAND_VERSION='brand-contract-2'")) failures.push("Loader brand contract version is missing");
if (!loader.includes("const BRAND_LOGO_SRC='/assets/img/evaraos_logo.png?v='+BRAND_VERSION")) failures.push("Loader does not declare the canonical OG PNG logo");
if (!loader.includes("const BRAND_ICON_SRC='/assets/brand/evaraos-app-icon.png?v='+BRAND_VERSION")) failures.push("Loader does not declare the canonical E PNG icon");
if (!loader.includes("[data-evaraos-brand-logo],.sidebar-logo")) failures.push("Loader does not repair visible logo surfaces");
if (!loader.includes("[data-evaraos-brand-icon]")) failures.push("Loader does not repair icon surfaces");
if (!loader.includes("const MANIFEST_SRC='/manifest.json?v='+BRAND_VERSION")) failures.push("Loader does not version the canonical manifest");

const home = read("public/index.html");
if (!home.includes(`data-evaraos-brand-logo src="${LOGO_URL}"`)) failures.push("Homepage first paint does not use the OG PNG logo");
if (!home.includes(`rel="manifest" href="${MANIFEST_URL}"`)) failures.push("Homepage does not request the versioned manifest");

const iconStudio = read("public/assets/js/app-icon-studio-single-source.js");
if (!iconStudio.includes("const BRAND_VERSION = 'brand-contract-2'")) failures.push("App Icon Studio brand contract version is missing");
if (!iconStudio.includes("const OFFICIAL_ICON = '/assets/brand/evaraos-app-icon.png?v=' + BRAND_VERSION")) failures.push("App Icon Studio does not use the canonical E PNG icon");
if (/const\s+ICON\s*=\s*['"]data:image\//.test(iconStudio)) failures.push("App Icon Studio embeds a stale image as icon authority");
if (iconStudio.includes("evaraos-official-app-icon-v4") && !iconStudio.includes("LEGACY_KEYS")) failures.push("App Icon Studio still trusts the legacy official-icon key");

const iconGuard = read("public/assets/js/app-icon-studio-final-guard.js");
if (iconGuard.includes("findEmbeddedOfficialIcon")) failures.push("Icon guard still promotes embedded images to official state");
if (iconGuard.includes("new MutationObserver")) failures.push("Icon guard still runs a mutation-based overwrite loop");
if (iconGuard.includes("setTimeout(repair")) failures.push("Icon guard still runs timed overwrite repairs");

const preferenceRuntime = read("public/assets/js/app-icon-preferences.js");
if (preferenceRuntime.includes("URL.createObjectURL(new Blob")) failures.push("Legacy icon preferences still replace the manifest with a blob URL");
if (preferenceRuntime.includes("evaraos-app-icon-snapshot-v2") && !preferenceRuntime.includes("LEGACY_KEYS")) failures.push("Legacy icon preferences still trust the old snapshot key");

const manifest = JSON.parse(read("public/manifest.json"));
const manifestIcons = [
  ...(manifest.icons || []),
  ...(manifest.shortcuts || []).flatMap(shortcut => shortcut.icons || [])
];
if (!manifestIcons.length) failures.push("Manifest has no app icons");
for (const icon of manifestIcons) {
  if (icon.src !== ICON_URL) failures.push(`Manifest icon is not canonical: ${icon.src || "missing src"}`);
}

const iconPage = read("public/settings/icons.html");
if (!iconPage.includes(ICON_URL)) failures.push("App Icon Studio HTML does not reference the canonical E icon");
if (iconPage.includes("/assets/img/icon-512.png?v=brand-logo-1")) failures.push("App Icon Studio HTML still references the consolidated legacy icon");

console.log(`Icon audit scanned ${files.length} public source files.`);
console.log(`Brand contract: logo=${LOGO_PATH}, icon=${ICON_PATH}, version=${BRAND_VERSION}`);
console.log(`Legacy icon warnings: ${warnings.length}`);
for (const warning of warnings) console.log(`WARN ${warning}`);
for (const failure of failures) console.error(`FAIL ${failure}`);
if (failures.length) process.exit(1);
