#!/usr/bin/env node
/**
 * Evaraos architecture audit.
 *
 * Audit:
 *   node tools/repo-audit.js
 *
 * Safe HTML cleanup:
 *   node tools/repo-audit.js --fix
 *
 * The fix mode only removes deprecated theme loader tags, stale exact
 * first-paint backgrounds, and old cache versions. It never rewrites app logic.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const REPORT_DIR = path.join(ROOT, "tools", "reports");
const FIX_MODE = process.argv.includes("--fix");
const IGNORE = new Set([".git", "node_modules", "tools/reports"]);
const AUTHORIZED_THEME_WRITERS = new Set([
  "public/assets/js/theme.js",
  "public/assets/js/theme-boot.js"
]);

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

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function write(file, content) {
  fs.writeFileSync(path.join(ROOT, file), content, "utf8");
}

function exists(file) {
  return fs.existsSync(path.join(ROOT, file));
}

function safeHtmlFix(content) {
  return content
    .replace(/\s*<script\s+src="\/assets\/js\/theme-css-loader\.js\?v=[^"]+"><\/script>/gi, "")
    .replace(/<script\s+src="\/assets\/js\/theme-boot\.js\?v=[^"]+"><\/script>/gi, '<script src="/assets/js/theme-boot.js?v=50"></script>')
    .replace(/<script\s+type="module"\s+src="\/assets\/js\/theme\.js\?v=[^"]+"><\/script>/gi, '<script type="module" src="/assets/js/theme.js?v=50"></script>')
    .replace(/href="\/assets\/css\/theme\.css\?v=[^"]+"/gi, 'href="/assets/css/theme.css?v=50"')
    .replace(/href="\/assets\/css\/base\.css\?v=[^"]+"/gi, 'href="/assets/css/base.css?v=50"')
    .replace(/href="\/assets\/css\/nav\.css\?v=[^"]+"/gi, 'href="/assets/css/nav.css?v=nav-v4"')
    .replace(/\s*html\s*,\s*body\s*\{\s*background:\s*#f4f7f6;\s*\}/gi, "")
    .replace(/\s*html\[data-theme="dark"\]\s*,?\s*html\[data-theme="dark"\]\s+body\s*\{\s*background:\s*#020307;\s*\}/gi, "");
}

function addIssue(issues, file, rule, detail = "") {
  issues.push({ file, rule, detail });
}

function auditHtml(file, content, issues) {
  if (!/<!DOCTYPE html>/i.test(content)) addIssue(issues, file, "missing-doctype");
  if (!/\/assets\/js\/theme-boot\.js\?v=50/.test(content)) addIssue(issues, file, "stale-theme-boot");
  if (!/\/assets\/css\/theme\.css\?v=50/.test(content)) addIssue(issues, file, "stale-theme-css");
  if (!/\/assets\/css\/nav\.css\?v=(?:nav-v4|50)/.test(content)) addIssue(issues, file, "stale-nav-css");
  if (/theme-css-loader\.js/.test(content)) addIssue(issues, file, "deprecated-theme-loader");
  if (/html\s*,\s*body\s*\{\s*background:\s*#f4f7f6/i.test(content)) addIssue(issues, file, "inline-light-background");
  if (/html\[data-theme="dark"\][^\{]*\{\s*background:\s*#020307/i.test(content)) addIssue(issues, file, "inline-dark-background");
  if (/localStorage\.(?:getItem|setItem)\(["']evara-theme["']/.test(content)) addIssue(issues, file, "obsolete-theme-key");
}

function auditJavaScript(file, content, issues) {
  if (/setAttribute\(["']data-theme["']/.test(content) && !AUTHORIZED_THEME_WRITERS.has(file)) {
    addIssue(issues, file, "unauthorized-theme-writer");
  }
  if (/localStorage\.(?:getItem|setItem)\(["']evara-theme["']/.test(content)) {
    addIssue(issues, file, "obsolete-theme-key");
  }
  if (/VALID_MODES\s*=\s*\[[^\]]*light[^\]]*dark[^\]]*system[^\]]*\]/s.test(content) && !/image/.test(content)) {
    addIssue(issues, file, "three-mode-only-runtime");
  }
}

function auditCss(file, content, issues) {
  if (/application-polish\.css|nav-menu\.css|liquid-ui-overrides\.css/.test(content)) {
    addIssue(issues, file, "removed-stylesheet-import");
  }
  if (/,[\t ]*\n[\t ]*[a-z-]+\s*:/i.test(content)) addIssue(issues, file, "probable-missing-selector-brace");
  if (/html\[data-theme="(?:light|dark)"\]\s+body\s*\{[^}]*background\s*:/s.test(content) && file !== "public/assets/css/base/layout.css") {
    addIssue(issues, file, "duplicate-page-background-authority");
  }
}

function auditCore(issues) {
  const themeFile = "public/assets/js/theme.js";
  const bootFile = "public/assets/js/theme-boot.js";
  const appearancePage = "settings/appearance.html";

  for (const file of [themeFile, bootFile, appearancePage]) {
    if (!exists(file)) addIssue(issues, file, "missing-core-file");
  }

  if (exists(themeFile)) {
    const source = read(themeFile);
    for (const mode of ["light", "dark", "system", "image"]) {
      if (!source.includes(`"${mode}"`)) addIssue(issues, themeFile, `missing-mode-${mode}`);
    }
    if (!source.includes("imageUrl") || !source.includes("imageOverlay")) addIssue(issues, themeFile, "missing-image-appearance-model");
  }

  if (exists(appearancePage) && !/data-appearance-mode="image"/.test(read(appearancePage))) {
    addIssue(issues, appearancePage, "missing-image-mode-control");
  }
}

function main() {
  const files = walk(ROOT);
  const repaired = [];

  if (FIX_MODE) {
    for (const file of files.filter((name) => name.endsWith(".html"))) {
      const before = read(file);
      const after = safeHtmlFix(before);
      if (after !== before) {
        write(file, after);
        repaired.push(file);
      }
    }
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

  const grouped = issues.reduce((map, issue) => {
    if (!map[issue.file]) map[issue.file] = [];
    map[issue.file].push(issue);
    return map;
  }, {});

  const report = {
    generatedAt: new Date().toISOString(),
    mode: FIX_MODE ? "safe-fix-and-audit" : "audit",
    filesScanned: files.length,
    repairedFiles: repaired,
    issueCount: issues.length,
    issues
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, "repo-audit-report.json"), JSON.stringify(report, null, 2));

  const markdown = [
    "# Evaraos Four-Mode Architecture Audit",
    "",
    `Generated: ${report.generatedAt}`,
    `Files scanned: ${report.filesScanned}`,
    `Issues: ${report.issueCount}`,
    `Safely repaired: ${repaired.length}`,
    ""
  ];

  for (const [file, fileIssues] of Object.entries(grouped)) {
    markdown.push(`## ${file}`, "");
    for (const issue of fileIssues) markdown.push(`- [ ] ${issue.rule}${issue.detail ? ` — ${issue.detail}` : ""}`);
    markdown.push("");
  }

  if (!issues.length) markdown.push("All four-mode architecture checks passed.", "");
  fs.writeFileSync(path.join(REPORT_DIR, "repo-audit-report.md"), markdown.join("\n"));

  console.log(`Evaraos audit: ${issues.length} issue(s), ${repaired.length} safely repaired.`);
  if (issues.length) {
    for (const issue of issues) console.log(`- ${issue.file}: ${issue.rule}`);
    process.exitCode = 1;
  }
}

main();
