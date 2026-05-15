import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  getDocs
} from "./firebase.js";

const mapCanvas = document.getElementById("mapCanvas");
const mapList = document.getElementById("mapList");
const mapSearch = document.getElementById("mapSearch");
const mapStatusFilter = document.getElementById("mapStatusFilter");
const mapRefresh = document.getElementById("mapRefresh");
const mapTotal = document.getElementById("mapTotal");
const mapOpen = document.getElementById("mapOpen");
const mapActive = document.getElementById("mapActive");

let jobs = [];

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

function statusClass(status = "") {
  const value = normalize(status);
  if (value === "completed") return "done";
  if (value === "in_progress") return "active";
  if (["claimed", "scheduled"].includes(value)) return "claimed";
  return "";
}

function filteredJobs() {
  const term = normalize(mapSearch?.value || "");
  const status = normalize(mapStatusFilter?.value || "all");

  return jobs.filter((job) => {
    const textMatch = !term || [
      job.customerName,
      job.title,
      job.service,
      job.serviceType,
      job.city,
      job.market,
      job.companyName,
      job.address
    ].some((value) => normalize(value).includes(term));

    const statusMatch = status === "all" || normalize(job.status) === status;

    return textMatch && statusMatch;
  });
}

function randomPosition(seed = 1) {
  const x = 12 + ((seed * 17) % 76);
  const y = 14 + ((seed * 31) % 68);
  return { x, y };
}

function renderPins(items = []) {
  const grid = `<div class="map-grid"></div>`;

  const pins = items.map((job, index) => {
    const position = randomPosition(index + 1);

    return `
      <button
        type="button"
        class="map-pin ${statusClass(job.status)}"
        style="left:${position.x}%;top:${position.y}%"
        title="${escapeHtml(job.customerName || job.title || 'Job')}"
        data-focus-job="${escapeHtml(job.id || '')}"
      ></button>
    `;
  }).join("");

  mapCanvas.innerHTML = `${grid}${pins}`;
}

function renderList(items = []) {
  if (!items.length) {
    mapList.innerHTML = `<div class="empty-card">No operational records match the current filters.</div>`;
    return;
  }

  mapList.innerHTML = items.map((job) => `
    <article class="map-card glass-card aurora-card beam-target" id="job-${escapeHtml(job.id || '')}">
      <h3>${escapeHtml(job.customerName || job.title || 'Untitled Job')}</h3>
      <p>${escapeHtml(job.service || job.serviceType || 'Service pending')} • ${escapeHtml(job.city || job.market || 'Unknown market')}</p>

      <div class="map-meta">
        <span class="map-pill ${statusClass(job.status)}">${escapeHtml((job.status || 'new').replaceAll('_', ' '))}</span>
        <span class="map-pill">${escapeHtml(job.companyName || 'No company')}</span>
        ${job.assignedStaffName ? `<span class="map-pill go">${escapeHtml(job.assignedStaffName)}</span>` : ''}
      </div>
    </article>
  `).join('');
}

function renderMap() {
  const items = filteredJobs();

  renderPins(items);
  renderList(items);

  mapTotal.textContent = String(items.length);
  mapOpen.textContent = String(items.filter((job) => ['new', 'dispatch_review'].includes(normalize(job.status))).length);
  mapActive.textContent = String(items.filter((job) => ['claimed', 'scheduled', 'in_progress'].includes(normalize(job.status))).length);
}

async function loadJobs() {
  mapRefresh.textContent = 'Refreshing...';

  try {
    const snap = await getDocs(collection(db, 'jobs'));

    jobs = snap.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    renderMap();
  } catch (error) {
    console.error('Operations map load failed:', error);

    mapList.innerHTML = `
      <div class="empty-card">
        Unable to load operations map.<br /><br />${escapeHtml(error.message || 'Firestore error')}
      </div>
    `;
  } finally {
    mapRefresh.textContent = 'Refresh';
  }
}

function bindEvents() {
  mapSearch?.addEventListener('input', renderMap);
  mapStatusFilter?.addEventListener('change', renderMap);
  mapRefresh?.addEventListener('click', loadJobs);

  mapCanvas?.addEventListener('click', (event) => {
    const pin = event.target.closest('[data-focus-job]');
    if (!pin) return;

    const card = document.getElementById(`job-${pin.getAttribute('data-focus-job')}`);

    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.animate([
        { transform: 'scale(1)' },
        { transform: 'scale(1.02)' },
        { transform: 'scale(1)' }
      ], {
        duration: 420,
        easing: 'ease'
      });
    }
  });
}

function init() {
  bindEvents();

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.assign('/login.html');
      return;
    }

    await loadJobs();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
