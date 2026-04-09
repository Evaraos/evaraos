/**
 * Evaraos Repo Audit Script
 * Run with:
 * node tools/repo-audit.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const PAGE_RULES = {
  "index.html": { bodyClass: "landing-page", needsAuthJs: false },
  "login.html": { bodyClass: "login-page", needsAuthJs: true },
  "signup.html": { bodyClass: "signup-page", needsAuthJs: true },
  "reset.html": { bodyClass: "reset-page", needsAuthJs: true },
  "dashboard.html": { bodyClass: "dashboard-body", needsAuthJs: false },
  "profile.html": { bodyClass: "dashboard-body", needsAuthJs: false },
  "settings.html": { bodyClass: "dashboard-body", needsAuthJs: false },
  "security.html": { bodyClass: "dashboard-body", needsAuthJs: false },
  "companies.html": { bodyClass: "dashboard-body", needsAuthJs: false },
  "users.html": { bodyClass: "dashboard-body", needsAuthJs: false },
  "leads.html": { bodyClass: "dashboard-body", needsAuthJs: false },
  "jobs.html": { bodyClass: "dashboard-body", needsAuthJs: false }
};

const REQUIRED_SHARED_SCRIPTS = [
  "/evaraos/assets/js/theme.js",
  "/evaraos/assets/js/nav.js",
  "/evaraos/assets/js/firebase.js"
];

const REQUIRED_AUTH_SCRIPT = "/evaraos/assets/js/auth.js";
const REQUIRED_CSS = "/evaraos/assets/css/styles.css";

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function has(content, snippet) {
  return content.includes(snippet);
}

function scriptIndex(content, scriptPath) {
  return content.indexOf(`src="${scriptPath}"`);
}

function addCheck(checks, label, pass, detail = "") {
  checks.push({ label, pass, detail });
}

function checkPage(fileName) {
  const filePath = path.join(ROOT, fileName);
  const content = readFileSafe(filePath);

  if (!content) {
    return {
      file: fileName,
      exists: false,
      checks: []
    };
  }

  const rule = PAGE_RULES[fileName];
  const checks = [];

  addCheck(checks, "DOCTYPE present", has(content, "<!DOCTYPE html>"));
  addCheck(checks, "html data-theme present", /<html[^>]*data-theme="dark"/i.test(content));
  addCheck(checks, "viewport-fit=cover present", /viewport-fit=cover/i.test(content));
  addCheck(checks, "stylesheet path correct", has(content, `<link rel="stylesheet" href="${REQUIRED_CSS}"`));
  addCheck(checks, "page-grid-overlay present", has(content, `<div class="page-grid-overlay"></div>`));
  addCheck(checks, "universalNav present", has(content, `<div id="universalNav"></div>`));
  addCheck(
    checks,
    "correct body class",
    new RegExp(`<body[^>]*class="${rule.bodyClass}"`, "i").test(content),
    `Expected body class: ${rule.bodyClass}`
  );
  addCheck(
    checks,
    "no old navbar mount",
    !has(content, 'id="navbar"') && !has(content, '<header class="landing-header"'),
    "Should rely on #universalNav instead of hardcoded nav"
  );
  addCheck(checks, "theme.js included", has(content, `src="${REQUIRED_SHARED_SCRIPTS[0]}"`));
  addCheck(checks, "nav.js included", has(content, `src="${REQUIRED_SHARED_SCRIPTS[1]}"`));
  addCheck(checks, "firebase.js included", has(content, `src="${REQUIRED_SHARED_SCRIPTS[2]}"`));

  if (rule.needsAuthJs) {
    addCheck(checks, "auth.js included", has(content, `src="${REQUIRED_AUTH_SCRIPT}"`));
  }

  const themePos = scriptIndex(content, REQUIRED_SHARED_SCRIPTS[0]);
  const navPos = scriptIndex(content, REQUIRED_SHARED_SCRIPTS[1]);
  const firebasePos = scriptIndex(content, REQUIRED_SHARED_SCRIPTS[2]);
  const authPos = scriptIndex(content, REQUIRED_AUTH_SCRIPT);

  addCheck(
    checks,
    "script order correct",
    themePos !== -1 &&
      navPos !== -1 &&
      firebasePos !== -1 &&
      themePos < navPos &&
      navPos < firebasePos &&
      (!rule.needsAuthJs || (authPos !== -1 && firebasePos < authPos)),
    rule.needsAuthJs
      ? "Expected: theme.js → nav.js → firebase.js → auth.js"
      : "Expected: theme.js → nav.js → firebase.js"
  );

  addCheck(
    checks,
    "absolute repo paths used",
    !/href="\.\//.test(content) && !/src="\.\//.test(content),
    "Use /evaraos/... paths"
  );

  addCheck(
    checks,
    "glass cards present",
    /glass-card|glass-shell|dashboard-panel|dashboard-overview|dashboard-hero/.test(content)
  );

  if (rule.bodyClass === "dashboard-body") {
    addCheck(checks, "dashboard-shell present", has(content, `class="dashboard-shell"`) || has(content, `class="dashboard-shell `));
    addCheck(checks, "dashboardSidebar present", has(content, `id="dashboardSidebar"`));
    addCheck(checks, "dashboard-main present", has(content, `class="dashboard-main"`) || has(content, `class="dashboard-main `));
  }

  if (fileName === "login.html") {
    addCheck(checks, "loginForm present", has(content, `id="loginForm"`));
    addCheck(checks, "loginEmail present", has(content, `id="loginEmail"`));
    addCheck(checks, "loginPassword present", has(content, `id="loginPassword"`));
    addCheck(checks, "rememberDevice present", has(content, `id="rememberDevice"`));
    addCheck(checks, "loginMessage present", has(content, `id="loginMessage"`));
  }

  if (fileName === "signup.html") {
    addCheck(checks, "signupForm present", has(content, `id="signupForm"`));
    addCheck(checks, "signupName present", has(content, `id="signupName"`));
    addCheck(checks, "signupEmail present", has(content, `id="signupEmail"`));
    addCheck(checks, "signupPassword present", has(content, `id="signupPassword"`));
    addCheck(checks, "signupPasswordConfirm present", has(content, `id="signupPasswordConfirm"`));
    addCheck(checks, "signupRememberDevice present", has(content, `id="signupRememberDevice"`));
    addCheck(checks, "signupMessage present", has(content, `id="signupMessage"`));
  }

  if (fileName === "reset.html") {
    addCheck(checks, "resetForm present", has(content, `id="resetForm"`));
    addCheck(checks, "resetEmail present", has(content, `id="resetEmail"`));
    addCheck(checks, "resetMessage present", has(content, `id="resetMessage"`));
  }

  return {
    file: fileName,
    exists: true,
    checks
  };
}

function buildSummary(results) {
  const files = results.map((result) => {
    if (!result.exists) {
      return {
        file: result.file,
        score: 0,
        total: 0,
        missing: ["File missing"]
      };
    }

    const score = result.checks.filter((c) => c.pass).length;
    const total = result.checks.length;
    const missing = result.checks
      .filter((c) => !c.pass)
      .map((c) => (c.detail ? `${c.label} — ${c.detail}` : c.label));

    return { file: result.file, score, total, missing };
  });

  const totals = files.reduce(
    (acc, item) => {
      acc.score += item.score;
      acc.total += item.total;
      return acc;
    },
    { score: 0, total: 0 }
  );

  return {
    generatedAt: new Date().toISOString(),
    totals,
    files
  };
}

function buildUiSummary(summary) {
  const files = summary.files.map((file) => {
    const status =
      file.total === 0 ? "missing" :
      file.score === file.total ? "pass" :
      "fail";

    return {
      file: file.file,
      scoreText: `${file.score}/${file.total}`,
      status,
      issueCount: file.missing.length,
      issues: file.missing
    };
  });

  const passingFiles = files.filter((f) => f.status === "pass").length;
  const failingFiles = files.filter((f) => f.status === "fail").length;
  const missingFiles = files.filter((f) => f.status === "missing").length;

  return {
    generatedAt: summary.generatedAt,
    auditScoreText: `${summary.totals.score}/${summary.totals.total}`,
    passingFiles,
    failingFiles,
    missingFiles,
    files
  };
}

function writeReports(summary, uiSummary) {
  const outDir = path.join(ROOT, "tools", "reports");
  fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, "repo-audit-report.json");
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), "utf8");

  const uiJsonPath = path.join(outDir, "repo-audit-ui.json");
  fs.writeFileSync(uiJsonPath, JSON.stringify(uiSummary, null, 2), "utf8");

  const mdLines = [];
  mdLines.push(`# Evaraos Repo Audit Report`);
  mdLines.push(``);
  mdLines.push(`Generated: ${summary.generatedAt}`);
  mdLines.push(``);
  mdLines.push(`Overall Score: ${summary.totals.score}/${summary.totals.total}`);
  mdLines.push(``);

  summary.files.forEach((file) => {
    mdLines.push(`## ${file.file}`);
    mdLines.push(``);
    mdLines.push(`Score: ${file.score}/${file.total}`);
    mdLines.push(``);
    if (!file.missing.length) {
      mdLines.push(`- All checks passed`);
    } else {
      file.missing.forEach((issue) => mdLines.push(`- [ ] ${issue}`));
    }
    mdLines.push(``);
  });

  const mdPath = path.join(outDir, "repo-audit-report.md");
  fs.writeFileSync(mdPath, mdLines.join("\n"), "utf8");

  return { jsonPath, uiJsonPath, mdPath };
}

function printConsole(summary, uiSummary) {
  console.log("\nEvaraos Repo Audit\n");
  console.log(`Overall Score: ${summary.totals.score}/${summary.totals.total}`);
  console.log(`Passing Files: ${uiSummary.passingFiles}`);
  console.log(`Failing Files: ${uiSummary.failingFiles}`);
  console.log(`Missing Files: ${uiSummary.missingFiles}\n`);

  summary.files.forEach((file) => {
    console.log(`${file.file}: ${file.score}/${file.total}`);
    if (file.missing.length) {
      file.missing.forEach((issue) => console.log(`  - ${issue}`));
    }
  });

  console.log("");
}

function main() {
  const results = Object.keys(PAGE_RULES).map(checkPage);
  const summary = buildSummary(results);
  const uiSummary = buildUiSummary(summary);
  const reportPaths = writeReports(summary, uiSummary);

  printConsole(summary, uiSummary);

  console.log("Reports written:");
  console.log(`- ${reportPaths.jsonPath}`);
  console.log(`- ${reportPaths.uiJsonPath}`);
  console.log(`- ${reportPaths.mdPath}`);
}

main();