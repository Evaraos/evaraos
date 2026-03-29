const themeModeSelect = document.getElementById("themeModeSelect");
const activeThemeLabel = document.getElementById("activeThemeLabel");
const body = document.body;
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");

const pageTitle = document.getElementById("pageTitle");
const pageSubtitle = document.getElementById("pageSubtitle");

const searchInput = document.getElementById("searchInput");
const filterSource = document.getElementById("filterSource");
const filterSeverity = document.getElementById("filterSeverity");
const filterStatus = document.getElementById("filterStatus");
const companySwitcher = document.getElementById("companySwitcher");

const securityTableBody = document.getElementById("securityTableBody");
const auditTableBody = document.getElementById("auditTableBody");

const recentSecurityList = document.getElementById("recentSecurityList");
const recentAuditList = document.getElementById("recentAuditList");
const autoFixQueueList = document.getElementById("autoFixQueueList");
const autoFixPanelList = document.getElementById("autoFixPanelList");
const notificationFeedList = document.getElementById("notificationFeedList");
const notificationsList = document.getElementById("notificationsList");
const drawerNotificationList = document.getElementById("drawerNotificationList");

const metricOpenAlerts = document.getElementById("metricOpenAlerts");
const metricCriticalAlerts = document.getElementById("metricCriticalAlerts");
const metricAutoFix = document.getElementById("metricAutoFix");
const metricResolvedToday = document.getElementById("metricResolvedToday");
const metricEscalated = document.getElementById("metricEscalated");
const metricUnreadNotifications = document.getElementById("metricUnreadNotifications");

const openNotificationsBtn = document.getElementById("openNotificationsBtn");
const closeNotificationsBtn = document.getElementById("closeNotificationsBtn");
const notificationDrawer = document.getElementById("notificationDrawer");
const markNotificationsReadBtn = document.getElementById("markNotificationsReadBtn");

const refreshBtn = document.getElementById("refreshBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const createTestAlertBtn = document.getElementById("createTestAlertBtn");
const seedDemoBtn = document.getElementById("seedDemoBtn");
const clearDemoBtn = document.getElementById("clearDemoBtn");
const runAllSafeFixesBtn = document.getElementById("runAllSafeFixesBtn");

const detailModalOverlay = document.getElementById("detailModalOverlay");
const closeDetailModalBtn = document.getElementById("closeDetailModalBtn");
const detailModalTitle = document.getElementById("detailModalTitle");
const detailModalSubtitle = document.getElementById("detailModalSubtitle");
const detailSource = document.getElementById("detailSource");
const detailSeverity = document.getElementById("detailSeverity");
const detailStatus = document.getElementById("detailStatus");
const detailCompany = document.getElementById("detailCompany");
const detailMessage = document.getElementById("detailMessage");
const detailExternalUrl = document.getElementById("detailExternalUrl");
const detailStatusSelect = document.getElementById("detailStatusSelect");
const detailAssignSelect = document.getElementById("detailAssignSelect");
const detailNotesInput = document.getElementById("detailNotesInput");
const detailRecheckBtn = document.getElementById("detailRecheckBtn");
const detailEscalateBtn = document.getElementById("detailEscalateBtn");
const detailAutoFixBtn = document.getElementById("detailAutoFixBtn");
const detailSaveBtn = document.getElementById("detailSaveBtn");

const liveStatusText = document.getElementById("liveStatusText");

const THEME_KEY = "evaraos_audit_theme_mode";
const DEMO_KEY = "evaraos_audit_demo_mode";
const STATE = {
  securityAlerts: [],
  auditLogs: [],
  notifications: [],
  selectedItem: null,
  selectedCollection: null,
  usingDemoData: true
};

const STATUS_OPTIONS = ["OPEN", "REVIEWING", "RESOLVED", "ESCALATED", "IGNORED"];
const SEVERITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const demoSecurityAlerts = [
  {
    id: "alert_001",
    title: "Public API key exposed in GitHub",
    source: "github",
    category: "secret_exposure",
    severity: "CRITICAL",
    status: "OPEN",
    company: "Evaraos",
    companyId: "evaraos",
    asset: "assets/firebase.js",
    message: "Possible valid secret detected in repository. Rotate or restrict immediately.",
    autoFixAvailable: true,
    autoFixType: "rotate_key",
    externalUrl: "https://github.com",
    assignedTo: "Gilbert",
    notes: "",
    createdAt: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString()
  },
  {
    id: "alert_002",
    title: "Public Google API key warning from Cloud",
    source: "google_cloud",
    category: "integration_warning",
    severity: "HIGH",
    status: "REVIEWING",
    company: "Evaraos",
    companyId: "evaraos",
    asset: "Google API Key",
    message: "Cloud warning detected for a publicly accessible API key tied to the project.",
    autoFixAvailable: true,
    autoFixType: "restrict_key",
    externalUrl: "https://console.cloud.google.com",
    assignedTo: "Admin Team",
    notes: "Needs review against Maps and Firebase restrictions.",
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 16).toISOString()
  },
  {
    id: "alert_003",
    title: "Repeated failed login pattern detected",
    source: "firebase",
    category: "auth_risk",
    severity: "MEDIUM",
    status: "OPEN",
    company: "Supreme True Clean",
    companyId: "supreme-true-clean",
    asset: "auth/session",
    message: "Multiple failed attempts from a suspicious device fingerprint.",
    autoFixAvailable: true,
    autoFixType: "lock_user",
    externalUrl: "",
    assignedTo: "Owner",
    notes: "",
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 118).toISOString()
  }
];

const demoAuditLogs = [
  {
    id: "log_001",
    actor: "Gilbert",
    actorId: "user_001",
    action: "DELETE_USER",
    target: "test_user",
    targetId: "user_123",
    company: "Supreme True Clean",
    companyId: "supreme-true-clean",
    role: "Admin",
    ip: "192.168.1.1",
    device: "iPhone 15",
    source: "dashboard",
    severity: "HIGH",
    status: "OPEN",
    message: "Admin deleted a user account",
    notes: "",
    assignedTo: "Gilbert",
    createdAt: new Date(Date.now() - 1000 * 60 * 11).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 11).toISOString()
  },
  {
    id: "log_002",
    actor: "Owner",
    actorId: "user_100",
    action: "ROLE_CHANGE",
    target: "sales_rep_7",
    targetId: "user_777",
    company: "Evaraos",
    companyId: "evaraos",
    role: "Owner",
    ip: "192.168.1.55",
    device: "MacBook Pro",
    source: "dashboard",
    severity: "HIGH",
    status: "REVIEWING",
    message: "Role changed from Rep to Manager",
    notes: "Confirm permission boundaries",
    assignedTo: "Admin Team",
    createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 28).toISOString()
  },
  {
    id: "log_003",
    actor: "Admin Team",
    actorId: "user_200",
    action: "COMPANY_MOVE",
    target: "user_555",
    targetId: "user_555",
    company: "Evaraos",
    companyId: "evaraos",
    role: "Admin",
    ip: "10.0.0.8",
    device: "Windows Laptop",
    source: "dashboard",
    severity: "CRITICAL",
    status: "ESCALATED",
    message: "User moved from one company scope to another",
    notes: "Audit owner requested verification",
    assignedTo: "Owner",
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 20).toISOString()
  }
];

function init() {
  applySavedTheme();
  bindEvents();
  loadData();
}

function bindEvents() {
  themeModeSelect.addEventListener("change", handleThemeChange);
  sidebarToggle?.addEventListener("click", () => sidebar.classList.toggle("open"));

  document.querySelectorAll(".nav-link").forEach((btn) => {
    btn.addEventListener("click", () => activateTab(btn.dataset.tab));
  });

  document.querySelectorAll("[data-switch-tab]").forEach((btn) => {
    btn.addEventListener("click", () => activateTab(btn.dataset.switchTab));
  });

  [searchInput, filterSource, filterSeverity, filterStatus, companySwitcher].forEach((el) => {
    el.addEventListener("input", renderAll);
    el.addEventListener("change", renderAll);
  });

  openNotificationsBtn.addEventListener("click", () => notificationDrawer.classList.add("open"));
  closeNotificationsBtn.addEventListener("click", () => notificationDrawer.classList.remove("open"));

  markNotificationsReadBtn.addEventListener("click", markAllNotificationsRead);
  refreshBtn.addEventListener("click", refreshData);
  exportCsvBtn.addEventListener("click", exportSecurityAlertsCsv);
  createTestAlertBtn.addEventListener("click", createTestAlertShell);
  seedDemoBtn.addEventListener("click", seedDemoData);
  clearDemoBtn.addEventListener("click", clearDemoData);
  runAllSafeFixesBtn.addEventListener("click", runAllSafeFixes);

  closeDetailModalBtn.addEventListener("click", closeDetailModal);
  detailModalOverlay.addEventListener("click", (e) => {
    if (e.target === detailModalOverlay) closeDetailModal();
  });

  detailSaveBtn.addEventListener("click", saveDetailChanges);
  detailEscalateBtn.addEventListener("click", escalateSelectedItem);
  detailRecheckBtn.addEventListener("click", recheckSelectedItem);
  detailAutoFixBtn.addEventListener("click", autoFixSelectedItem);
}

function handleThemeChange() {
  const mode = themeModeSelect.value;
  localStorage.setItem(THEME_KEY, mode);
  applyTheme(mode);
}

function applySavedTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "dark";
  themeModeSelect.value = saved;
  applyTheme(saved);
}

function applyTheme(mode) {
  if (mode === "system") {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    body.setAttribute("data-theme", isDark ? "dark" : "light");
    activeThemeLabel.textContent = "System";
    return;
  }

  body.setAttribute("data-theme", mode);
  activeThemeLabel.textContent = mode === "dark" ? "Dark" : "Light";
}

function activateTab(tabId) {
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === tabId);
  });

  document.querySelectorAll(".nav-link").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });

  const titles = {
    overviewTab: ["Audit Command Center", "Enterprise monitoring, remediation, and alert intelligence."],
    securityTab: ["Security Alerts", "GitHub, Google Cloud, Firebase, Stripe, and internal security signal flow."],
    auditTab: ["Audit Logs", "Owner/Admin event history, status control, and incident handling."],
    autofixTab: ["Auto Fix Queue", "Safe remediation actions with oversight and review."],
    notificationsTab: ["Notifications", "Unified in-app notification center for audits and incidents."],
    settingsTab: ["Settings", "Theme mode, notification channels, and enterprise policy controls."]
  };

  const [title, subtitle] = titles[tabId] || titles.overviewTab;
  pageTitle.textContent = title;
  pageSubtitle.textContent = subtitle;

  sidebar.classList.remove("open");
}

function loadData() {
  const demoEnabled = localStorage.getItem(DEMO_KEY);
  STATE.usingDemoData = demoEnabled !== "off";

  if (STATE.usingDemoData) {
    STATE.securityAlerts = structuredClone(demoSecurityAlerts);
    STATE.auditLogs = structuredClone(demoAuditLogs);
    hydrateNotifications();
    renderAll();
    liveStatusText.textContent = "Demo + Live Ready";
    return;
  }

  // Firestore live hooks placeholder
  // Replace with your Firebase init and onSnapshot listeners.
  STATE.securityAlerts = [];
  STATE.auditLogs = [];
  STATE.notifications = [];
  renderAll();
  liveStatusText.textContent = "Live";
}

function refreshData() {
  loadData();
  pushNotification({
    title: "Data refreshed",
    severity: "LOW",
    source: "internal",
    message: "Audit data was refreshed successfully."
  });
}

function seedDemoData() {
  localStorage.setItem(DEMO_KEY, "on");
  loadData();
}

function clearDemoData() {
  localStorage.setItem(DEMO_KEY, "off");
  loadData();
}

function hydrateNotifications() {
  const items = [...STATE.securityAlerts, ...STATE.auditLogs]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8)
    .map((item, index) => ({
      id: `notif_${index}_${item.id}`,
      title: item.title || item.action,
      source: item.source || "internal",
      severity: item.severity || "LOW",
      message: item.message || "New activity detected",
      read: false,
      createdAt: item.createdAt
    }));

  STATE.notifications = items;
}

function getFilteredAlerts() {
  const q = searchInput.value.trim().toLowerCase();
  const source = filterSource.value;
  const severity = filterSeverity.value;
  const status = filterStatus.value;
  const company = companySwitcher.value;

  return STATE.securityAlerts.filter((item) => {
    const matchesSearch =
      !q ||
      [
        item.title,
        item.message,
        item.source,
        item.company,
        item.asset,
        item.assignedTo
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);

    const matchesSource = source === "all" || item.source === source;
    const matchesSeverity = severity === "all" || item.severity === severity;
    const matchesStatus = status === "all" || item.status === status;
    const matchesCompany = company === "all" || item.companyId === company;

    return matchesSearch && matchesSource && matchesSeverity && matchesStatus && matchesCompany;
  });
}

function getFilteredLogs() {
  const q = searchInput.value.trim().toLowerCase();
  const severity = filterSeverity.value;
  const status = filterStatus.value;
  const company = companySwitcher.value;

  return STATE.auditLogs.filter((item) => {
    const matchesSearch =
      !q ||
      [
        item.action,
        item.actor,
        item.target,
        item.company,
        item.message,
        item.assignedTo
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);

    const matchesSeverity = severity === "all" || item.severity === severity;
    const matchesStatus = status === "all" || item.status === status;
    const matchesCompany = company === "all" || item.companyId === company;

    return matchesSearch && matchesSeverity && matchesStatus && matchesCompany;
  });
}

function renderAll() {
  const alerts = getFilteredAlerts();
  const logs = getFilteredLogs();

  renderMetrics(alerts, logs);
  renderSecurityTable(alerts);
  renderAuditTable(logs);
  renderRecentLists(alerts, logs);
  renderAutoFixLists(alerts);
  renderNotifications();
}

function renderMetrics(alerts, logs) {
  const openAlerts = alerts.filter((a) => a.status === "OPEN").length;
  const criticalAlerts = alerts.filter((a) => a.severity === "CRITICAL").length;
  const autoFixCount = alerts.filter((a) => a.autoFixAvailable).length;
  const escalatedCount = [...alerts, ...logs].filter((x) => x.status === "ESCALATED").length;

  const since = Date.now() - 24 * 60 * 60 * 1000;
  const resolvedToday = [...alerts, ...logs].filter(
    (x) => x.status === "RESOLVED" && new Date(x.updatedAt).getTime() >= since
  ).length;

  const unread = STATE.notifications.filter((n) => !n.read).length;

  metricOpenAlerts.textContent = openAlerts;
  metricCriticalAlerts.textContent = criticalAlerts;
  metricAutoFix.textContent = autoFixCount;
  metricResolvedToday.textContent = resolvedToday;
  metricEscalated.textContent = escalatedCount;
  metricUnreadNotifications.textContent = unread;
}

function renderSecurityTable(alerts) {
  securityTableBody.innerHTML = alerts.length
    ? alerts
        .map(
          (item) => `
      <tr>
        <td>${severityBadge(item.severity)}</td>
        <td>
          <div><strong>${escapeHtml(item.title)}</strong></div>
          <div class="feed-meta">${escapeHtml(item.asset || "")}</div>
        </td>
        <td>${sourceBadge(item.source)}</td>
        <td>${escapeHtml(item.company)}</td>
        <td>${statusBadge(item.status)}</td>
        <td>${escapeHtml(item.assignedTo || "Unassigned")}</td>
        <td>${formatDate(item.createdAt)}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-secondary" onclick="openItemDetail('security','${item.id}')">View</button>
            <button class="btn btn-secondary" onclick="quickResolve('security','${item.id}')">Resolve</button>
            <button class="btn btn-primary" onclick="quickAutoFix('security','${item.id}')">Auto Fix</button>
          </div>
        </td>
      </tr>
    `
        )
        .join("")
    : emptyTableRow("No security alerts found.");
}

function renderAuditTable(logs) {
  auditTableBody.innerHTML = logs.length
    ? logs
        .map(
          (item) => `
      <tr>
        <td>${severityBadge(item.severity)}</td>
        <td><strong>${escapeHtml(item.action)}</strong></td>
        <td>${escapeHtml(item.actor)}</td>
        <td>${escapeHtml(item.target)}</td>
        <td>${escapeHtml(item.company)}</td>
        <td>${statusBadge(item.status)}</td>
        <td>${formatDate(item.createdAt)}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-secondary" onclick="openItemDetail('audit','${item.id}')">View</button>
            <button class="btn btn-secondary" onclick="quickEscalate('audit','${item.id}')">Escalate</button>
            <button class="btn btn-primary" onclick="quickAutoFix('audit','${item.id}')">Auto Fix</button>
          </div>
        </td>
      </tr>
    `
        )
        .join("")
    : emptyTableRow("No audit logs found.");
}

function renderRecentLists(alerts, logs) {
  recentSecurityList.innerHTML = alerts
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 4)
    .map(renderFeedCard)
    .join("");

  recentAuditList.innerHTML = logs
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 4)
    .map(renderFeedCard)
    .join("");

  notificationFeedList.innerHTML = STATE.notifications.slice(0, 4).map(renderNotificationCard).join("");
}

function renderAutoFixLists(alerts) {
  const autoFixItems = alerts.filter((a) => a.autoFixAvailable);

  const html = autoFixItems.length
    ? autoFixItems.map(renderFeedCard).join("")
    : `<div class="feed-card"><div class="feed-title">No auto-fix items available.</div></div>`;

  autoFixQueueList.innerHTML = html;
  autoFixPanelList.innerHTML = html;
}

function renderNotifications() {
  const html = STATE.notifications.length
    ? STATE.notifications.map(renderNotificationCard).join("")
    : `<div class="feed-card"><div class="feed-title">No notifications yet.</div></div>`;

  notificationsList.innerHTML = html;
  drawerNotificationList.innerHTML = html;
}

function renderFeedCard(item) {
  const title = item.title || item.action || "Alert";
  const source = item.source || "internal";
  const status = item.status || "OPEN";
  const collection = item.title ? "security" : "audit";

  return `
    <article class="feed-card">
      <div class="feed-head">
        <div>
          <div class="feed-title">${escapeHtml(title)}</div>
          <div class="feed-meta">
            ${severityBadge(item.severity || "LOW")}
            ${statusBadge(status)}
            ${sourceBadge(source)}
          </div>
        </div>
      </div>
      <div>${escapeHtml(item.message || "No message provided.")}</div>
      <div class="feed-meta">
        <span>${escapeHtml(item.company || "No company")}</span>
        <span>${formatDate(item.createdAt)}</span>
      </div>
      <div class="feed-actions">
        <button class="btn btn-secondary" onclick="openItemDetail('${collection}','${item.id}')">View</button>
        <button class="btn btn-primary" onclick="quickAutoFix('${collection}','${item.id}')">Auto Fix</button>
      </div>
    </article>
  `;
}

function renderNotificationCard(item) {
  return `
    <article class="feed-card">
      <div class="feed-head">
        <div>
          <div class="feed-title">${escapeHtml(item.title)}</div>
          <div class="feed-meta">
            ${severityBadge(item.severity)}
            ${sourceBadge(item.source)}
            <span>${item.read ? "Read" : "Unread"}</span>
          </div>
        </div>
      </div>
      <div>${escapeHtml(item.message)}</div>
      <div class="feed-meta">
        <span>${formatDate(item.createdAt)}</span>
      </div>
    </article>
  `;
}

function emptyTableRow(text) {
  return `<tr><td colspan="8"><div class="feed-meta">${escapeHtml(text)}</div></td></tr>`;
}

function severityBadge(level) {
  const safe = String(level || "LOW").toUpperCase();
  const cls =
    safe === "CRITICAL"
      ? "badge-critical"
      : safe === "HIGH"
      ? "badge-high"
      : safe === "MEDIUM"
      ? "badge-medium"
      : "badge-low";

  return `<span class="badge ${cls}">${safe}</span>`;
}

function statusBadge(status) {
  const safe = String(status || "OPEN").toUpperCase();
  const cls = `badge-status-${safe.toLowerCase()}`;
  return `<span class="badge ${cls}">${safe}</span>`;
}

function sourceBadge(source) {
  const safe = String(source || "internal");
  return `<span class="pill">${escapeHtml(safe)}</span>`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function findItem(collection, id) {
  const list = collection === "security" ? STATE.securityAlerts : STATE.auditLogs;
  return list.find((item) => item.id === id);
}

window.openItemDetail = function (collection, id) {
  const item = findItem(collection, id);
  if (!item) return;

  STATE.selectedCollection = collection;
  STATE.selectedItem = item;

  detailModalTitle.textContent = item.title || item.action || "Alert Detail";
  detailModalSubtitle.textContent = `${collection === "security" ? "Security Alert" : "Audit Log"} • ${item.id}`;
  detailSource.textContent = item.source || "internal";
  detailSeverity.textContent = item.severity || "LOW";
  detailStatus.textContent = item.status || "OPEN";
  detailCompany.textContent = item.company || "Unknown";
  detailMessage.textContent = item.message || "No message provided.";
  detailExternalUrl.textContent = item.externalUrl || "No external link";
  detailExternalUrl.href = item.externalUrl || "#";
  detailStatusSelect.value = item.status || "OPEN";
  detailAssignSelect.value = item.assignedTo || "Gilbert";
  detailNotesInput.value = item.notes || "";

  detailModalOverlay.classList.add("open");
};

function closeDetailModal() {
  detailModalOverlay.classList.remove("open");
  STATE.selectedItem = null;
  STATE.selectedCollection = null;
}

function updateItem(collection, id, patch) {
  const list = collection === "security" ? STATE.securityAlerts : STATE.auditLogs;
  const index = list.findIndex((item) => item.id === id);
  if (index === -1) return;

  list[index] = {
    ...list[index],
    ...patch,
    updatedAt: new Date().toISOString()
  };

  renderAll();
}

function saveDetailChanges() {
  if (!STATE.selectedItem || !STATE.selectedCollection) return;

  updateItem(STATE.selectedCollection, STATE.selectedItem.id, {
    status: detailStatusSelect.value,
    assignedTo: detailAssignSelect.value,
    notes: detailNotesInput.value.trim()
  });

  pushNotification({
    title: "Alert updated",
    severity: "LOW",
    source: "internal",
    message: "Status, assignment, or notes were updated."
  });

  closeDetailModal();
}

function escalateSelectedItem() {
  if (!STATE.selectedItem || !STATE.selectedCollection) return;
  quickEscalate(STATE.selectedCollection, STATE.selectedItem.id);
  closeDetailModal();
}

function recheckSelectedItem() {
  if (!STATE.selectedItem) return;

  pushNotification({
    title: "Recheck requested",
    severity: "MEDIUM",
    source: "internal",
    message: `Recheck started for ${STATE.selectedItem.title || STATE.selectedItem.action}.`
  });

  closeDetailModal();
}

function autoFixSelectedItem() {
  if (!STATE.selectedItem || !STATE.selectedCollection) return;
  quickAutoFix(STATE.selectedCollection, STATE.selectedItem.id);
  closeDetailModal();
}

window.quickResolve = function (collection, id) {
  updateItem(collection, id, { status: "RESOLVED" });
  pushNotification({
    title: "Alert resolved",
    severity: "LOW",
    source: "internal",
    message: `Item ${id} was marked resolved.`
  });
};

window.quickEscalate = function (collection, id) {
  updateItem(collection, id, { status: "ESCALATED" });
  pushNotification({
    title: "Alert escalated",
    severity: "HIGH",
    source: "internal",
    message: `Item ${id} was escalated for review.`
  });
};

window.quickAutoFix = function (collection, id) {
  const item = findItem(collection, id);
  if (!item) return;

  updateItem(collection, id, {
    status: "REVIEWING",
    notes: `${item.notes ? `${item.notes}\n` : ""}[Auto Fix Shell] Triggered ${item.autoFixType || "generic_fix"}`
  });

  pushNotification({
    title: "Auto Fix started",
    severity: item.severity || "LOW",
    source: item.source || "internal",
    message: `${item.title || item.action} entered auto-fix flow.`
  });
};

function runAllSafeFixes() {
  STATE.securityAlerts
    .filter((item) => item.autoFixAvailable && item.severity !== "CRITICAL")
    .forEach((item) => {
      updateItem("security", item.id, {
        status: "REVIEWING",
        notes: `${item.notes ? `${item.notes}\n` : ""}[Batch Auto Fix] Safe remediation executed.`
      });
    });

  pushNotification({
    title: "Batch auto-fix completed",
    severity: "MEDIUM",
    source: "internal",
    message: "Safe remediation actions were executed on eligible alerts."
  });
}

function createTestAlertShell() {
  const now = new Date().toISOString();

  const test = {
    id: `alert_${Math.random().toString(36).slice(2, 10)}`,
    title: "Manual test alert",
    source: "internal",
    category: "user_action",
    severity: "HIGH",
    status: "OPEN",
    company: companySwitcher.value === "all" ? "Evaraos" : prettyCompany(companySwitcher.value),
    companyId: companySwitcher.value === "all" ? "evaraos" : companySwitcher.value,
    asset: "dashboard/manual",
    message: "Manual test alert created from the Audit Command Center.",
    autoFixAvailable: true,
    autoFixType: "mark_resolved",
    externalUrl: "",
    assignedTo: "Gilbert",
    notes: "",
    createdAt: now,
    updatedAt: now
  };

  STATE.securityAlerts.unshift(test);
  hydrateNotifications();
  renderAll();

  pushNotification({
    title: "Test alert created",
    severity: "HIGH",
    source: "internal",
    message: "Manual test alert was added to security alerts."
  });
}

function prettyCompany(value) {
  if (value === "supreme-true-clean") return "Supreme True Clean";
  if (value === "evaraos") return "Evaraos";
  return "All Companies";
}

function pushNotification({ title, severity, source, message }) {
  STATE.notifications.unshift({
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    severity,
    source,
    message,
    read: false,
    createdAt: new Date().toISOString()
  });

  renderNotifications();
  renderMetrics(getFilteredAlerts(), getFilteredLogs());
}

function markAllNotificationsRead() {
  STATE.notifications = STATE.notifications.map((item) => ({
    ...item,
    read: true
  }));
  renderNotifications();
  renderMetrics(getFilteredAlerts(), getFilteredLogs());
}

function exportSecurityAlertsCsv() {
  const alerts = getFilteredAlerts();
  const headers = [
    "id",
    "title",
    "source",
    "category",
    "severity",
    "status",
    "company",
    "asset",
    "message",
    "autoFixAvailable",
    "autoFixType",
    "assignedTo",
    "createdAt",
    "updatedAt"
  ];

  const rows = alerts.map((item) =>
    headers.map((header) => `"${String(item[header] ?? "").replaceAll('"', '""')}"`).join(",")
  );

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "evaraos-security-alerts.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

init();
