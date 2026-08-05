'use strict';

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const {
  cleanString,
  cleanId,
  normalizeRole,
  isActiveProfile,
  canEditStudio,
  canPublishStudio,
  validateGraphSnapshot
} = require('./studio-journal-core');

const db = admin.firestore();
const bucket = admin.storage().bucket();
const FieldValue = admin.firestore.FieldValue;
const CALLABLE_OPTIONS = Object.freeze({ region: 'us-central1', enforceAppCheck: true, cors: true });
const CHANNELS = new Set(['production', 'staging']);
const MAX_RELEASE_BYTES = 8 * 1024 * 1024;

function nowIso() {
  return new Date().toISOString();
}

function assertAuthenticated(request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Authentication is required.');
  return request.auth.uid;
}

function cleanChannel(value) {
  const channel = cleanString(value || 'production', 40).toLowerCase();
  if (!CHANNELS.has(channel)) {
    throw new HttpsError('invalid-argument', 'Release channel must be production or staging.');
  }
  return channel;
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

async function resolveCaller(request, { publish = false } = {}) {
  const uid = assertAuthenticated(request);
  const profileSnapshot = await db.doc(`users/${uid}`).get();
  if (!profileSnapshot.exists) throw new HttpsError('permission-denied', 'A verified user profile is required.');

  const profile = profileSnapshot.data() || {};
  if (!isActiveProfile(profile)) throw new HttpsError('permission-denied', 'This account is not active.');
  if (publish ? !canPublishStudio(profile) : !canEditStudio(profile)) {
    throw new HttpsError(
      'permission-denied',
      publish ? 'Publisher authority is required for Studio releases.' : 'This role cannot read Studio releases.'
    );
  }

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

function expectedReleaseStoragePath(companyId, projectId, releaseId) {
  return `studio-journal/${companyId}/${projectId}/releases/${releaseId}.json`;
}

function assertCompleteRelease(release, caller, projectId, releaseId) {
  if (cleanId(release.companyId, 128) !== caller.companyId || cleanId(release.projectId, 160) !== projectId) {
    throw new HttpsError('permission-denied', 'The release is outside this company workspace.');
  }
  if (cleanId(release.releaseId || releaseId, 200) !== releaseId) {
    throw new HttpsError('data-loss', 'The release identity is inconsistent.');
  }
  if (release.immutable !== true || !release.checkpointId || !release.graphId || !release.graphHash) {
    throw new HttpsError('failed-precondition', 'Only a complete immutable release can be activated or read.');
  }
  const expectedPath = expectedReleaseStoragePath(caller.companyId, projectId, releaseId);
  if (cleanString(release.storagePath, 1000) !== expectedPath) {
    throw new HttpsError('data-loss', 'The release storage path is outside the trusted company namespace.');
  }
  return expectedPath;
}

function releasePointer(release, { channel, slug, seoTitle, seoDescription, activatedAtIso }) {
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
    activatedAtIso
  };
}

function publicRelease(release = {}) {
  return {
    releaseId: cleanId(release.releaseId, 200),
    projectId: cleanId(release.projectId, 160),
    branchId: cleanId(release.branchId, 160),
    graphId: cleanId(release.graphId, 220),
    graphSchemaVersion: cleanString(release.graphSchemaVersion, 80),
    graphHash: cleanString(release.graphHash, 128),
    headRevision: Number(release.headRevision || 0),
    headSequence: Number(release.headSequence || 0),
    checkpointId: cleanId(release.checkpointId, 200),
    immutable: release.immutable === true,
    status: cleanString(release.status, 40),
    channel: cleanString(release.channel, 40),
    slug: cleanString(release.slug, 120),
    seoTitle: cleanString(release.seoTitle, 180),
    seoDescription: cleanString(release.seoDescription, 320),
    activatedAtIso: cleanString(release.activatedAtIso, 64) || null
  };
}

function activationAudit(caller, release, pointer) {
  return {
    action: 'studio_release_activated',
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
  if (!projectId || !releaseId) {
    throw new HttpsError('invalid-argument', 'projectId and releaseId are required.');
  }

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
    assertCompleteRelease(releaseData, caller, projectId, releaseId);

    const companyData = companySnapshot.data() || {};
    const appBuilder = companyData.appBuilder && typeof companyData.appBuilder === 'object'
      ? { ...companyData.appBuilder }
      : {};
    const activeStudioReleases = appBuilder.activeStudioReleases && typeof appBuilder.activeStudioReleases === 'object'
      ? { ...appBuilder.activeStudioReleases }
      : {};
    const companyChannel = activeStudioReleases[channel] && typeof activeStudioReleases[channel] === 'object'
      ? { ...activeStudioReleases[channel] }
      : {};
    const existingPointer = companyChannel[slug] && typeof companyChannel[slug] === 'object'
      ? companyChannel[slug]
      : null;

    if (releaseData.status === 'active') {
      const sameRoute = releaseData.channel === channel && releaseData.slug === slug;
      const samePointer = existingPointer?.releaseId === releaseId
        && existingPointer?.projectId === projectId
        && existingPointer?.graphHash === releaseData.graphHash;
      if (!sameRoute || !samePointer) {
        throw new HttpsError(
          'failed-precondition',
          'An active release cannot be reassigned or used to overwrite a different active route. Prepare a new immutable release.'
        );
      }
      return { idempotent: true, pointer: existingPointer };
    }
    if (releaseData.status !== 'prepared') {
      throw new HttpsError('failed-precondition', 'Only a prepared immutable release can be activated.');
    }

    const activatedAtIso = nowIso();
    const pointer = releasePointer(releaseData, { channel, slug, seoTitle, seoDescription, activatedAtIso });
    companyChannel[slug] = pointer;
    activeStudioReleases[channel] = companyChannel;

    const projectData = projectSnapshot.data() || {};
    const activeReleases = projectData.activeReleases && typeof projectData.activeReleases === 'object'
      ? { ...projectData.activeReleases }
      : {};
    const projectChannel = activeReleases[channel] && typeof activeReleases[channel] === 'object'
      ? { ...activeReleases[channel] }
      : {};
    projectChannel[slug] = pointer;
    activeReleases[channel] = projectChannel;

    transaction.update(release, {
      status: 'active',
      channel,
      slug,
      seoTitle,
      seoDescription,
      activatedAt: FieldValue.serverTimestamp(),
      activatedAtIso,
      activatedByUid: caller.uid,
      activatedByRole: caller.role
    });
    transaction.set(project, {
      activeReleases,
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
    transaction.create(db.collection('audit_logs').doc(), activationAudit(caller, releaseData, pointer));
    return { idempotent: false, pointer };
  });

  return {
    ok: true,
    active: true,
    idempotent: result.idempotent,
    release: publicRelease(result.pointer)
  };
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

  const projectId = cleanId(pointer.projectId, 160);
  const releaseId = cleanId(pointer.releaseId, 200);
  if (!projectId || !releaseId) throw new HttpsError('data-loss', 'The active Studio release pointer is invalid.');

  const releaseSnapshot = await releaseRef(caller.companyId, projectId, releaseId).get();
  if (!releaseSnapshot.exists) throw new HttpsError('data-loss', 'The active Studio release record is missing.');
  const release = { ...releaseSnapshot.data(), releaseId: releaseSnapshot.id };
  const storagePath = assertCompleteRelease(release, caller, projectId, releaseId);

  if (release.status !== 'active' || release.channel !== channel || release.slug !== slug) {
    throw new HttpsError('data-loss', 'The active Studio release route metadata is inconsistent.');
  }
  if (pointer.status !== 'active'
    || pointer.releaseId !== releaseId
    || pointer.projectId !== projectId
    || pointer.graphId !== release.graphId
    || pointer.graphHash !== release.graphHash
    || pointer.checkpointId !== release.checkpointId) {
    throw new HttpsError('data-loss', 'The active Studio release pointer failed its integrity check.');
  }

  const file = bucket.file(storagePath);
  let objectMetadata;
  try {
    [objectMetadata] = await file.getMetadata();
  } catch {
    throw new HttpsError('data-loss', 'The active Studio release payload is unavailable.');
  }
  const objectBytes = Number(objectMetadata?.size || 0);
  if (!Number.isFinite(objectBytes) || objectBytes <= 0 || objectBytes > MAX_RELEASE_BYTES) {
    throw new HttpsError('data-loss', 'The active Studio release payload size is invalid.');
  }
  const customMetadata = objectMetadata?.metadata || {};
  if (customMetadata.companyId !== caller.companyId
    || customMetadata.projectId !== projectId
    || customMetadata.releaseId !== releaseId
    || customMetadata.graphId !== release.graphId
    || customMetadata.graphHash !== release.graphHash) {
    throw new HttpsError('data-loss', 'The active Studio release object metadata is inconsistent.');
  }

  let buffer;
  try {
    [buffer] = await file.download();
  } catch {
    throw new HttpsError('data-loss', 'The active Studio release payload could not be read.');
  }
  if (buffer.length !== objectBytes || buffer.length > MAX_RELEASE_BYTES) {
    throw new HttpsError('data-loss', 'The active Studio release payload changed during retrieval.');
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
    throw new HttpsError('data-loss', 'The active Studio release payload failed its graph hash check.');
  }

  return {
    ok: true,
    active: true,
    channel,
    slug,
    release: publicRelease(release),
    graphSnapshot: validated.graph
  };
});
