/**
 * Evaraos Repo Audit + Repair Script
 * Modernized for Firebase public/ deployment structure.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC_ROOT = path.join(ROOT, "public");
const REPORT_DIR = path.join(ROOT, "tools", "reports");
const FIX_MODE = process.argv.includes("--fix");

const IGNORE_DIRS = new Set([".git", "node_modules", "tools/reports"]);
const HTML_REPAIR_FILES = [];

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

  return checks;
}

function detectDuplicatePages(files) {
  const duplicateGroups = [];
  const rootHtml = files.filter((f) => f.endsWith('.html') && !f.startsWith('public/'));

  for (const file of rootHtml) {
    const basename = path.basename(file);
    const publicVersion = `public/${basename}`;

    if (files.includes(publicVersion)) {
      duplicateGroups.push({ root: file, deployed: publicVersion });
    }
  }

  return duplicateGroups;
}

function main() {
  const files = walk(ROOT);

  const htmlFiles = files.filter((file) => file.endsWith(".html") && file.startsWith("public/"));

  if (FIX_MODE) {
    for (const file of htmlFiles) {
      const content = read(file);
      const repaired = repairHtml(file, content);
      if (repaired !== content) write(file, repaired);
    }
  }

  const duplicatePages = detectDuplicatePages(files);

  const results = [];

  for (const file of htmlFiles) {
    const content = read(file);
    const checks = checkHtml(file, content);

    results.push({ file, checks });
  }

  const filesSummary = results.map((result) => {
    const passed = result.checks.filter((check) => check.pass).length;
    const total = result.checks.length;
    const issues = result.checks.filter((check) => !check.pass).map((check) => check.label);

    return {
      file: result.file,
      score: `${passed}/${total}`,
      status: total && passed === total ? "pass" : "review",
      issues
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    mode: FIX_MODE ? "fix" : "audit",
    duplicatePages,
    repairedFiles: HTML_REPAIR_FILES,
    files: filesSummary
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });

  fs.writeFileSync(
    path.join(REPORT_DIR, "repo-audit-report.json"),
    JSON.stringify(report, null, 2),
    "utf8"
  );

  console.log("\nEvaraos Repo Audit Complete");
  console.log(`Mode: ${report.mode}`);
  console.log(`Duplicate page groups: ${duplicatePages.length}`);

  duplicatePages.forEach((pair) => {
    console.log(`DUPLICATE: ${pair.root} -> ${pair.deployed}`);
  });
}

main();
