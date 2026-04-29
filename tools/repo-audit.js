/**
 * Evaraos Repo Audit + Repair Script
 *
 * Audit only:
 *   node tools/repo-audit.js
 *
 * Apply safe light-first HTML repairs:
 *   node tools/repo-audit.js --fix
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
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

  next = next.replace(/<html([^>]*?)data-theme="dark"([^>]*?)>/i, "<html$1data-theme=\"light\"$2>");
  next = next.replace(/var\s+theme\s*=\s*"dark";/g, "var theme = \"light\";");
  next = next.replace(/setAttribute\("data-theme",\s*"dark"\)/g, "setAttribute(\"data-theme\", \"light\")");
  next = next.replace(/background:\s*#060814;/gi, "background: #f4f7f6;");
  next = next.replace(/<meta\s+name="theme-color"\s+content="#050311"\s*\/>/gi, '<meta name="theme-color" content="#f4f7f6" />');
  next = next.replace(/<meta\s+name="msapplication-TileColor"\s+content="#050311"\s*\/>/gi, '<meta name="msapplication-TileColor" content="#f4f7f6" />');

  if (next !== content) {
    HTML_REPAIR_FILES.push(relative);
  }

  return next;
}

function checkHtml(relative, content) {
  const checks = [];

  checks.push({
    label: "DOCTYPE present",
    pass: /<!DOCTYPE html>/i.test(content)
  });

  checks.push({
    label: "light-first html theme",
    pass: !/<html[^>]*data-theme="dark"/i.test(content)
  });

  checks.push({
    label: "light-first boot variable",
    pass: !/var\s+theme\s*=\s*"dark";/.test(content)
  });

  checks.push({
    label: "light fallback theme",
    pass: !/setAttribute\("data-theme",\s*"dark"\)/.test(content)
  });

  checks.push({
    label: "light first-paint background",
    pass: !/background:\s*#060814;/i.test(content)
  });

  checks.push({
    label: "light browser theme meta",
    pass: !/<meta\s+name="theme-color"\s+content="#050311"/i.test(content)
  });

  checks.push({
    label: "light tile color meta",
    pass: !/<meta\s+name="msapplication-TileColor"\s+content="#050311"/i.test(content)
  });

  checks.push({
    label: "universal nav mount present",
    pass: /id="universalNavRoot"|id="universalNav"/.test(content)
  });

  checks.push({
    label: "repo absolute asset paths",
    pass: !/(href|src)="\.\//.test(content)
  });

  return checks;
}

function checkTextFile(relative, content, checks) {
  if (relative === "assets/js/nav/nav-main.js") {
    checks.push({
      label: "logo home override bound",
      pass: /bindAlwaysHomeLogo/.test(content)
    });
  }

  if (relative === "assets/js/theme-css-loader.js") {
    checks.push({
      label: "theme hydration marker present",
      pass: /data-evara-theme-ready/.test(content)
    });

    checks.push({
      label: "theme css loader light fallback",
      pass: /return document\.documentElement\.getAttribute\("data-theme"\) \|\| "light";/.test(content)
    });
  }

  if (relative === "assets/css/theme.css") {
    checks.push({
      label: "first-paint light guard imported",
      pass: /first-paint-light\.css/.test(content)
    });
  }

  if (relative === "manifest.json") {
    checks.push({
      label: "manifest light background",
      pass: /"background_color"\s*:\s*"#f4f7f6"/.test(content)
    });

    checks.push({
      label: "manifest light theme color",
      pass: /"theme_color"\s*:\s*"#f4f7f6"/.test(content)
    });
  }
}

function main() {
  const files = walk(ROOT);
  const htmlFiles = files.filter((file) => file.endsWith(".html") && !file.startsWith("tools/"));
  const coreFiles = [
    "assets/js/nav/nav-main.js",
    "assets/js/theme-css-loader.js",
    "assets/css/theme.css",
    "assets/css/themes/first-paint-light.css",
    "manifest.json"
  ].filter((file) => fs.existsSync(path.join(ROOT, file)));

  if (FIX_MODE) {
    for (const file of htmlFiles) {
      const content = read(file);
      const repaired = repairHtml(file, content);
      if (repaired !== content) write(file, repaired);
    }
  }

  const results = [];

  for (const file of htmlFiles) {
    const content = read(file);
    const checks = checkHtml(file, content);
    results.push({ file, checks });
  }

  for (const file of coreFiles) {
    const content = read(file);
    const checks = [];
    checkTextFile(file, content, checks);
    results.push({ file, checks });
  }

  const filesSummary = results.map((result) => {
    const passed = result.checks.filter((check) => check.pass).length;
    const total = result.checks.length;
    const issues = result.checks.filter((check) => !check.pass).map((check) => check.label);

    return {
      file: result.file,
      score: `${passed}/${total}`,
      passed,
      total,
      status: total && passed === total ? "pass" : "review",
      issues
    };
  });

  const totals = filesSummary.reduce(
    (acc, item) => {
      acc.passed += item.passed;
      acc.total += item.total;
      return acc;
    },
    { passed: 0, total: 0 }
  );

  const report = {
    generatedAt: new Date().toISOString(),
    mode: FIX_MODE ? "fix" : "audit",
    totals,
    repairedFiles: HTML_REPAIR_FILES,
    files: filesSummary
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, "repo-audit-report.json"), JSON.stringify(report, null, 2), "utf8");

  const markdown = [
    "# Evaraos Repo Audit Report",
    "",
    `Generated: ${report.generatedAt}`,
    `Mode: ${report.mode}`,
    `Overall Score: ${totals.passed}/${totals.total}`,
    "",
    FIX_MODE ? `Repaired Files: ${HTML_REPAIR_FILES.length}` : "Repaired Files: 0",
    "",
    ...filesSummary.flatMap((item) => [
      `## ${item.file}`,
      "",
      `Score: ${item.score}`,
      "",
      ...(item.issues.length ? item.issues.map((issue) => `- [ ] ${issue}`) : ["- All checks passed"]),
      ""
    ])
  ];

  fs.writeFileSync(path.join(REPORT_DIR, "repo-audit-report.md"), markdown.join("\n"), "utf8");

  console.log("\nEvaraos Repo Audit");
  console.log(`Mode: ${report.mode}`);
  console.log(`Overall Score: ${totals.passed}/${totals.total}`);

  if (FIX_MODE) {
    console.log(`Repaired HTML files: ${HTML_REPAIR_FILES.length}`);
    HTML_REPAIR_FILES.forEach((file) => console.log(`  - ${file}`));
  }

  const failing = filesSummary.filter((item) => item.issues.length);
  if (failing.length) {
    console.log("\nNeeds Review:");
    failing.forEach((item) => {
      console.log(`- ${item.file}: ${item.issues.join(", ")}`);
    });
  } else {
    console.log("\nAll checks passed.");
  }

  console.log("\nReports written:");
  console.log("- tools/reports/repo-audit-report.json");
  console.log("- tools/reports/repo-audit-report.md\n");
}

main();
