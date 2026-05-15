import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  getSavedUserProfile
} from "./firebase.js";

import { getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const fieldList = document.getElementById("fieldList");
const fieldSearch = document.getElementById("fieldSearch");
const fieldStatusFilter = document.getElementById("fieldStatusFilter");
const fieldRefresh = document.getElementById("fieldRefresh");
const fieldTotal = document.getElementById("fieldTotal");
const fieldActive = document.getElementById("fieldActive");
const fieldDone = document.getElementById("fieldDone");
const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

let jobs = [];
let activeUser = null;
let activeProfile = null;

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

function fileExtension(file = {}) {
  const name = String(file.name || "");
  const ext = name.includes(".") ? name.split(".").pop() : "jpg";
  return ext.toLowerCase().replace(/[^a-z0-9]+/g, "") || "jpg";
}

function photoLinks(job = {}, type = "before") {
  const photos = Array.isArray(job[`${type}Photos`]) ? job[`${type}Photos`] : [];
  if (!photos.length) return "";

  return `<div class="field-meta">${photos.slice(0, 6).map((photo, index) => `<a class="field-pill go" href="${escapeHtml(photo.downloadURL || "#")}" target="_blank" rel="noopener noreferrer">${type} ${index + 1}</a>`).join("")}</div>`;
}

function cardMarkup(job = {}) {
  const status = normalize(job.status || "claimed");

  return `
    <article class="field-card glass-card aurora-card beam-target" data-job-id="${escapeHtml(job.id || "")}">
      <div class="field-card-head">
        <div>
          <h3>${escapeHtml(job.customerName || job.title || "Untitled Assignment")}</h3>
          <p>${escapeHtml(job.service || job.serviceType || "Service pending")} • ${escapeHtml(job.address || job.city || "Unknown location")}</p>
        </div>
      </div>

      <div class="field-meta">
        <span class="field-pill ${status === "completed" ? "go" : status === "in_progress" ? "hot" : ""}">${escapeHtml(status.replaceAll("_", " "))}</span>
        <span class="field-pill">${escapeHtml(job.companyName || "No company")}</span>
        <span class="field-pill">${escapeHtml(job.market || job.city || "No market")}</span>
      </div>

      <div class="field-actions">
        ${status === "claimed" || status === "scheduled" ? `<button class="btn btn-theme-primary beam-target" data-start="${escapeHtml(job.id || "")}">Start Job</button>` : ""}
        ${status === "in_progress" ? `<button class="btn btn-theme-primary beam-target" data-complete="${escapeHtml(job.id || "")}">Complete Job</button>` : ""}
        <a class="btn btn-theme-secondary beam-target" href="https://maps.apple.com/?q=${encodeURIComponent(job.address || job.city || "")}" target="_blank" rel="noopener noreferrer">Open Maps</a>
      </div>

      <div class="field-photo-box">
        <div class="field-upload">
          <strong>Before Photos</strong>
          <input type="file" multiple accept="image/*" data-before-upload="${escapeHtml(job.id || "")}" />
          ${photoLinks(job, "before")}
        </div>

        <div class="field-upload">
          <strong>After Photos</strong>
          <input type="file" multiple accept="image/*" data-after-upload="${escapeHtml(job.id || "")}" />
          ${photoLinks(job, "after")}
        </div>
      </div>
    </article>
  `;
}

function applyFilters(items = []) {
  const term = normalize(fieldSearch?.value || "");
  const status = normalize(fieldStatusFilter?.value || "all");

  return items.filter((job) => {
    const textMatch = !term || [job.customerName, job.title, job.address, job.city, job.market, job.service, job.serviceType, job.companyName].some((value) => normalize(value).includes(term));
    const statusMatch = status === "all" || normalize(job.status) === status;
    return textMatch && statusMatch;
  });
}

function renderList() {
  const filtered = applyFilters(jobs);
  fieldTotal.textContent = String(filtered.length);
  fieldActive.textContent = String(filtered.filter((job) => normalize(job.status) === "in_progress").length);
  fieldDone.textContent = String(filtered.filter((job) => normalize(job.status) === "completed").length);

  if (!filtered.length) {
    fieldList.innerHTML = `<div class="empty-card">No assigned field work found.</div>`;
    return;
  }

  fieldList.innerHTML = filtered.map(cardMarkup).join("");
}

async function loadJobs() {
  fieldRefresh.textContent = "Refreshing...";

  try {
    const snap = await getDocs(collection(db, "jobs"));

    jobs = snap.docs.map((item) => ({ id: item.id, ...item.data() })).filter((job) => {
      const assignedUid = normalize(job.staffClaimedBy || job.assignedTo || "");
      const userUid = normalize(activeUser?.uid || "");
      if (!userUid) return false;
      return assignedUid === userUid || normalize(job.assignedStaffName) === normalize(activeProfile?.fullName || "");
    });

    jobs.sort((a, b) => Number(b.updatedAt?.seconds || 0) - Number(a.updatedAt?.seconds || 0));
    renderList();
  } catch (error) {
    console.error("Field dashboard load failed:", error);
    fieldList.innerHTML = `<div class="empty-card">Unable to load assigned work.<br /><br />${escapeHtml(error.message || "Firestore error")}</div>`;
  } finally {
    fieldRefresh.textContent = "Refresh";
  }
}

async function updateJob(jobId, payload = {}) {
  await updateDoc(doc(db, "jobs", jobId), { ...payload, updatedAt: serverTimestamp() });
  await loadJobs();
}

async function startJob(jobId) {
  await updateJob(jobId, { status: "in_progress", startedAt: serverTimestamp() });
}

async function completeJob(jobId) {
  await updateJob(jobId, { status: "completed", completedAt: serverTimestamp() });
}

function validatePhoto(file) {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not an image.`);
  if (file.size > MAX_PHOTO_BYTES) throw new Error(`${file.name} must be under 12MB.`);
}

async function uploadFieldPhotos(jobId, files, type) {
  const job = jobs.find((item) => item.id === jobId) || {};
  const storage = getStorage(getApp());
  const uploaded = [];

  for (const file of Array.from(files || [])) {
    validatePhoto(file);
    const safeType = type === "after" ? "after" : "before";
    const path = `jobs/${jobId}/${safeType}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExtension(file)}`;
    const ref = storageRef(storage, path);

    await uploadBytes(ref, file, {
      contentType: file.type,
      customMetadata: {
        ownerUid: activeUser?.uid || "",
        jobId,
        proofType: safeType
      }
    });

    const downloadURL = await getDownloadURL(ref);
    uploaded.push({
      type: safeType,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      path,
      downloadURL,
      uploadedBy: activeUser?.uid || "",
      uploadedByName: activeProfile?.fullName || activeProfile?.displayName || activeUser?.email || "Field Staff",
      uploadedAt: new Date().toISOString()
    });
  }

  const key = type === "after" ? "afterPhotos" : "beforePhotos";
  const current = Array.isArray(job[key]) ? job[key] : [];

  await updateJob(jobId, {
    [key]: [...current, ...uploaded],
    proofStatus: type === "after" ? "after_uploaded" : "before_uploaded",
    lastPhotoUploadAt: serverTimestamp()
  });
}

function bindEvents() {
  fieldSearch?.addEventListener("input", renderList);
  fieldStatusFilter?.addEventListener("change", renderList);
  fieldRefresh?.addEventListener("click", loadJobs);

  document.addEventListener("click", async (event) => {
    const start = event.target.closest("[data-start]");
    const complete = event.target.closest("[data-complete]");

    try {
      if (start) return startJob(start.getAttribute("data-start"));
      if (complete) return completeJob(complete.getAttribute("data-complete"));
    } catch (error) {
      console.error("Field action failed:", error);
      alert(error.message || "Could not update field assignment.");
    }
  });

  document.addEventListener("change", async (event) => {
    const beforeUpload = event.target.closest?.("[data-before-upload]");
    const afterUpload = event.target.closest?.("[data-after-upload]");
    const input = beforeUpload || afterUpload;
    if (!input?.files?.length) return;

    const jobId = beforeUpload?.getAttribute("data-before-upload") || afterUpload?.getAttribute("data-after-upload");
    const type = afterUpload ? "after" : "before";

    try {
      input.disabled = true;
      await uploadFieldPhotos(jobId, input.files, type);
      alert(`${type === "after" ? "After" : "Before"} photos uploaded.`);
      input.value = "";
    } catch (error) {
      console.error("Photo upload failed:", error);
      alert(error.message || "Photo upload failed.");
    } finally {
      input.disabled = false;
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

    activeUser = user;
    activeProfile = getSavedUserProfile() || {};
    await loadJobs();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
