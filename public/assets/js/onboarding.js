import {
  auth,
  db,
  onAuthStateChanged,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  getSavedUserProfile
} from "./firebase.js";

const TASK_LABELS = {
  reviewPolicies: {
    title: "Review company policies",
    description: "Read operational standards, compliance expectations, and staff guidelines."
  },
  completeTaxDocs: {
    title: "Complete tax + payout setup",
    description: "Finalize onboarding documents and payment routing before assignments."
  },
  completeTraining: {
    title: "Finish onboarding training",
    description: "Complete role-specific onboarding and workflow training."
  },
  receiveAssignment: {
    title: "Receive first assignment",
    description: "Management dispatches your first route, lead set, or crew assignment."
  },
  activatePayouts: {
    title: "Activate payout profile",
    description: "Connect payout information before payroll or contractor payouts."
  }
};

const onboardingRoot = document.getElementById("onboardingRoot");
const onboardingPercent = document.getElementById("onboardingPercent");
const onboardingRole = document.getElementById("onboardingRole");
const onboardingCompany = document.getElementById("onboardingCompany");

let currentProfile = null;

function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function roleLabel(role = "") {
  return String(role || "staff")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function completionPercent(tasks = {}) {
  const values = Object.values(tasks || {});
  if (!values.length) return 0;
  const complete = values.filter(Boolean).length;
  return Math.round((complete / values.length) * 100);
}

function profileRows(profile = {}) {
  return `
    <div class="profile-row"><strong>Name</strong><span>${escapeHtml(profile.fullName || "Unknown")}</span></div>
    <div class="profile-row"><strong>Role</strong><span>${escapeHtml(roleLabel(profile.role))}</span></div>
    <div class="profile-row"><strong>Company</strong><span>${escapeHtml(profile.companyName || "Not assigned")}</span></div>
    <div class="profile-row"><strong>Market</strong><span>${escapeHtml(profile.market || "Not assigned")}</span></div>
    <div class="profile-row"><strong>Employment</strong><span>${escapeHtml(profile.employmentType || "Not set")}</span></div>
    <div class="profile-row"><strong>Status</strong><span>${escapeHtml(profile.status || "pending")}</span></div>
  `;
}

function renderTasks(profile = {}) {
  const tasks = profile.onboardingTasks || {};

  return Object.entries(TASK_LABELS).map(([key, meta]) => {
    const complete = Boolean(tasks[key]);

    return `
      <article class="task-card glass-card aurora-card beam-target">
        <div>
          <h3>${escapeHtml(meta.title)}</h3>
          <p>${escapeHtml(meta.description)}</p>
        </div>
        <button
          type="button"
          class="task-toggle"
          data-task-key="${escapeHtml(key)}"
          aria-checked="${complete ? "true" : "false"}"
          title="Toggle onboarding task"
        ></button>
      </article>
    `;
  }).join("");
}

function renderProfile(profile = {}) {
  currentProfile = profile;

  const percent = completionPercent(profile.onboardingTasks || {});
  onboardingPercent.textContent = `${percent}%`;
  onboardingRole.textContent = roleLabel(profile.role || "staff");
  onboardingCompany.textContent = profile.companyName || "Not assigned";

  onboardingRoot.innerHTML = `
    <div class="onboarding-grid">
      <section class="profile-card">
        <h2>Staff Profile</h2>
        ${profileRows(profile)}
        <div class="onboarding-actions">
          <a class="btn btn-theme-primary beam-target" href="/dashboard.html">Open Dashboard</a>
          <a class="btn btn-theme-secondary beam-target" href="/applications.html">Applications</a>
        </div>
      </section>

      <section>
        <div class="task-list">
          ${renderTasks(profile)}
        </div>
      </section>
    </div>
  `;

  applyTaskStates(profile.onboardingTasks || {});
}

function applyTaskStates(tasks = {}) {
  Object.entries(tasks || {}).forEach(([key, value]) => {
    const toggle = document.querySelector(`[data-task-key="${CSS.escape(key)}"]`);
    if (!toggle) return;
    toggle.setAttribute("aria-checked", value ? "true" : "false");
  });
}

async function loadOnboarding(uid) {
  const snap = await getDoc(doc(db, "staff_profiles", uid));

  if (!snap.exists()) {
    onboardingRoot.innerHTML = `
      <div class="empty-card">
        Your onboarding profile has not been created yet. Leadership may still be reviewing your application.
      </div>
    `;
    return;
  }

  renderProfile({ id: snap.id, ...snap.data() });
}

async function toggleTask(taskKey) {
  if (!currentProfile?.uid || !TASK_LABELS[taskKey]) return;

  const tasks = {
    ...(currentProfile.onboardingTasks || {})
  };

  tasks[taskKey] = !tasks[taskKey];

  await updateDoc(doc(db, "staff_profiles", currentProfile.uid), {
    onboardingTasks: tasks,
    onboardingStage: completionPercent(tasks) >= 100 ? "fully_active" : "in_progress",
    updatedAt: serverTimestamp()
  });

  currentProfile.onboardingTasks = tasks;
  renderProfile(currentProfile);
}

function bindEvents() {
  onboardingRoot?.addEventListener("click", async (event) => {
    const toggle = event.target.closest("[data-task-key]");
    if (!toggle) return;

    try {
      toggle.disabled = true;
      await toggleTask(toggle.getAttribute("data-task-key"));
    } catch (error) {
      console.error("Onboarding task update failed:", error);
      alert(error.message || "Could not update onboarding task.");
    }
  });
}

function init() {
  bindEvents();

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.assign("/login.html");
      return;
    }

    const profile = getSavedUserProfile() || {};

    if (!["approved", "active"].includes(String(profile.status || "").toLowerCase()) && String(profile.role || "customer").toLowerCase() === "customer") {
      onboardingRoot.innerHTML = `
        <div class="empty-card">
          Your account is still pending approval. Once leadership approves your staff application, onboarding will activate automatically.
        </div>
      `;
      return;
    }

    await loadOnboarding(user.uid);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
