/**
 * Evaraos Repo Audit + Repair Script
 * Modernized for Firebase public/ deployment structure.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const REPORT_DIR = path.join(ROOT, "tools", "reports");
const FIX_MODE = process.argv.includes("--fix");

const IGNORE_DIRS = new Set([".git", "node_modules", "tools/reports"]);
const HTML_REPAIR_FILES = [];
const NAV_CONFIG_PATH = "public/assets/js/nav/nav-config.js";
const APP_REGISTRY_PATH = "public/assets/js/navigation/app-registry.js";

function walk(dir, output = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    const relative = path.relative(ROOT, absolute).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(relative) || IGNORE_DIRS.has(entry.name)) continue;
      walk(absolute, output);
      continue;
    }

    output.push(relative);
  }

  return output;
}

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), "utf8");
}

function write(relative, content) {
  fs.writeFileSync(path.join(ROOT, relative), content, "utf8");
}

function exists(relative) {
  return fs.existsSync(path.join(ROOT, relative));
}

function repairHtml(relative, content) {
  let next = content;
  next = next.replace(/overflow-x:\s*hidden;/gi, "overflow-x: clip;");

  if (!/id="universalNavRoot"/.test(next) && /<body/i.test(next)) {
    next = next.replace(/<body([^>]*)>/i, '<body$1>\n<div id="universalNavRoot"></div>');
  }

  if (next !== content) HTML_REPAIR_FILES.push(relative);
  return next;
}

function checkHtml(relative, content) {
  const checks = [];

  checks.push({ label: "DOCTYPE present", pass: /<!DOCTYPE html>/i.test(content) });
  checks.push({ label: "universal nav mount present", pass: /id="universalNavRoot"/.test(content) });
  checks.push({ label: "route guard awareness", pass: /data-route-guard|routeGuard|auth-pending/.test(content) });
  checks.push({ label: "loader awareness", pass: /loader.js|EvaraLoader/.test(content) });
  checks.push({ label: "overflow-x protection", pass: /overflow-x:\s*(hidden|clip)/i.test(content) });
  checks.push({ label: "safe viewport usage", pass: /svh|dvh|min-height:\s*100vh/i.test(content) });
  checks.push({ label: "design-system CSS linked", pass: /assets\/css\/(theme|base|dashboard|mobile-polish|components\/glass|components\/liquid-glass)/.test(content) });
  checks.push({ label: "mobile responsiveness signal", pass: /@media|mobile-polish|viewport|safe-area-inset|svh|dvh/i.test(content) });
  checks.push({ label: "glass/card UI signal", pass: /glass|card|panel|backdrop-filter|box-shadow|border-radius/i.test(content) });

  return checks;
}

function checkCss(relative, content) {
  const checks = [];

  checks.push({ label: "uses spacing or layout scale", pass: /gap:|padding:|margin:|--space|--page|--layout/i.test(content) });
  checks.push({ label: "uses radius/card polish", pass: /border-radius|--radius|card|panel/i.test(content) });
  checks.push({ label: "uses shadow or elevation", pass: /box-shadow|--shadow|elevation/i.test(content) });
  checks.push({ label: "has mobile media coverage", pass: /@media\s*\([^)]*max-width|@media\s*\([^)]*width\s*<=/i.test(content) });
  checks.push({ label: "prevents horizontal overflow", pass: /overflow-x:\s*(hidden|clip)|max-width:\s*100%/i.test(content) });
  checks.push({ label: "supports theme variables", pass: /data-theme|\.dark|--text|--surface|--bg|color-scheme/i.test(content) });

  return checks;
}

function detectDuplicatePages(files) {
  const duplicateGroups = [];
  const rootHtml = files.filter((f) => f.endsWith(".html") && !f.startsWith("public/") && !f.startsWith("tools/"));

  for (const file of rootHtml) {
    const basename = path.basename(file);
    const publicVersion = `public/${basename}`;

    if (files.includes(publicVersion)) {
      duplicateGroups.push({ root: file, deployed: publicVersion, recommendation: "review-root-copy-for-removal" });
    }
  }

  return duplicateGroups;
}

function extractQuotedPages(content = "") {
  const pages = new Set();
  const patterns = [
    /page:\s*["']([^"']+\.html)["']/g,
    /route:\s*["']\/?([^"']+\.html)["']/g,
    /href=["']\/?([^"'#?]+\.html)/g
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content))) pages.add(match[1].replace(/^\//, ""));
  }

  return [...pages].sort();
}

function collectRouteReferences() {
  const sources = [NAV_CONFIG_PATH, APP_REGISTRY_PATH].filter(exists);

  const bySource = {};
  const all = new Set();

  for (const source of sources) {
    const pages = extractQuotedPages(read(source));
    bySource[source] = pages;
    pages.forEach((page) => all.add(page));
  }

  return { bySource, allRoutes: [...all].sort() };
}

function compareNavAndRegistry(routeReferences, files) {
  const navRoutes = new Set(routeReferences.bySource[NAV_CONFIG_PATH] || []);
  const registryRoutes = new Set(routeReferences.bySource[APP_REGISTRY_PATH] || []);

  const navOnly = [...navRoutes]
    .filter((route) => !registryRoutes.has(route))
    .map((route) => ({ route, exists: files.includes(`public/${route}`), recommendation: "add-to-app-registry-or-mark-nav-only" }));

  const registryOnly = [...registryRoutes]
    .filter((route) => !navRoutes.has(route))
    .map((route) => ({ route, exists: files.includes(`public/${route}`), recommendation: "add-to-nav-or-mark-command-search-only" }));

  const shared = [...navRoutes].filter((route) => registryRoutes.has(route)).sort();

  return {
    sourceOfTruthRecommendation: "Use app-registry.js as the long-term single source of truth, then generate nav views from it.",
    navRouteCount: navRoutes.size,
    registryRouteCount: registryRoutes.size,
    sharedRouteCount: shared.length,
    shared,
    navOnly,
    registryOnly
  };
}

function classifyHtmlPages(files, routeReferences) {
  const active = new Set(routeReferences.allRoutes.map((page) => `public/${page}`));
  const publicHtml = files.filter((f) => f.startsWith("public/") && f.endsWith(".html"));
  const rootHtml = files.filter((f) => f.endsWith(".html") && !f.startsWith("public/") && !f.startsWith("tools/"));

  const missingReferencedRoutes = routeReferences.allRoutes
    .map((page) => `public/${page}`)
    .filter((file) => !files.includes(file));

  const unreferencedPublicHtml = publicHtml
    .filter((file) => !active.has(file))
    .map((file) => ({ file, recommendation: "review-before-removal-or-add-to-nav-registry" }));

  const rootOnlyHtml = rootHtml
    .filter((file) => !files.includes(`public/${path.basename(file)}`))
    .map((file) => ({ file, recommendation: "legacy-or-tooling-review" }));

  return { missingReferencedRoutes, unreferencedPublicHtml, rootOnlyHtml };
}

function summarizeChecks(file, checks) {
  const passed = checks.filter((check) => check.pass).length;
  const total = checks.length;
  const issues = checks.filter((check) => !check.pass).map((check) => check.label);
  return { file, score: `${passed}/${total}`, status: total && passed === total ? "pass" : "review", issues };
}

function main() {
  const files = walk(ROOT);
  const htmlFiles = files.filter((file) => file.endsWith(".html") && file.startsWith("public/"));
  const cssFiles = files.filter((file) => file.endsWith(".css") && file.startsWith("public/assets/css/"));

  if (FIX_MODE) {
    for (const file of htmlFiles) {
      const content = read(file);
      const repaired = repairHtml(file, content);
      if (repaired !== content) write(file, repaired);
    }
  }

  const duplicatePages = detectDuplicatePages(files);
  const routeReferences = collectRouteReferences();
  const navRegistryComparison = compareNavAndRegistry(routeReferences, files);
  const cleanupClassification = classifyHtmlPages(files, routeReferences);

  const pageChecks = htmlFiles.map((file) => summarizeChecks(file, checkHtml(file, read(file))));
  const cssChecks = cssFiles.map((file) => summarizeChecks(file, checkCss(file, read(file))));

  const uiConsistency = {
    cssFileCount: cssFiles.length,
    cssReviewCount: cssChecks.filter((item) => item.status === "review").length,
    pageReviewCount: pageChecks.filter((item) => item.status === "review").length,
    priority: [
      "Standardize page shell spacing and bottom nav safe-area padding.",
      "Use shared glass/card component classes instead of one-off page styles.",
      "Keep mobile behavior in mobile-polish.css or page-specific CSS, not scattered inline.",
      "Prefer theme tokens for surfaces, text, borders, shadows, and radii."
    ]
  };

  const report = {
    generatedAt: new Date().toISOString(),
    mode: FIX_MODE ? "fix" : "audit",
    routeReferences,
    navRegistryComparison,
    duplicatePages,
    cleanupClassification,
    uiConsistency,
    repairedFiles: HTML_REPAIR_FILES,
    files: pageChecks,
    css: cssChecks
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, "repo-audit-report.json"), JSON.stringify(report, null, 2), "utf8");

  const markdown = [
    "# Evaraos Repo Audit Report",
    "",
    `Generated: ${report.generatedAt}`,
    `Mode: ${report.mode}`,
    "",
    "## UI Consistency",
    "",
    `CSS files scanned: ${uiConsistency.cssFileCount}`,
    `CSS files needing review: ${uiConsistency.cssReviewCount}`,
    `Public pages needing review: ${uiConsistency.pageReviewCount}`,
    "",
    "### UI priorities",
    "",
    ...uiConsistency.priority.map((item) => `- ${item}`),
    "",
    "## Navigation vs App Registry",
    "",
    `Nav routes: ${navRegistryComparison.navRouteCount}`,
    `Registry routes: ${navRegistryComparison.registryRouteCount}`,
    `Shared routes: ${navRegistryComparison.sharedRouteCount}`,
    "",
    `Recommendation: ${navRegistryComparison.sourceOfTruthRecommendation}`,
    "",
    "### Nav-only routes",
    "",
    ...(navRegistryComparison.navOnly.length ? navRegistryComparison.navOnly.map((item) => `- [ ] ${item.route} — exists: ${item.exists}`) : ["- None"]),
    "",
    "### Registry-only routes",
    "",
    ...(navRegistryComparison.registryOnly.length ? navRegistryComparison.registryOnly.map((item) => `- [ ] ${item.route} — exists: ${item.exists}`) : ["- None"]),
    "",
    "## Missing referenced routes",
    "",
    ...(cleanupClassification.missingReferencedRoutes.length ? cleanupClassification.missingReferencedRoutes.map((file) => `- [ ] ${file}`) : ["- None"]),
    "",
    "## Duplicate root/public pages",
    "",
    ...(duplicatePages.length ? duplicatePages.map((pair) => `- [ ] ${pair.root} duplicates ${pair.deployed}`) : ["- None"]),
    "",
    "## Unreferenced public HTML pages",
    "",
    ...(cleanupClassification.unreferencedPublicHtml.length ? cleanupClassification.unreferencedPublicHtml.map((item) => `- [ ] ${item.file}`) : ["- None"]),
    "",
    "## CSS checks needing review",
    "",
    ...(cssChecks.filter((item) => item.status === "review").length
      ? cssChecks.filter((item) => item.status === "review").map((item) => `- [ ] ${item.file} — ${item.issues.join(", ")}`)
      : ["- None"]),
    "",
    "## Page checks needing review",
    "",
    ...(pageChecks.filter((item) => item.status === "review").length
      ? pageChecks.filter((item) => item.status === "review").map((item) => `- [ ] ${item.file} — ${item.issues.join(", ")}`)
      : ["- None"])
  ];

  fs.writeFileSync(path.join(REPORT_DIR, "repo-audit-report.md"), markdown.join("\n"), "utf8");

  console.log("\nEvaraos Repo Audit Complete");
  console.log(`Mode: ${report.mode}`);
  console.log(`Referenced routes: ${routeReferences.allRoutes.length}`);
  console.log(`Nav-only routes: ${navRegistryComparison.navOnly.length}`);
  console.log(`Registry-only routes: ${navRegistryComparison.registryOnly.length}`);
  console.log(`Missing referenced routes: ${cleanupClassification.missingReferencedRoutes.length}`);
  console.log(`Duplicate page groups: ${duplicatePages.length}`);
  console.log(`Unreferenced public HTML pages: ${cleanupClassification.unreferencedPublicHtml.length}`);
  console.log(`CSS files needing review: ${uiConsistency.cssReviewCount}`);
  console.log(`Public pages needing review: ${uiConsistency.pageReviewCount}`);
}

main();
