import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp
} from './firebase.js';

const jobsCountEl = document.getElementById('pdJobs');
const staffCountEl = document.getElementById('pdStaff');
const matchesCountEl = document.getElementById('pdMatches');
const bestMatchEl = document.getElementById('bestMatch');
const matchesListEl = document.getElementById('pdMatchesList');
const jobsListEl = document.getElementById('pdJobsList');

let jobs = [];
let staff = [];
let latestMatches = [];
let activeUser = null;

function clean(v) {
  return String(v || '').replace(/[<>]/g, '');
}

function toRadians(value) {
  return value * (Math.PI / 180);
}

function distanceMiles(aLat, aLng, bLat, bLng) {
  const earth = 3958.8;
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);
  const calc =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) *
    Math.cos(lat1) * Math.cos(lat2);

  return earth * (2 * Math.atan2(Math.sqrt(calc), Math.sqrt(1 - calc)));
}

function lastSeenMinutes(person) {
  const lastSeen = Number(person.lastSeenMs || 0);
  if (!lastSeen) return 999;
  return Math.max(0, Math.round((Date.now() - lastSeen) / 60000));
}

function distanceScore(miles) {
  if (miles <= 3) return 100;
  if (miles <= 7) return 85;
  if (miles <= 15) return 70;
  if (miles <= 25) return 50;
  return 30;
}

function freshnessScore(person) {
  const minutes = lastSeenMinutes(person);
  if (minutes <= 2) return 100;
  if (minutes <= 10) return 80;
  if (minutes <= 30) return 45;
  return 10;
}

function urgencyScore(job) {
  const priority = String(job.priority || job.urgency || '').toLowerCase();
  const status = String(job.status || '').toLowerCase();

  if (priority === 'emergency' || priority === 'urgent') return 100;
  if (priority === 'high') return 85;
  if (status === 'dispatch_review') return 75;
  return 55;
}

function workloadScore(person) {
  const uid = person.uid || person.id || '';
  const assignedCount = jobs.filter((job) => {
    const status = String(job.status || '').toLowerCase();
    return ['scheduled', 'claimed', 'in_progress'].includes(status) &&
      (job.assignedToUid === uid || job.assignedRep === uid);
  }).length;

  if (assignedCount === 0) return 100;
  if (assignedCount === 1) return 80;
  if (assignedCount === 2) return 55;
  return 25;
}

function confidenceLabel(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Strong';
  if (score >= 60) return 'Good';
  if (score >= 45) return 'Fair';
  return 'Low';
}

function availableStaff() {
  return staff.filter((person) => person.lat && person.lng && freshnessScore(person) >= 45);
}

function openJobs() {
  return jobs.filter((job) => {
    const status = String(job.status || '').toLowerCase();
    return job.lat && job.lng && ['new', 'dispatch_review'].includes(status);
  });
}

function aiDispatchScore(job, person, miles) {
  const dScore = distanceScore(miles);
  const fScore = freshnessScore(person);
  const uScore = urgencyScore(job);
  const wScore = workloadScore(person);

  const total = Math.round(
    (dScore * 0.42) +
    (fScore * 0.22) +
    (wScore * 0.22) +
    (uScore * 0.14)
  );

  return {
    total,
    distance: dScore,
    freshness: fScore,
    workload: wScore,
    urgency: uScore,
    label: confidenceLabel(total)
  };
}

function computeMatches() {
  const workers = availableStaff();
  const open = openJobs();
  const matches = [];

  open.forEach((job) => {
    workers.forEach((person) => {
      const miles = distanceMiles(
        Number(job.lat),
        Number(job.lng),
        Number(person.lat),
        Number(person.lng)
      );
      const aiScore = aiDispatchScore(job, person, miles);

      matches.push({
        job,
        person,
        miles,
        score: aiScore.total,
        aiScore
      });
    });
  });

  return matches.sort((a, b) => b.score - a.score || a.miles - b.miles);
}

async function assignMatch(index) {
  const match = latestMatches[Number(index)];
  if (!match || !activeUser) return;

  const assignmentRef = await addDoc(collection(db, 'dispatch_assignments'), {
    jobId: match.job.id,
    customerName: match.job.customerName || '',
    service: match.job.serviceType || match.job.service || '',
    assignedToUid: match.person.uid || match.person.id || '',
    assignedToName: match.person.displayName || match.person.email || 'Staff',
    assignedToEmail: match.person.email || '',
    distanceMiles: Number(match.miles.toFixed(2)),
    score: match.score,
    confidence: match.aiScore.label,
    scoreBreakdown: match.aiScore,
    status: 'suggested',
    source: 'ai_proximity_dispatch',
    createdBy: activeUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await updateDoc(doc(db, 'jobs', match.job.id), {
    dispatchAssignmentId: assignmentRef.id,
    assignedToUid: match.person.uid || match.person.id || '',
    assignedRep: match.person.uid || match.person.id || '',
    assignedToName: match.person.displayName || match.person.email || 'Staff',
    assignmentSource: 'ai_proximity_dispatch',
    dispatchDistanceMiles: Number(match.miles.toFixed(2)),
    dispatchScore: match.score,
    dispatchConfidence: match.aiScore.label,
    status: 'scheduled',
    updatedAt: serverTimestamp()
  });

  alert('AI dispatch assignment created.');
}

function render() {
  const open = openJobs();
  const workers = availableStaff();
  const matches = computeMatches();
  latestMatches = matches;

  jobsCountEl.textContent = String(open.length);
  staffCountEl.textContent = String(workers.length);
  matchesCountEl.textContent = String(matches.length);

  if (matches.length) {
    const best = matches[0];
    bestMatchEl.textContent =
      clean(best.person.displayName || best.person.email || 'Staff') +
      ' → ' +
      clean(best.job.customerName || 'Job') +
      ' • ' +
      best.aiScore.label +
      ' (' + best.score + ')';
  } else {
    bestMatchEl.textContent = 'No match yet';
  }

  matchesListEl.innerHTML = matches.length
    ? matches.slice(0, 10).map((entry, index) => {
        return '<article class="item"><h3>' +
          clean(entry.person.displayName || entry.person.email || 'Staff') +
          '</h3><p class="muted">AI recommends this worker for ' +
          clean(entry.job.customerName || 'Job') +
          '</p><div class="row"><span class="pill">' +
          entry.miles.toFixed(1) +
          ' miles</span><span class="pill">Score ' +
          entry.score +
          '</span><span class="pill">' +
          entry.aiScore.label +
          '</span><span class="pill">Fresh ' +
          entry.aiScore.freshness +
          '</span><span class="pill">Load ' +
          entry.aiScore.workload +
          '</span><button class="btn btn-theme-primary beam-target" data-assign-match="' +
          index +
          '" type="button">Create Assignment</button></div></article>';
      }).join('')
    : '<div class="item muted">No dispatch recommendations available.</div>';

  jobsListEl.innerHTML = open.length
    ? open.map((job) => {
        return '<article class="item"><h3>' +
          clean(job.customerName || 'Customer') +
          '</h3><p class="muted">' +
          clean(job.serviceType || job.service || 'Service') +
          '</p><div class="row"><span class="pill">Urgency ' +
          urgencyScore(job) +
          '</span></div></article>';
      }).join('')
    : '<div class="item muted">No open jobs with coordinates found.</div>';
}

function bindEvents() {
  matchesListEl?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-assign-match]');
    if (!button) return;

    try {
      button.disabled = true;
      button.textContent = 'Assigning...';
      await assignMatch(button.getAttribute('data-assign-match'));
    } catch (error) {
      console.error(error);
      alert(error.message || 'Assignment failed.');
      button.disabled = false;
      button.textContent = 'Create Assignment';
    }
  });
}

function initRealtime() {
  onSnapshot(collection(db, 'jobs'), (snap) => {
    jobs = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    render();
  });

  onSnapshot(collection(db, 'workforce_locations'), (snap) => {
    staff = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    render();
  });
}

function init() {
  bindEvents();

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.assign('/login.html');
      return;
    }

    activeUser = user;
    initRealtime();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
