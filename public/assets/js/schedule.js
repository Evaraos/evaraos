import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  getDocs
} from "./firebase.js";

const calendarGrid = document.getElementById("calendarGrid");
const calendarTitle = document.getElementById("calendarTitle");
const calendarPrev = document.getElementById("calendarPrev");
const calendarNext = document.getElementById("calendarNext");
const scheduleJobs = document.getElementById("scheduleJobs");
const scheduleActive = document.getElementById("scheduleActive");
const scheduleMonth = document.getElementById("scheduleMonth");

let jobs = [];
let currentDate = new Date();

function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalize(value = "") {
  return String(value || "").trim().toLowerCase();
}

function monthLabel(date) {
  return date.toLocaleDateString([], {
    month: "long",
    year: "numeric"
  });
}

function statusClass(status = "") {
  const value = normalize(status);
  if (value === "completed") return "go";
  if (value === "in_progress") return "hot";
  if (["cancelled", "failed"].includes(value)) return "stop";
  return "";
}

function scheduledDate(job = {}) {
  const raw = job.scheduledFor || job.scheduleDate || job.startDate || null;

  if (!raw) return null;

  if (typeof raw === "string") return new Date(raw);
  if (raw.seconds) return new Date(raw.seconds * 1000);

  return null;
}

function jobsForDate(date) {
  return jobs.filter((job) => {
    const scheduled = scheduledDate(job);
    if (!scheduled) return false;

    return scheduled.getFullYear() === date.getFullYear()
      && scheduled.getMonth() === date.getMonth()
      && scheduled.getDate() === date.getDate();
  });
}

function dayCard(date) {
  const dayJobs = jobsForDate(date);

  return `
    <article class="calendar-day glass-card aurora-card beam-target">
      <header>
        <strong>${escapeHtml(date.toLocaleDateString([], { weekday: "short" }))}</strong>
        <span>${escapeHtml(String(date.getDate()))}</span>
      </header>

      ${dayJobs.length
        ? dayJobs.map((job) => `
            <div class="calendar-pill ${statusClass(job.status)}">
              ${escapeHtml(job.customerName || job.title || "Job")}
              <br />
              ${escapeHtml(job.service || job.serviceType || "Service")}
            </div>
          `).join("")
        : `<div class="calendar-pill">No scheduled work</div>`}
    </article>
  `;
}

function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  calendarTitle.textContent = monthLabel(currentDate);
  scheduleMonth.textContent = monthLabel(currentDate);

  const lastDay = new Date(year, month + 1, 0);
  const days = [];

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push(new Date(year, month, day));
  }

  calendarGrid.innerHTML = days.map(dayCard).join("");

  scheduleJobs.textContent = String(jobs.filter((job) => scheduledDate(job)).length);
  scheduleActive.textContent = String(jobs.filter((job) => ["scheduled", "claimed", "in_progress"].includes(normalize(job.status))).length);
}

async function loadJobs() {
  try {
    const snap = await getDocs(collection(db, "jobs"));

    jobs = snap.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    renderCalendar();
  } catch (error) {
    console.error("Schedule load failed:", error);

    calendarGrid.innerHTML = `
      <div class="calendar-day">
        Failed to load schedule.<br /><br />${escapeHtml(error.message || "Firestore error")}
      </div>
    `;
  }
}

function bindEvents() {
  calendarPrev?.addEventListener("click", () => {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    renderCalendar();
  });

  calendarNext?.addEventListener("click", () => {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    renderCalendar();
  });
}

function init() {
  bindEvents();

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.assign("/login.html");
      return;
    }

    await loadJobs();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
