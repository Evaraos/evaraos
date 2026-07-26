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

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(absolute, files);
    else if (include.has(path.extname(entry.name))) files.push(absolute);
  }
  return files;
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

const navEntry = fs.readFileSync(path.join(publicRoot, "assets/js/nav.js"), "utf8");
if (!navEntry.includes("icon-hydrator.js")) failures.push("Universal nav entry does not load icon hydrator");
const themeEntry = fs.readFileSync(path.join(publicRoot, "assets/css/theme.css"), "utf8");
if (!themeEntry.includes("components/icons.css")) failures.push("Theme entry does not load icon styles");

console.log(`Icon audit scanned ${files.length} public source files.`);
console.log(`Legacy icon warnings: ${warnings.length}`);
for (const warning of warnings) console.log(`WARN ${warning}`);
for (const failure of failures) console.error(`FAIL ${failure}`);
if (failures.length) process.exit(1);
