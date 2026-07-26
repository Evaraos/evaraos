'use strict';

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const {
  cleanString,
  cleanId,
  normalizeRole,
  isActiveProfile,
  canPublishStudio,
  validateGraphSnapshot
} = require('./studio-journal-core');

const db = admin.firestore();
const bucket = admin.storage().bucket();
const FieldValue = admin.firestore.FieldValue;
const CALLABLE_OPTIONS = Object.freeze({ region: 'us-central1', enforceAppCheck: true, cors: true });
const CHANNELS = new Set(['production', 'staging']);

function nowIso() {
  return new Date().toISOString();
}

function cleanSlug(value) {
  const slug = cleanString(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  if (!slug) throw new HttpsError('invalid-argument', 'A route slug is required.');
  return slug;
}

function cleanChannel(value) {
  const channel = cleanString(value || 'production', 40).toLowerCase();
  if (!CHANNELS.has(channel)) throw new HttpsError('invalid-argument', 'Release channel must be production or staging.');
  return channel;
}

function assertAuthenticated(request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Authentication is required.');
  return request.auth.uid;
}

async function resolveCaller(request, { publish = false } = {}) {
  const uid = assertAuthenticated(request);
  const profileSnapshot = await db.doc(`users/${uid}`).get();
  if (!profileSnapshot.exists) throw new HttpsError('permission-denied', 'A verified user profile is required.');
  const profile = profileSnapshot.data() || {};
  if (!isActiveProfile(profile)) throw new HttpsError('permission-denied', 'This account is not active.');
  if (publish && !canPublishStudio(profile)) throw new HttpsError('permission-denied', 'Publisher authority is required.');

  const role = normalizeRole(profile.role);
  const requestedCompanyId = cleanId(request.data?.companyId, 128);
  const profileCompanyId = cleanId(profile.companyId, 128);
  const companyId = role === 'platform_admin' ? (requestedCompanyId || profileCompanyId) : profileCompanyId;
  if (!companyId) throw new HttpsError('failed-precondition', 'A company scope is required.');
  if (role !== 'platform_admin' && requestedCompanyId && requestedCompanyId !== profileCompanyId) {
    throw new HttpsError('permission-denied', 'Cross-company Studio access is not allowed.');
  }

  return {
    uid,
    role,
    companyId,
    email: cleanString(request.auth.token?.email || profile.email, 254),
    name: cleanString(profile.displayName || profile.fullName || profile.name || request.auth.token?.email || uid, 160)
  };
}

function companyRef(companyId) {
  return db.doc(`companies/${companyId}`);
}

function projectRef(companyId, projectId) {
  return companyRef(companyId).collection('studio_projects').doc(projectId);
}

function releaseRef(companyId, projectId, releaseId) {
  return projectRef(companyId, projectId).collection('releases').doc(releaseId);
}

function activePointer(release, { channel, slug, seoTitle, seoDescription }) {
  return {
    releaseId: release.releaseId,
    projectId: release.projectId,
    branchId: release.branchId,
    graphId: release.graphId,
    graphSchemaVersion: release.graphSchemaVersion,
    graphHash: release.graphHash,
    headRevision: Number(release.headRevision || 0),
    headSequence: Number(release.headSequence || 0),
    checkpointId: release.checkpointId,
    storagePath: release.storagePath,
    channel,
    slug,
    seoTitle,
    seoDescription,
    status: 'active',
    activatedAtIso: nowIso()
  };
}

function auditRecord(caller, action, release, pointer) {
  return {
    action,
    actorUserId: caller.uid,
    actorEmail: caller.email,
    actorName: caller.name,
    actorRole: caller.role,
    companyId: caller.companyId,
    targetCompanyId: caller.companyId,
    targetCollection: 'studio_releases',
    targetDocumentId: release.releaseId,
    changedFields: ['status', 'channel', 'slug', 'activeStudioReleases'],
    notes: `Activated Studio release ${release.releaseId} for ${pointer.channel}/${pointer.slug}`,
    metadata: {
      projectId: release.projectId,
      branchId: release.branchId,
      graphId: release.graphId,
      checkpointId: release.checkpointId,
      graphHash: release.graphHash,
      channel: pointer.channel,
      slug: pointer.slug
    },
    source: 'trusted_studio_release_runtime',
    createdAt: FieldValue.serverTimestamp()
  };
}

exports.activateStudioRelease = onCall(CALLABLE_OPTIONS, async (request) => {
  const caller = await resolveCaller(request, { publish: true });
  const projectId = cleanId(request.data?.projectId, 160);
  const releaseId = cleanId(request.data?.releaseId, 200);
  if (!projectId || !releaseId) throw new HttpsError('invalid-argument', 'projectId and releaseId are required.');
  const channel = cleanChannel(request.data?.channel);
  const slug = cleanSlug(request.data?.slug);
  const seoTitle = cleanString(request.data?.seoTitle, 180);
  const seoDescription = cleanString(request.data?.seoDescription, 320);

  const company = companyRef(caller.companyId);
  const project = projectRef(caller.companyId, projectId);
  const release = releaseRef(caller.companyId, projectId, releaseId);

  const result = await db.runTransaction(async (transaction) => {
    const [companySnapshot, projectSnapshot, releaseSnapshot] = await Promise.all([
      transaction.get(company),
      transaction.get(project),
      transaction.get(release)
    ]);
    if (!companySnapshot.exists) throw new HttpsError('not-found', 'Company workspace not found.');
    if (!projectSnapshot.exists) throw new HttpsError('not-found', 'Studio project not found.');
    if (!releaseSnapshot.exists) throw new HttpsError('not-found', 'Prepared Studio release not found.');

    const releaseData = { ...releaseSnapshot.data(), releaseId: releaseSnapshot.id };
    if (releaseData.companyId !== caller.companyId || releaseData.projectId !== projectId) {
      throw new HttpsError('permission-denied', 'The release is outside this company workspace.');
    }
    if (releaseData.immutable !== true || !releaseData.storagePath || !releaseData.graphHash || !releaseData.checkpointId) {
      throw new HttpsError('failed-precondition', 'Only a complete immutable release can be activated.');
    }
    if (!['prepared', 'active'].includes(releaseData.status)) {
      throw new HttpsError('failed-precondition', 'This release is not eligible for activation.');
    }

    const pointer = activePointer(releaseData, { channel, slug, seoTitle, seoDescription });
    const companyData = companySnapshot.data() || {};
    const appBuilder = companyData.appBuilder && typeof companyData.appBuilder === 'object' ? companyData.appBuilder : {};
    const activeStudioReleases = appBuilder.activeStudioReleases && typeof appBuilder.activeStudioReleases === 'object'
      ? { ...appBuilder.activeStudioReleases }
      : {};
    const companyChannel = activeStudioReleases[channel] && typeof activeStudioReleases[channel] === 'object'
      ? { ...activeStudioReleases[channel] }
      : {};
    companyChannel[slug] = pointer;
    activeStudioReleases[channel] = companyChannel;

    const projectData = projectSnapshot.data() || {};
    const projectActive = projectData.activeReleases && typeof projectData.activeReleases === 'object'
      ? { ...projectData.activeReleases }
      : {};
    const projectChannel = projectActive[channel] && typeof projectActive[channel] === 'object'
      ? { ...projectActive[channel] }
      : {};
    projectChannel[slug] = pointer;
    projectActive[channel] = projectChannel;

    transaction.update(release, {
      status: 'active',
      channel,
      slug,
      seoTitle,
      seoDescription,
      activatedAt: FieldValue.serverTimestamp(),
      activatedAtIso: pointer.activatedAtIso,
      activatedByUid: caller.uid,
      activatedByRole: caller.role
    });
    transaction.set(project, {
      activeReleases: projectActive,
      activeReleaseId: releaseId,
      updatedAt: FieldValue.serverTimestamp(),
      updatedByUid: caller.uid
    }, { merge: true });
    transaction.set(company, {
      appBuilder: {
        ...appBuilder,
        activeStudioReleases,
        activeStudioReleaseUpdatedAtMs: Date.now(),
        activeStudioReleaseUpdatedBy: caller.uid
      },
      appBuilderUpdatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    transaction.create(db.collection('audit_logs').doc(), auditRecord(caller, 'studio_release_activated', releaseData, pointer));

    return { pointer, idempotent: releaseData.status === 'active' && releaseData.channel === channel && releaseData.slug === slug };
  });

  return { ok: true, active: true, idempotent: result.idempotent, release: result.pointer };
});

exports.getPublishedStudioRelease = onCall(CALLABLE_OPTIONS, async (request) => {
  const caller = await resolveCaller(request);
  const channel = cleanChannel(request.data?.channel);
  const slug = cleanSlug(request.data?.slug);
  const companySnapshot = await companyRef(caller.companyId).get();
  if (!companySnapshot.exists) throw new HttpsError('not-found', 'Company workspace not found.');

  const pointer = companySnapshot.data()?.appBuilder?.activeStudioReleases?.[channel]?.[slug] || null;
  if (!pointer?.releaseId || !pointer?.projectId) {
    return { ok: true, active: false, channel, slug, release: null, graphSnapshot: null };
  }

  const releaseSnapshot = await releaseRef(caller.companyId, cleanId(pointer.projectId, 160), cleanId(pointer.releaseId, 200)).get();
  if (!releaseSnapshot.exists) throw new HttpsError('data-loss', 'The active Studio release record is missing.');
  const release = { ...releaseSnapshot.data(), releaseId: releaseSnapshot.id };
  if (release.status !== 'active' || release.channel !== channel || release.slug !== slug || release.immutable !== true) {
    throw new HttpsError('data-loss', 'The active Studio release pointer is inconsistent.');
  }
  if (release.companyId !== caller.companyId || release.projectId !== pointer.projectId || release.graphHash !== pointer.graphHash) {
    throw new HttpsError('data-loss', 'The active Studio release tenant or integrity metadata is inconsistent.');
  }

  let buffer;
  try {
    [buffer] = await bucket.file(cleanString(release.storagePath, 1000)).download();
  } catch {
    throw new HttpsError('data-loss', 'The active Studio release payload is unavailable.');
  }

  let parsed;
  try {
    parsed = JSON.parse(buffer.toString('utf8'));
  } catch {
    throw new HttpsError('data-loss', 'The active Studio release payload is invalid JSON.');
  }

  let validated;
  try {
    validated = validateGraphSnapshot(parsed, {
      graphId: release.graphId,
      revision: Number(release.headRevision || 0)
    });
  } catch (error) {
    throw new HttpsError('data-loss', error.message);
  }
  if (validated.graphHash !== release.graphHash || validated.graphHash !== pointer.graphHash) {
    throw new HttpsError('data-loss', 'The active Studio release payload failed its integrity check.');
  }

  return {
    ok: true,
    active: true,
    channel,
    slug,
    release: {
      releaseId: release.releaseId,
      projectId: release.projectId,
      branchId: release.branchId,
      graphId: release.graphId,
      graphSchemaVersion: release.graphSchemaVersion,
      graphHash: release.graphHash,
      headRevision: Number(release.headRevision || 0),
      headSequence: Number(release.headSequence || 0),
      checkpointId: release.checkpointId,
      immutable: true,
      status: 'active',
      channel,
      slug,
      seoTitle: release.seoTitle || '',
      seoDescription: release.seoDescription || '',
      activatedAtIso: release.activatedAtIso || pointer.activatedAtIso || null
    },
    graphSnapshot: validated.graph
  };
});
