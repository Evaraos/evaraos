import {
  auth,
  db,
  collection,
  query,
  where,
  getDocs,
  onAuthStateChanged,
  hydrateUserProfile
} from './firebase.js';

const PLATFORM_ROLES = new Set(['owner', 'super_admin']);
const MANAGER_ROLES = new Set([
  'admin',
  'manager',
  'operations_manager',
  'operations_coordinator',
  'field_manager',
  'sales_manager',
  'dispatcher',
  'hr',
  'hr_manager'
]);

function clean(value = '') {
  return String(value || '').trim();
}

function normalizeRole(value = '') {
  return clean(value).toLowerCase();
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

function waitForAuthenticatedUser(timeoutMs = 8000) {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);

  return new Promise((resolve, reject) => {
    let unsubscribe = null;
    const timeout = window.setTimeout(() => {
      unsubscribe?.();
      reject(new Error('Map access requires an authenticated session.'));
    }, timeoutMs);

    unsubscribe = onAuthStateChanged(auth, (user) => {
      window.clearTimeout(timeout);
      unsubscribe?.();

      if (!user) {
        reject(new Error('Map access requires an authenticated session.'));
        return;
      }

      resolve(user);
    }, (error) => {
      window.clearTimeout(timeout);
      unsubscribe?.();
      reject(error);
    });
  });
}

export async function resolveFieldOpsMapAccessContext(options = {}) {
  const user = options.user || await waitForAuthenticatedUser();
  const profile = options.profile || await hydrateUserProfile(user, { requireVerified: true });

  if (!profile) {
    throw new Error('A verified EvaraOS user profile is required for map access.');
  }

  const role = normalizeRole(profile.role);
  const companyId = clean(profile.companyId);
  const uid = clean(user?.uid || profile.uid || profile.id);

  if (!uid) throw new Error('Map access could not resolve the current user.');

  if (PLATFORM_ROLES.has(role)) {
    return { uid, role, companyId, scope: 'platform' };
  }

  if (MANAGER_ROLES.has(role)) {
    if (!companyId) {
      throw new Error('Map access requires an assigned company.');
    }
    return { uid, role, companyId, scope: 'company' };
  }

  if (role === 'customer') {
    return { uid, role, companyId, scope: 'customer' };
  }

  return { uid, role, companyId, scope: 'assigned' };
}

export function buildFieldOpsCollectionQueries(collectionName, context = {}) {
  const source = collection(db, collectionName);

  if (context.scope === 'platform') return [source];

  if (context.scope === 'company') {
    return [query(source, where('companyId', '==', context.companyId))];
  }

  if (context.scope === 'customer') {
    return [
      query(source, where('customerUid', '==', context.uid)),
      query(source, where('customerId', '==', context.uid)),
      query(source, where('userId', '==', context.uid))
    ];
  }

  return [
    query(source, where('assignedToUid', '==', context.uid)),
    query(source, where('assignedTo', 'array-contains', context.uid)),
    query(source, where('assignedTeamIds', 'array-contains', context.uid)),
    query(source, where('assignedRep', '==', context.uid)),
    query(source, where('assignedRep', 'array-contains', context.uid)),
    query(source, where('staffClaimedBy', '==', context.uid))
  ];
}

function mergeSnapshots(snapshots = [], normalizer) {
  const records = new Map();

  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((docItem) => {
      records.set(docItem.id, normalizer({ id: docItem.id, ...docItem.data() }));
    });
  });

  return [...records.values()];
}

async function loadScopedCollection(collectionName, context, normalizer) {
  const queryRefs = buildFieldOpsCollectionQueries(collectionName, context);
  const snapshots = await Promise.all(queryRefs.map((queryRef) => getDocs(queryRef)));
  return mergeSnapshots(snapshots, normalizer);
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

export async function loadFieldOpsMapData(options = {}) {
  const context = options.context || await resolveFieldOpsMapAccessContext(options);
  const [leads, jobs] = await Promise.all([
    loadScopedCollection('leads', context, normalizeLeadForMap),
    loadScopedCollection('jobs', context, normalizeJobForMap)
  ]);

  return {
    context,
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
  resolveFieldOpsMapAccessContext,
  buildFieldOpsCollectionQueries,
  normalizeLeadForMap,
  normalizeJobForMap,
  loadFieldOpsMapData,
  renderFieldOpsMarkers,
  groupFieldOpsByTerritory,
  groupFieldOpsByAssignee
};
