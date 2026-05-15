import {
  db,
  collection,
  getDocs
} from './firebase.js';

function clean(value = '') {
  return String(value || '').trim();
}

function numberOrZero(value) {
  return Number(value || 0);
}

function normalizeStatus(value = '') {
  return clean(value).toLowerCase() || 'new';
}

function statusIcon(status = '') {
  const normalized = normalizeStatus(status);

  if (['new', 'lead', 'pending'].includes(normalized)) return '●';
  if (['assigned', 'claimed', 'scheduled'].includes(normalized)) return '◆';
  if (['in_progress', 'working', 'active'].includes(normalized)) return '▶';
  if (['completed', 'done', 'paid'].includes(normalized)) return '✓';
  if (['cancelled', 'lost', 'rejected'].includes(normalized)) return '×';

  return '●';
}

export function normalizeLeadForMap(lead = {}) {
  return {
    id: lead.id || lead.leadId || '',
    type: 'lead',
    title: lead.customerName || lead.name || lead.title || 'Lead',
    subtitle: lead.service || lead.serviceType || lead.address || 'Lead record',
    status: normalizeStatus(lead.status || lead.leadStatus),
    companyId: lead.companyId || '',
    territoryId: lead.territoryId || '',
    regionId: lead.regionId || '',
    assignedToUid: lead.assignedToUid || lead.assignedRep || '',
    assignedToName: lead.assignedToName || lead.assignedRepName || '',
    lat: numberOrZero(lead.lat || lead.latitude || lead.location?.lat),
    lng: numberOrZero(lead.lng || lead.longitude || lead.location?.lng),
    source: lead.source || lead.leadSource || '',
    updatedAt: lead.updatedAt || lead.createdAt || null
  };
}

export function normalizeJobForMap(job = {}) {
  return {
    id: job.id || job.jobId || '',
    type: 'job',
    title: job.customerName || job.title || 'Job',
    subtitle: job.service || job.serviceType || job.address || 'Job record',
    status: normalizeStatus(job.status || job.jobStatus),
    companyId: job.companyId || '',
    territoryId: job.territoryId || '',
    regionId: job.regionId || '',
    assignedToUid: job.assignedToUid || job.technicianUid || job.cleanerUid || '',
    assignedToName: job.assignedToName || job.technicianName || job.cleanerName || '',
    lat: numberOrZero(job.lat || job.latitude || job.location?.lat),
    lng: numberOrZero(job.lng || job.longitude || job.location?.lng),
    source: job.source || 'jobs',
    updatedAt: job.updatedAt || job.createdAt || null
  };
}

export async function loadFieldOpsMapData() {
  const [leadsSnap, jobsSnap] = await Promise.all([
    getDocs(collection(db, 'leads')),
    getDocs(collection(db, 'jobs'))
  ]);

  const leads = leadsSnap.docs.map((docItem) => normalizeLeadForMap({ id: docItem.id, ...docItem.data() }));
  const jobs = jobsSnap.docs.map((docItem) => normalizeJobForMap({ id: docItem.id, ...docItem.data() }));

  return {
    leads,
    jobs,
    records: [...leads, ...jobs]
  };
}

export function renderFieldOpsMarkers(map, records = []) {
  if (!window.google?.maps || !map) return [];

  return records
    .filter((record) => record.lat && record.lng)
    .map((record) => {
      const marker = new window.google.maps.Marker({
        map,
        position: { lat: record.lat, lng: record.lng },
        title: record.title,
        label: statusIcon(record.status)
      });

      const info = new window.google.maps.InfoWindow({
        content: '<strong>' + record.title + '</strong><br>' +
          record.type.toUpperCase() + ' • ' + record.status + '<br>' +
          (record.subtitle || '') + '<br>' +
          (record.assignedToName ? 'Assigned: ' + record.assignedToName : 'Unassigned')
      });

      marker.addListener('click', () => info.open({ map, anchor: marker }));
      return marker;
    });
}

export function groupFieldOpsByTerritory(records = []) {
  return records.reduce((groups, record) => {
    const key = record.territoryId || 'unassigned-territory';
    groups[key] = groups[key] || [];
    groups[key].push(record);
    return groups;
  }, {});
}

export function groupFieldOpsByAssignee(records = []) {
  return records.reduce((groups, record) => {
    const key = record.assignedToUid || 'unassigned';
    groups[key] = groups[key] || [];
    groups[key].push(record);
    return groups;
  }, {});
}

window.EvaraFieldOpsMapLayer = {
  normalizeLeadForMap,
  normalizeJobForMap,
  loadFieldOpsMapData,
  renderFieldOpsMarkers,
  groupFieldOpsByTerritory,
  groupFieldOpsByAssignee
};
