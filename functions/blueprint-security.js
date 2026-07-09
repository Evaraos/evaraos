const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const BLUEPRINT_IDS = new Set([
  'owner',
  'admin',
  'manager',
  'sales',
  'technician',
  'cleaner',
  'customer',
  'vendor'
]);

const STUDIO_EDITORS = new Set(['platform_admin', 'owner', 'admin']);
const STUDIO_PUBLISHERS = new Set(['platform_admin', 'owner']);
const MAX_BLUEPRINT_BYTES = 150 * 1024;
const MAX_NAV_ITEMS = 50;
const MAX_SECTIONS = 50;
const MAX_COMPONENTS_PER_SECTION = 100;

function normalizeRole(value = '') {
  const role = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (role === 'super_admin') return 'platform_admin';
  if (role === 'operations_manager' || role === 'operations_coordinator' || role === 'field_manager' || role === 'sales_manager' || role === 'dispatcher' || role === 'hr' || role === 'hr_manager') return 'manager';
  if (role === 'sales_rep') return 'sales';
  if (role === 'tech' || role === 'lead_technician' || role === 'staff' || role === 'field_staff' || role === 'crew_lead' || role === 'quality_control') return 'technician';
  if (role === 'lead_cleaner') return 'cleaner';
  if (['lead_vendor', 'service_vendor', 'management_program', 'organization', 'organization_owner', 'office_owner', 'branch_owner'].includes(role)) return 'vendor';
  return role;
}

function cleanString(value, maxLength = 160) {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanStringList(value, limit, maxLength = 100) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, limit)
    .map((item) => cleanString(item, maxLength))
    .filter(Boolean);
}

function cleanSections(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_SECTIONS).map((section, index) => {
    const safe = section && typeof section === 'object' && !Array.isArray(section) ? section : {};
    return {
      id: cleanString(safe.id || `section-${index + 1}`, 80),
      title: cleanString(safe.title || `Section ${index + 1}`, 160),
      components: cleanStringList(safe.components, MAX_COMPONENTS_PER_SECTION, 80)
    };
  });
}

function assertBlueprintId(value) {
  const blueprintId = normalizeRole(value);
  if (!BLUEPRINT_IDS.has(blueprintId)) {
    throw new HttpsError('invalid-argument', 'Unsupported blueprint role.');
  }
  return blueprintId;
}

function sanitizeBlueprint(input, blueprintId) {
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const rawBytes = Buffer.byteLength(JSON.stringify(raw), 'utf8');
  if (rawBytes > MAX_BLUEPRINT_BYTES) {
    throw new HttpsError('invalid-argument', 'Blueprint exceeds the maximum allowed size.');
  }

  const role = assertBlueprintId(raw.role || blueprintId);
  if (role !== blueprintId) {
    throw new HttpsError('invalid-argument', 'Blueprint role does not match its identifier.');
  }

  return {
    id: blueprintId,
    name: cleanString(raw.name || `${blueprintId} Blueprint`, 120),
    role,
    navigation: cleanStringList(raw.navigation, MAX_NAV_ITEMS, 100),
    sections: cleanSections(raw.sections),
    permissions: cleanStringList(raw.permissions, 100, 100),
    engineVersion: cleanString(raw.engineVersion || raw.version || 'blueprint-engine-v1', 80)
  };
}

function assertAuthenticated(request) {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }
  return request.auth.uid;
}

function assertActiveProfile(profile = {}) {
  const status = String(profile.status || 'active').trim().toLowerCase();
  const approval = String(profile.approvalStatus || '').trim().toLowerCase();
  if (['inactive', 'suspended', 'disabled', 'rejected'].includes(status) || approval === 'rejected') {
    throw new HttpsError('permission-denied', 'This account is not active.');
  }
}

async function resolveCaller(request, requiredRoles) {
  const uid = assertAuthenticated(request);
  const snapshot = await db.doc(`users/${uid}`).get();
  if (!snapshot.exists) {
    throw new HttpsError('permission-denied', 'A verified user profile is required.');
  }

  const profile = snapshot.data() || {};
  assertActiveProfile(profile);
  const role = normalizeRole(profile.role);

  if (!requiredRoles.has(role)) {
    throw new HttpsError('permission-denied', 'This role cannot perform that blueprint action.');
  }

  const requestedCompanyId = cleanString(request.data?.companyId, 128);
  const profileCompanyId = cleanString(profile.companyId, 128);
  const companyId = role === 'platform_admin' ? requestedCompanyId : profileCompanyId;

  if (!companyId) {
    throw new HttpsError('failed-precondition', 'A company scope is required.');
  }

  if (role !== 'platform_admin' && requestedCompanyId && requestedCompanyId !== profileCompanyId) {
    throw new HttpsError('permission-denied', 'Cross-company blueprint access is not allowed.');
  }

  return {
    uid,
    role,
    companyId,
    email: cleanString(request.auth.token?.email || profile.email, 254),
    name: cleanString(profile.displayName || profile.fullName || profile.name || request.auth.token?.email || uid, 160)
  };
}

function blueprintRef(companyId, blueprintId) {
  return db.doc(`companies/${companyId}/studio_blueprints/${blueprintId}`);
}

function publicState(data = {}) {
  return {
    companyId: data.companyId || '',
    blueprintId: data.blueprintId || '',
    draft: data.draft || null,
    live: data.live || null,
    draftVersion: Number(data.draftVersion || 0),
    liveVersion: Number(data.liveVersion || 0),
    draftStatus: data.draftStatus || 'none',
    updatedAtMs: data.updatedAt?.toMillis?.() || null,
    publishedAtMs: data.publishedAt?.toMillis?.() || null
  };
}

async function writeAudit({ caller, action, blueprintId, version }) {
  await db.collection('audit_logs').add({
    action,
    actorUserId: caller.uid,
    actorEmail: caller.email,
    actorName: caller.name,
    actorRole: caller.role,
    targetCompanyId: caller.companyId,
    targetCollection: 'studio_blueprints',
    targetDocumentId: blueprintId,
    changedFields: ['draft', 'live', 'version'],
    notes: `${action} ${blueprintId} blueprint version ${version}`,
    createdAt: FieldValue.serverTimestamp(),
    source: 'trusted_blueprint_service'
  });
}

exports.saveBlueprintDraft = onCall(
  { region: 'us-central1', enforceAppCheck: true, cors: true },
  async (request) => {
    const caller = await resolveCaller(request, STUDIO_EDITORS);
    const blueprintId = assertBlueprintId(request.data?.blueprintId || request.data?.blueprint?.id);
    const blueprint = sanitizeBlueprint(request.data?.blueprint, blueprintId);
    const ref = blueprintRef(caller.companyId, blueprintId);

    const state = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const current = snapshot.exists ? snapshot.data() || {} : {};
      const draftVersion = Number(current.draftVersion || 0) + 1;

      transaction.set(ref, {
        companyId: caller.companyId,
        blueprintId,
        draft: {
          ...blueprint,
          draftVersion,
          draftStatus: 'draft'
        },
        draftVersion,
        liveVersion: Number(current.liveVersion || 0),
        draftStatus: 'draft',
        updatedAt: FieldValue.serverTimestamp(),
        updatedByUid: caller.uid,
        updatedByRole: caller.role
      }, { merge: true });

      return {
        ...current,
        companyId: caller.companyId,
        blueprintId,
        draft: { ...blueprint, draftVersion, draftStatus: 'draft' },
        draftVersion,
        draftStatus: 'draft'
      };
    });

    await writeAudit({ caller, action: 'blueprint_draft_saved', blueprintId, version: state.draftVersion });
    return { ok: true, state: publicState(state) };
  }
);

exports.publishBlueprint = onCall(
  { region: 'us-central1', enforceAppCheck: true, cors: true },
  async (request) => {
    const caller = await resolveCaller(request, STUDIO_PUBLISHERS);
    const blueprintId = assertBlueprintId(request.data?.blueprintId);
    const ref = blueprintRef(caller.companyId, blueprintId);
    const historyRef = ref.collection('history').doc();

    const state = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) {
        throw new HttpsError('failed-precondition', 'Save a draft before publishing.');
      }

      const current = snapshot.data() || {};
      if (!current.draft) {
        throw new HttpsError('failed-precondition', 'No draft is available to publish.');
      }

      const liveVersion = Number(current.liveVersion || 0) + 1;
      if (current.live) {
        transaction.set(historyRef, {
          companyId: caller.companyId,
          blueprintId,
          live: current.live,
          liveVersion: Number(current.liveVersion || 0),
          archivedAt: FieldValue.serverTimestamp(),
          archivedByUid: caller.uid
        });
      }

      const live = {
        ...current.draft,
        draftStatus: 'published',
        liveVersion
      };

      transaction.set(ref, {
        live,
        liveVersion,
        draftStatus: 'published',
        publishedAt: FieldValue.serverTimestamp(),
        publishedByUid: caller.uid,
        publishedByRole: caller.role,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      return { ...current, live, liveVersion, draftStatus: 'published' };
    });

    await writeAudit({ caller, action: 'blueprint_published', blueprintId, version: state.liveVersion });
    return { ok: true, state: publicState(state) };
  }
);

exports.rollbackBlueprint = onCall(
  { region: 'us-central1', enforceAppCheck: true, cors: true },
  async (request) => {
    const caller = await resolveCaller(request, STUDIO_PUBLISHERS);
    const blueprintId = assertBlueprintId(request.data?.blueprintId);
    const ref = blueprintRef(caller.companyId, blueprintId);
    const history = await ref.collection('history').orderBy('archivedAt', 'desc').limit(1).get();

    if (history.empty) {
      throw new HttpsError('failed-precondition', 'No published version is available to restore.');
    }

    const restoreRef = history.docs[0].ref;
    const state = await db.runTransaction(async (transaction) => {
      const [currentSnapshot, restoreSnapshot] = await Promise.all([
        transaction.get(ref),
        transaction.get(restoreRef)
      ]);

      if (!currentSnapshot.exists || !restoreSnapshot.exists) {
        throw new HttpsError('failed-precondition', 'Blueprint history changed. Try again.');
      }

      const current = currentSnapshot.data() || {};
      const restore = restoreSnapshot.data() || {};
      const nextVersion = Number(current.liveVersion || 0) + 1;

      if (!restore.live) {
        throw new HttpsError('data-loss', 'The selected history record is invalid.');
      }

      const currentHistoryRef = ref.collection('history').doc();
      if (current.live) {
        transaction.set(currentHistoryRef, {
          companyId: caller.companyId,
          blueprintId,
          live: current.live,
          liveVersion: Number(current.liveVersion || 0),
          archivedAt: FieldValue.serverTimestamp(),
          archivedByUid: caller.uid,
          reason: 'rollback'
        });
      }

      const live = {
        ...restore.live,
        draftStatus: 'published',
        liveVersion: nextVersion,
        restoredFromVersion: Number(restore.liveVersion || 0)
      };

      transaction.set(ref, {
        live,
        liveVersion: nextVersion,
        draftStatus: 'published',
        rollbackAt: FieldValue.serverTimestamp(),
        rollbackByUid: caller.uid,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      transaction.delete(restoreRef);

      return { ...current, live, liveVersion: nextVersion, draftStatus: 'published' };
    });

    await writeAudit({ caller, action: 'blueprint_rolled_back', blueprintId, version: state.liveVersion });
    return { ok: true, state: publicState(state) };
  }
);

exports.getBlueprintState = onCall(
  { region: 'us-central1', enforceAppCheck: true, cors: true },
  async (request) => {
    const caller = await resolveCaller(request, STUDIO_EDITORS);
    const requestedId = request.data?.blueprintId;

    if (requestedId) {
      const blueprintId = assertBlueprintId(requestedId);
      const snapshot = await blueprintRef(caller.companyId, blueprintId).get();
      return {
        ok: true,
        state: snapshot.exists
          ? publicState(snapshot.data() || {})
          : publicState({ companyId: caller.companyId, blueprintId })
      };
    }

    const snapshot = await db.collection(`companies/${caller.companyId}/studio_blueprints`).get();
    return {
      ok: true,
      states: snapshot.docs.map((document) => publicState(document.data() || {}))
    };
  }
);
