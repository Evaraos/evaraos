#!/usr/bin/env node
/**
 * Evaraos universal appearance audit and safe migration.
 *
 * Audit:
 *   node tools/repo-audit.js
 *
 * Fix all HTML cache keys and remove obsolete appearance shims:
 *   node tools/repo-audit.js --fix
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const REPORT_DIR = path.join(ROOT, "tools", "reports");
const FIX_MODE = process.argv.includes("--fix");
const IGNORE = new Set([".git", "node_modules", "tools/reports"]);
const THEME_BOOT_VERSION = "55";
const THEME_RUNTIME_VERSION = "ios27-liquid-v3";
const THEME_CSS_VERSION = "ios27-liquid-v3";
const BASE_CSS_VERSION = "53";
const AUTHORIZED_THEME_WRITERS = new Set([
  "public/assets/js/theme.js",
  "public/assets/js/theme-boot.js"
]);
const OBSOLETE_FILES = [
  "public/assets/js/appearance-mode-fix.js",
  "public/assets/js/theme-css-loader.js",
  "public/assets/css/pages/appearance-fix.css",
  "public/assets/css/components/application-polish.css",
  "public/assets/css/effects/liquid-ui-overrides.css",
  "public/assets/css/components/apple-settings-glass.css",
  "public/assets/css/effects/apple-settings-background.css"
];

function walk(directory, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(ROOT, absolute).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      if (IGNORE.has(entry.name) || IGNORE.has(relative)) continue;
      walk(absolute, output);
    } else {
      output.push(relative);
    }
  }
  return output;
}

function absolute(file) { return path.join(ROOT, file); }
function read(file) { return fs.readFileSync(absolute(file), "utf8"); }
function write(file, content) { fs.writeFileSync(absolute(file), content, "utf8"); }
function exists(file) { return fs.existsSync(absolute(file)); }

function safeHtmlFix(content) {
  return content
    .replace(/\s*<script\s+[^>]*src=["']\/assets\/js\/theme-css-loader\.js(?:\?[^"']*)?["'][^>]*><\/script>/gi, "")
    .replace(/\s*<script\s+[^>]*src=["']\/assets\/js\/appearance-mode-fix\.js(?:\?[^"']*)?["'][^>]*><\/script>/gi, "")
    .replace(/\s*<link\s+[^>]*href=["']\/assets\/css\/pages\/appearance-fix\.css(?:\?[^"']*)?["'][^>]*>/gi, "")
    .replace(/<script\s+src=["']\/assets\/js\/theme-boot\.js\?v=[^"']+["']><\/script>/gi, `<script src="/assets/js/theme-boot.js?v=${THEME_BOOT_VERSION}"></script>`)
    .replace(/<script\s+type=["']module["']\s+src=["']\/assets\/js\/theme\.js\?v=[^"']+["']><\/script>/gi, `<script type="module" src="/assets/js/theme.js?v=${THEME_RUNTIME_VERSION}"></script>`)
    .replace(/href=["']\/assets\/css\/theme\.css\?v=[^"']+["']/gi, `href="/assets/css/theme.css?v=${THEME_CSS_VERSION}"`)
    .replace(/href=["']\/assets\/css\/base\.css\?v=[^"']+["']/gi, `href="/assets/css/base.css?v=${BASE_CSS_VERSION}"`)
    .replace(/\s*html\s*,\s*body\s*\{\s*background:\s*#f4f7f6;\s*\}/gi, "")
    .replace(/\s*html\[data-theme=["']dark["']\]\s*,?\s*html\[data-theme=["']dark["']\]\s+body\s*\{\s*background:\s*#020307;\s*\}/gi, "");
}

function addIssue(issues, file, rule, detail = "") {
  issues.push({ file, rule, detail });
}

function count(content, pattern) { return (content.match(pattern) || []).length; }

function auditHtml(file, content, issues) {
  if (!/<!DOCTYPE html>/i.test(content)) addIssue(issues, file, "missing-doctype");
  if (/theme-css-loader\.js/.test(content)) addIssue(issues, file, "deprecated-theme-loader");
  if (/appearance-mode-fix\.js/.test(content)) addIssue(issues, file, "obsolete-appearance-interceptor");
  if (/appearance-fix\.css/.test(content)) addIssue(issues, file, "obsolete-appearance-override");
  if (/localStorage\.(?:getItem|setItem)\(["']evara-theme["']/.test(content)) addIssue(issues, file, "obsolete-theme-key");

  const boot = count(content, /\/assets\/js\/theme-boot\.js\?v=[^"']+/g);
  const css = count(content, /\/assets\/css\/theme\.css\?v=[^"']+/g);
  const runtime = count(content, /\/assets\/js\/theme\.js\?v=[^"']+/g);
  if (boot && !new RegExp(`/assets/js/theme-boot\\.js\\?v=${THEME_BOOT_VERSION}`).test(content)) addIssue(issues, file, "stale-theme-boot");
  if (css && !new RegExp(`/assets/css/theme\\.css\\?v=${THEME_CSS_VERSION}`).test(content)) addIssue(issues, file, "stale-theme-css");
  if (runtime && !new RegExp(`/assets/js/theme\\.js\\?v=${THEME_RUNTIME_VERSION}`).test(content)) addIssue(issues, file, "stale-theme-runtime");
}

function auditJavaScript(file, content, issues) {
  if (/setAttribute\(["']data-theme["']/.test(content) && !AUTHORIZED_THEME_WRITERS.has(file)) addIssue(issues, file, "unauthorized-theme-writer");
  if (/localStorage\.(?:getItem|setItem)\(["']evara-theme["']/.test(content)) addIssue(issues, file, "obsolete-theme-key");
}

function auditCss(file, content, issues) {
  if (/application-polish\.css|liquid-ui-overrides\.css|apple-settings-glass\.css|apple-settings-background\.css/.test(content)) addIssue(issues, file, "obsolete-stylesheet-reference");
  if (/html\[data-theme=["'](?:light|dark)["']\]\s+body\s*\{[^}]*background\s*:/s.test(content) && file !== "public/assets/css/theme.css") addIssue(issues, file, "duplicate-page-background-authority");
}

function auditCore(issues) {
  const core = [
    "public/assets/js/theme.js",
    "public/assets/js/theme-boot.js",
    "public/assets/css/theme.css",
    "public/settings/appearance.html",
    "public/assets/js/settings-appearance-v2.js"
  ];
  for (const file of core) if (!exists(file)) addIssue(issues, file, "missing-core-file");

  if (exists("public/assets/js/theme.js")) {
    const source = read("public/assets/js/theme.js");
    for (const mode of ["light", "dark", "system", "image"]) if (!source.includes(`"${mode}"`)) addIssue(issues, "public/assets/js/theme.js", `missing-mode-${mode}`);
    for (const feature of ["setThemeMode", "data:image", "--evara-glass-density", "ensureSingleThemeLink"]) if (!source.includes(feature)) addIssue(issues, "public/assets/js/theme.js", "missing-universal-runtime-feature", feature);
  }

  if (exists("public/assets/css/theme.css")) {
    const source = read("public/assets/css/theme.css");
    for (const token of ["--material-base", "--material-specular", "--material-refraction", "backdrop-filter", "[class$=\"-card\"]"]) if (!source.includes(token)) addIssue(issues, "public/assets/css/theme.css", "missing-liquid-glass-feature", token);
  }

  for (const file of OBSOLETE_FILES) if (exists(file)) addIssue(issues, file, "obsolete-file-present");
}

function main() {
  let files = walk(ROOT);
  const repaired = [];
  const removed = [];

  if (FIX_MODE) {
    for (const file of files.filter(name => name.endsWith(".html"))) {
      const before = read(file);
      const after = safeHtmlFix(before);
      if (after !== before) {
        write(file, after);
        repaired.push(file);
      }
    }
    for (const file of OBSOLETE_FILES) {
      if (!exists(file)) continue;
      fs.rmSync(absolute(file));
      removed.push(file);
    }
    files = walk(ROOT);
  }

  const issues = [];
  for (const file of files) {
    if (!/\.(?:html|js|css)$/.test(file)) continue;
    const content = read(file);
    if (file.endsWith(".html")) auditHtml(file, content, issues);
    if (file.endsWith(".js")) auditJavaScript(file, content, issues);
    if (file.endsWith(".css")) auditCss(file, content, issues);
  }
  auditCore(issues);

  const report = {
    generatedAt: new Date().toISOString(),
    mode: FIX_MODE ? "safe-fix-and-audit" : "audit",
    filesScanned: files.length,
    repairedFiles: repaired,
    removedFiles: removed,
    issueCount: issues.length,
    issues
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, "repo-audit-report.json"), JSON.stringify(report, null, 2));
  const markdown = [
    "# Evaraos Universal Liquid Glass Audit",
    "",
    `Generated: ${report.generatedAt}`,
    `Files scanned: ${report.filesScanned}`,
    `Issues: ${report.issueCount}`,
    `HTML repaired: ${repaired.length}`,
    `Obsolete files removed: ${removed.length}`,
    ""
  ];
  for (const issue of issues) markdown.push(`- [ ] ${issue.file}: ${issue.rule}${issue.detail ? ` — ${issue.detail}` : ""}`);
  if (!issues.length) markdown.push("All universal four-mode appearance checks passed.");
  fs.writeFileSync(path.join(REPORT_DIR, "repo-audit-report.md"), markdown.join("\n"));

  console.log(`Evaraos audit: ${issues.length} issue(s), ${repaired.length} HTML file(s) repaired, ${removed.length} obsolete file(s) removed.`);
  if (issues.length) process.exitCode = 1;
}

main();
