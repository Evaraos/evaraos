import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  getSavedUserProfile
} from "./firebase.js";

const customerRequestForm = document.getElementById("customerRequestForm");
const customerJobs = document.getElementById("customerJobs");
const customerTotal = document.getElementById("customerTotal");
const customerOpen = document.getElementById("customerOpen");
const customerDone = document.getElementById("customerDone");
const customerService = document.getElementById("customerService");
const customerAddress = document.getElementById("customerAddress");
const customerNotes = document.getElementById("customerNotes");

let activeUser = null;
let activeProfile = null;
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
  if (value === "in_progress") return "hot";
  if (["claimed", "scheduled"].includes(value)) return "go";
  return "";
}

function renderJobs() {
  customerTotal.textContent = String(jobs.length);
  customerOpen.textContent = String(jobs.filter((job) => !["completed", "cancelled"].includes(normalize(job.status))).length);
  customerDone.textContent = String(jobs.filter((job) => normalize(job.status) === "completed").length);

  if (!jobs.length) {
    customerJobs.innerHTML = `<div class="empty-card">You have no service requests yet.</div>`;
    return;
  }

  customerJobs.innerHTML = jobs.map((job) => `
    <article class="customer-job glass-card aurora-card beam-target">
      <h3>${escapeHtml(job.serviceLabel || job.service || 'Service Request')}</h3>
      <p>${escapeHtml(job.address || 'Unknown address')}</p>

      <div class="job-meta">
        <span class="job-pill ${statusClass(job.status)}">${escapeHtml((job.status || 'new').replaceAll('_', ' '))}</span>
        <span class="job-pill">${escapeHtml(job.companyName || 'Evaraos')}</span>
        ${job.assignedStaffName ? `<span class="job-pill go">${escapeHtml(job.assignedStaffName)}</span>` : ''}
      </div>

      ${job.notes ? `<p>${escapeHtml(job.notes)}</p>` : ''}
    </article>
  `).join('');
}

async function loadJobs() {
  try {
    const jobsQuery = query(
      collection(db, 'jobs'),
      where('customerUid', '==', activeUser.uid)
    );

    const snap = await getDocs(jobsQuery);

    jobs = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    jobs.sort((a, b) => Number(b.createdAt?.seconds || 0) - Number(a.createdAt?.seconds || 0));

    renderJobs();
  } catch (error) {
    console.error('Customer jobs load failed:', error);

    customerJobs.innerHTML = `
      <div class="empty-card">
        Failed to load requests.<br /><br />${escapeHtml(error.message || 'Firestore error')}
      </div>
    `;
  }
}

async function submitRequest() {
  const service = customerService.value;
  const address = customerAddress.value.trim();
  const notes = customerNotes.value.trim();

  if (!service || !address) {
    throw new Error('Service and address are required.');
  }

  const payload = {
    title: 'Customer Service Request',
    customerUid: activeUser.uid,
    customerName:
      activeProfile?.fullName ||
      activeProfile?.displayName ||
      activeUser.displayName ||
      activeUser.email ||
      'Customer',
    customerEmail: activeUser.email || '',
    service,
    serviceLabel: service.replaceAll('_', ' ').replace(/\b\w/g, (m) => m.toUpperCase()),
    address,
    notes,
    city: address,
    companyId: 'supreme-true-clean',
    companyName: 'Supreme True Clean',
    leadSource: 'customer_portal',
    source: 'customer_portal',
    customerSubmitted: true,
    createdBy: activeUser.uid,
    createdByUid: activeUser.uid,
    createdByRole: 'customer',
    status: 'new',
    automationStatus: 'company_routed',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await addDoc(collection(db, 'jobs'), payload);

  customerRequestForm.reset();

  await loadJobs();
}

function bindEvents() {
  customerRequestForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      await submitRequest();
      alert('Service request submitted successfully.');
    } catch (error) {
      console.error('Customer request failed:', error);
      alert(error.message || 'Could not submit request.');
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

    activeUser = user;
    activeProfile = getSavedUserProfile() || {};

    await loadJobs();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
