import {
  db,
  collection,
  getDocs
} from './firebase.js';

function normalizeStatus(value = '') {
  return String(value || '').trim().toLowerCase();
}

function numberValue(value = 0) {
  return Number(value || 0);
}

function percent(part = 0, total = 0) {
  if (!total) return 0;
  return Number(((part / total) * 100).toFixed(1));
}

function isCompleted(status = '') {
  return ['completed', 'done', 'paid', 'closed'].includes(normalizeStatus(status));
}

function isActive(status = '') {
  return ['active', 'assigned', 'scheduled', 'in_progress', 'working'].includes(normalizeStatus(status));
}

function isLost(status = '') {
  return ['lost', 'cancelled', 'rejected', 'dead'].includes(normalizeStatus(status));
}

function rows(snapshot) {
  return snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
}

export function calculateLeadAnalytics(leads = []) {
  const total = leads.length;
  const converted = leads.filter((lead) => isCompleted(lead.status || lead.leadStatus) || lead.converted === true).length;
  const active = leads.filter((lead) => isActive(lead.status || lead.leadStatus)).length;
  const lost = leads.filter((lead) => isLost(lead.status || lead.leadStatus)).length;

  return {
    total,
    converted,
    active,
    lost,
    conversionRate: percent(converted, total)
  };
}

export function calculateJobAnalytics(jobs = []) {
  const total = jobs.length;
  const completed = jobs.filter((job) => isCompleted(job.status || job.jobStatus)).length;
  const active = jobs.filter((job) => isActive(job.status || job.jobStatus)).length;
  const cancelled = jobs.filter((job) => isLost(job.status || job.jobStatus)).length;
  const revenue = jobs.reduce((sum, job) => sum + numberValue(job.totalAmount || job.subtotal || job.amount), 0);

  return {
    total,
    completed,
    active,
    cancelled,
    completionRate: percent(completed, total),
    revenue
  };
}

export function calculateTerritoryAnalytics(territories = [], leads = [], jobs = []) {
  const territoryMap = {};

  territories.forEach((territory) => {
    const id = territory.territoryId || territory.id || 'unassigned-territory';

    territoryMap[id] = {
      id,
      name: territory.territoryName || territory.name || id,
      regionId: territory.regionId || 'unassigned-region',
      leads: 0,
      jobs: 0,
      completedJobs: 0,
      revenue: 0
    };
  });

  function ensureTerritory(id = 'unassigned-territory') {
    const key = id || 'unassigned-territory';

    territoryMap[key] = territoryMap[key] || {
      id: key,
      name: key,
      regionId: 'unassigned-region',
      leads: 0,
      jobs: 0,
      completedJobs: 0,
      revenue: 0
    };

    return territoryMap[key];
  }

  leads.forEach((lead) => {
    ensureTerritory(lead.territoryId).leads += 1;
  });

  jobs.forEach((job) => {
    const row = ensureTerritory(job.territoryId);

    row.jobs += 1;

    if (isCompleted(job.status || job.jobStatus)) {
      row.completedJobs += 1;
    }

    row.revenue += numberValue(job.totalAmount || job.subtotal || job.amount);
  });

  return Object.values(territoryMap).map((territory) => ({
    ...territory,
    completionRate: percent(territory.completedJobs, territory.jobs)
  }));
}

export async function loadOperationsAnalytics() {
  const [leadsSnapshot, jobsSnapshot, territoriesSnapshot] = await Promise.all([
    getDocs(collection(db, 'leads')),
    getDocs(collection(db, 'jobs')),
    getDocs(collection(db, 'territories'))
  ]);

  const leads = rows(leadsSnapshot);
  const jobs = rows(jobsSnapshot);
  const territories = rows(territoriesSnapshot);

  return {
    leads,
    jobs,
    territories,
    leadAnalytics: calculateLeadAnalytics(leads),
    jobAnalytics: calculateJobAnalytics(jobs),
    territoryAnalytics: calculateTerritoryAnalytics(territories, leads, jobs)
  };
}

window.EvaraOperationsAnalytics = {
  calculateLeadAnalytics,
  calculateJobAnalytics,
  calculateTerritoryAnalytics,
  loadOperationsAnalytics
};
