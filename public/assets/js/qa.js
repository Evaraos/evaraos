const QA_STATE_KEY = "evaraos-qa-automation-v3";
const AUDIT_JSON_URL = "/tools/reports/repo-audit-ui.json";
const TARGET_VERSION = "34";

let auditSummary = null;
let automationState = loadAutomationState();

function $(id) {
  return document.getElementById(id);
}

function getEls() {
  return {
    signalRoot: $("qaSignalRoot"),
    searchInput: $("qaSearch"),
    auditFilesRoot: $("auditFilesRoot"),
    auditScoreStat: $("auditScoreStat"),
    auditGeneratedAtStat: $("auditGeneratedAtStat"),
    auditPassingFilesStat: $("auditPassingFilesStat"),
    auditFailingFilesStat: $("auditFailingFilesStat"),
    versionTargetStat: $("versionTargetStat"),
    versionTargetMeta: $("versionTargetMeta"),
    auditSourceText: $("auditSourceText"),
    auditMessageText: $("auditMessageText"),
    qaHeroTitle: $("qaHeroTitle"),
    qaHeroText: $("qaHeroText"),
    autoFindBtn: $("autoFindBtn"),
    autoFixSmallBtn: $("autoFixSmallBtn"),
    refreshAuditBtn: $("refreshAuditBtn"),
    resetAutomationBtn: $("resetAutomationBtn")
  };
}

function loadAutomationState() {
  try {
    return JSON.parse(localStorage.getItem(QA_STATE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveAutomationState(nextState) {
  try {
    localStorage.setItem(QA_STATE_KEY, JSON.stringify(nextState || {}));
  } catch {}
}

function formatTimestamp(value) {
  if (!value) return "Unknown";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function summarizeSignals(summary) {
  const files = Array.isArray(summary?.files) ? summary.files : [];
  const failing = files.filter((file) => file.status !== "pass");
  const outdated = [];

  files.forEach((file) => {
    const issues = Array.isArray(file.issues) ? file.issues : [];

    issues.forEach((issue) => {
      const issueText = String(issue || "");

      if (
        issueText.includes("v=19") ||
        issueText.includes("v=23") ||
        issueText.includes("v=25") ||
        issueText.includes("v=27") ||
        issueText.includes("v=29") ||
        issueText.includes("v=33") ||
        issueText.includes("unversioned")
      ) {
        outdated.push({
          file: file.file || "Unknown file",
          issue: issueText
        });
      }
    });
  });

  return {
    failingCount: failing.length,
    outdatedCount: outdated.length,
    failingFiles: failing,
    outdatedFiles: outdated
  };
}

function buildSignalCards() {
  const summary = summarizeSignals(auditSummary || {});
  const generatedAt = auditSummary?.generatedAt
    ? formatTimestamp(auditSummary.generatedAt)
    : "Unknown";

  return [
    {
      title: "Repo Audit Health",
      description: "Automated reading of repo-audit JSON and file issue status.",
      statusClass: summary.failingCount === 0 ? "qa-status-good" : "qa-status-watch",
      pills: [
        `${summary.failingCount} file${summary.failingCount === 1 ? "" : "s"} with issues`,
        `Generated ${generatedAt}`
      ],
      findings:
        summary.failingCount === 0
          ? ["No failing files reported in the current audit JSON."]
          : summary.failingFiles
              .slice(0, 6)
              .map((file) => `${file.file || "Unknown file"} — ${file.scoreText || file.status || "Issue detected"}`)
    },
    {
      title: "Version Sweep Health",
      description: "Automated surfacing of stale asset versions and unversioned imports from audit findings.",
      statusClass: summary.outdatedCount === 0 ? "qa-status-good" : "qa-status-bad",
      pills: [
        `Target ${TARGET_VERSION}`,
        `${summary.outdatedCount} stale finding${summary.outdatedCount === 1 ? "" : "s"}`
      ],
      findings:
        summary.outdatedCount === 0
          ? [`No stale version findings detected against target v${TARGET_VERSION}.`]
          : summary.outdatedFiles
              .slice(0, 8)
              .map((item) => `${item.file}: ${item.issue}`)
    },
    {
      title: "UI System Alignment",
      description: "Tracks the current strategic direction: centralized settings, centralized QA, split later.",
      statusClass: "qa-status-good",
      pills: ["Centralized now", "Split later"],
      findings: [
        "QA remains one automated console for now.",
        "Settings remains one categorized hub for now.",
        "Appearance, security, and notifications can split later when depth justifies it."
      ]
    },
    {
      title: "Automation Integrity",
      description: "Clarifies what the browser-side QA system can and cannot do honestly.",
      statusClass: "qa-status-neutral",
      pills: ["Auto Find enabled", "Browser-safe fixes only"],
      findings: [
        "Auto Find can refresh audit JSON and recompute automated health.",
        "Auto Fix Small Issues only resets/normalizes browser-side QA state.",
        "Repo code rewrites do not happen from this page."
      ]
    }
  ];
}

function renderSignals() {
  const els = getEls();
  if (!els.signalRoot || !els.searchInput) return;

  const query = (els.searchInput.value || "").trim().toLowerCase();
  const signalCards = buildSignalCards();

  els.signalRoot.innerHTML = "";

  signalCards.forEach((card) => {
    const haystack = [
      card.title,
      card.description,
      ...card.pills,
      ...card.findings
    ]
      .join(" ")
      .toLowerCase();

    if (query && !haystack.includes(query)) return;

    const article = document.createElement("article");
    article.className = `qa-signal-card glass-card aurora-card active-glow beam-target ${card.statusClass}`;

    article.innerHTML = `
      <div class="qa-signal-head">
        <div class="qa-signal-meta">
          <h3>${escapeHtml(card.title)}</h3>
          <p>${escapeHtml(card.description)}</p>
        </div>
        <div class="qa-pill-row">
          ${card.pills.map((pill) => `<span class="qa-pill">${escapeHtml(pill)}</span>`).join("")}
        </div>
      </div>
      <div class="qa-findings">
        ${card.findings.map((finding) => `<div class="qa-finding">${escapeHtml(finding)}</div>`).join("")}
      </div>
    `;

    els.signalRoot.appendChild(article);
  });

  if (!els.signalRoot.children.length) {
    els.signalRoot.innerHTML = `
      <article class="qa-signal-card glass-card aurora-card active-glow beam-target qa-status-neutral">
        <div class="qa-signal-meta">
          <h3>No matching automated signals</h3>
          <p>Try a different search term or refresh the audit report.</p>
        </div>
      </article>
    `;
  }
}

function renderAuditSummary(summary) {
  const els = getEls();
  if (!els.auditFilesRoot || !els.searchInput) return;

  auditSummary = summary;

  const files = Array.isArray(summary?.files) ? summary.files : [];
  const passing = Number(summary?.passingFiles ?? 0);
  const failing = Number(summary?.failingFiles ?? 0);
  const missing = Number(summary?.missingFiles ?? 0);

  if (els.auditScoreStat) els.auditScoreStat.textContent = summary?.auditScoreText || "--";
  if (els.auditGeneratedAtStat) els.auditGeneratedAtStat.textContent = `Generated ${formatTimestamp(summary?.generatedAt)}`;
  if (els.auditPassingFilesStat) els.auditPassingFilesStat.textContent = String(passing);
  if (els.auditFailingFilesStat) els.auditFailingFilesStat.textContent = String(failing + missing);
  if (els.versionTargetStat) els.versionTargetStat.textContent = `v${TARGET_VERSION}`;
  if (els.versionTargetMeta) els.versionTargetMeta.textContent = "Current expected asset version";

  const signalSummary = summarizeSignals(summary);

  if (els.qaHeroTitle && els.qaHeroText) {
    if (signalSummary.failingCount === 0) {
      els.qaHeroTitle.textContent = "Automated health looking strong";
      els.qaHeroText.textContent = `Audit JSON loaded. No failing files detected and target asset version is v${TARGET_VERSION}.`;
    } else {
      els.qaHeroTitle.textContent = "Automated issues detected";
      els.qaHeroText.textContent = `Audit JSON loaded. ${signalSummary.failingCount} file${signalSummary.failingCount === 1 ? "" : "s"} still need attention.`;
    }
  }

  if (els.auditMessageText) {
    els.auditMessageText.textContent = `Loaded ${files.length} file entries from the UI audit report.`;
  }

  const query = (els.searchInput.value || "").trim().toLowerCase();
  els.auditFilesRoot.innerHTML = "";

  files.forEach((file) => {
    const fileName = file.file || "Unknown file";
    const issues = Array.isArray(file.issues) ? file.issues : [];
    const status = file.status || "fail";
    const scoreText = file.scoreText || "--";

    const fileMatches = fileName.toLowerCase().includes(query);
    const issueMatches = issues.some((issue) => String(issue).toLowerCase().includes(query));

    if (query && !fileMatches && !issueMatches) return;

    const article = document.createElement("article");
    article.className = "dashboard-feed-item glass-card aurora-card active-glow beam-target";

    let statusText = `This file has ${issues.length} outstanding audit issue(s).`;

    if (status === "pass") {
      statusText = "All audit checks passed for this file.";
    } else if (status === "missing") {
      statusText = "This file is missing from the repo audit target.";
    }

    article.innerHTML = `
      <strong>${escapeHtml(fileName)} — ${escapeHtml(scoreText)}</strong>
      <span style="display:block;margin-top:8px;">${escapeHtml(statusText)}</span>
    `;

    if (issues.length) {
      const wrap = document.createElement("div");
      wrap.style.marginTop = "14px";
      wrap.style.display = "grid";
      wrap.style.gap = "10px";

      issues.forEach((issue) => {
        if (query && !fileMatches && !String(issue).toLowerCase().includes(query)) return;

        const issueRow = document.createElement("div");
        issueRow.className = "qa-finding";
        issueRow.textContent = issue;
        wrap.appendChild(issueRow);
      });

      if (wrap.children.length) {
        article.appendChild(wrap);
      }
    }

    els.auditFilesRoot.appendChild(article);
  });

  if (!els.auditFilesRoot.children.length) {
    els.auditFilesRoot.innerHTML = `
      <article class="dashboard-feed-item glass-card aurora-card active-glow beam-target">
        <strong>No matching audit results</strong>
        <span>Try a different search term or refresh the audit report.</span>
      </article>
    `;
  }

  renderSignals();
}

async function loadAuditReport() {
  const els = getEls();

  if (els.auditSourceText) {
    els.auditSourceText.textContent = AUDIT_JSON_URL;
  }

  try {
    if (els.auditMessageText) {
      els.auditMessageText.textContent = "Fetching audit report...";
    }

    const response = await fetch(`${AUDIT_JSON_URL}?ts=${Date.now()}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const summary = await response.json();

    automationState.lastAuditLoadedAt = Date.now();
    saveAutomationState(automationState);
    renderAuditSummary(summary);
  } catch (error) {
    console.error("Audit report load failed:", error);

    if (els.qaHeroTitle) {
      els.qaHeroTitle.textContent = "Audit report missing";
    }

    if (els.qaHeroText) {
      els.qaHeroText.textContent = "Could not read repo audit JSON. Run the audit generator and reload this page.";
    }

    if (els.auditFilesRoot) {
      els.auditFilesRoot.innerHTML = `
        <article class="dashboard-feed-item glass-card aurora-card active-glow beam-target">
          <strong>Audit report not loaded</strong>
          <span>
            Could not read <code>/tools/reports/repo-audit-ui.json</code>.
            Run the audit script, make sure the JSON file exists in that path, then reload this page.
          </span>
        </article>
      `;
    }

    if (els.auditScoreStat) els.auditScoreStat.textContent = "--";
    if (els.auditGeneratedAtStat) els.auditGeneratedAtStat.textContent = "No report found";
    if (els.auditPassingFilesStat) els.auditPassingFilesStat.textContent = "--";
    if (els.auditFailingFilesStat) els.auditFailingFilesStat.textContent = "--";
    if (els.auditMessageText) els.auditMessageText.textContent = "Run node tools/repo-audit.js and commit the report.";

    renderSignals();
  }
}

function autoFind() {
  const els = getEls();

  automationState.lastAutoFindAt = Date.now();
  saveAutomationState(automationState);

  if (els.refreshAuditBtn) {
    els.refreshAuditBtn.classList.add("active-glow");

    setTimeout(() => {
      els.refreshAuditBtn?.classList.remove("active-glow");
    }, 240);
  }

  loadAuditReport();
}

function autoFixSmallIssues() {
  const els = getEls();

  automationState = {
    lastAutoFixAt: Date.now(),
    normalized: true
  };

  saveAutomationState(automationState);

  if (els.qaHeroTitle) {
    els.qaHeroTitle.textContent = "Automation state refreshed";
  }

  if (els.qaHeroText) {
    els.qaHeroText.textContent = "Browser-side QA state normalized and ready for a fresh audit read.";
  }

  renderSignals();
}

function bindSidebarNav() {
  document.querySelectorAll(".dashboard-nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".dashboard-nav-link").forEach((item) => {
        item.classList.remove("active");
      });

      link.classList.add("active");
    });
  });
}

function bindEvents() {
  const els = getEls();

  els.searchInput?.addEventListener("input", () => {
    if (auditSummary) {
      renderAuditSummary(auditSummary);
    } else {
      renderSignals();
    }
  });

  els.autoFindBtn?.addEventListener("click", autoFind);
  els.autoFixSmallBtn?.addEventListener("click", autoFixSmallIssues);
  els.refreshAuditBtn?.addEventListener("click", loadAuditReport);

  els.resetAutomationBtn?.addEventListener("click", () => {
    automationState = {};
    saveAutomationState(automationState);

    if (els.qaHeroTitle) {
      els.qaHeroTitle.textContent = "Automation state reset";
    }

    if (els.qaHeroText) {
      els.qaHeroText.textContent = "QA automation state was cleared. Reloading audit report now.";
    }

    loadAuditReport();
  });

  bindSidebarNav();
}

async function initQaConsole() {
  bindEvents();
  renderSignals();
  await loadAuditReport();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initQaConsole, { once: true });
} else {
  initQaConsole();
}
