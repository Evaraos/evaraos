'use strict';

const admin = require('firebase-admin');
const { randomUUID } = require('crypto');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const {
  SCHEMA_VERSION,
  MAX_ASSET_BYTES,
  DEFAULT_CONFIG,
  cleanText,
  cleanId,
  normalizeRole,
  canPublishGlobalExperience,
  normalizeConfig,
  mergeObjects,
  assertConfigSize,
  detectImageType
} = require('./experience-config-core');

const db = admin.firestore();
const bucket = admin.storage().bucket();
const FieldValue = admin.firestore.FieldValue;
const CALLABLE_OPTIONS = Object.freeze({ region: 'us-central1', enforceAppCheck: true, cors: true });
const CONFIG_REF = db.doc('experience_configs/global');
const DATA_URL_LIMIT = 3_000_000;

function integer(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function callableError(error) {
  if (error instanceof HttpsError) return error;
  if (error?.code === 'experience-config-too-large') {
    return new HttpsError('resource-exhausted', error.message, {
      code: error.code,
      bytes: error.bytes,
      maxBytes: error.maxBytes
    });
  }
  console.error('Experience configuration request failed:', error);
  return new HttpsError('internal', 'The Experience configuration request could not be completed.');
}

async function resolvePublisher(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Authentication is required.');
  const snapshot = await db.doc(`users/${uid}`).get();
  if (!snapshot.exists) throw new HttpsError('permission-denied', 'A verified user profile is required.');
  const profile = snapshot.data() || {};
  if (!canPublishGlobalExperience(profile)) {
    throw new HttpsError('permission-denied', 'Global Experience publishing requires owner authority.');
  }
  return {
    uid,
    role: normalizeRole(profile.role),
    email: cleanText(request.auth.token?.email || profile.email, 254),
    name: cleanText(profile.displayName || profile.fullName || profile.name || request.auth.token?.email || uid, 160)
  };
}

function auditRecord(publisher, action, { changedFields = [], metadata = {}, notes = '' } = {}) {
  return {
    action,
    actorUserId: publisher.uid,
    actorEmail: publisher.email,
    actorName: publisher.name,
    actorRole: publisher.role,
    targetCollection: 'experience_configs',
    targetDocumentId: 'global',
    changedFields: changedFields.slice(0, 50),
    notes: cleanText(notes || action, 500),
    metadata,
    source: 'trusted_experience_config_service',
    createdAt: FieldValue.serverTimestamp()
  };
}

function normalizedState(data = {}) {
  return {
    draft: normalizeConfig(data.draft || data.published || DEFAULT_CONFIG, { bucketName: bucket.name }),
    published: normalizeConfig(data.published || DEFAULT_CONFIG, { bucketName: bucket.name }),
    draftRevision: integer(data.draftRevision),
    publishedVersion: integer(data.publishedVersion),
    publishedAtMs: data.publishedAt?.toMillis?.() || null
  };
}

exports.getExperienceEditorState = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    await resolvePublisher(request);
    const snapshot = await CONFIG_REF.get();
    return { ok: true, ...normalizedState(snapshot.exists ? snapshot.data() || {} : {}) };
  } catch (error) {
    throw callableError(error);
  }
});

exports.saveExperienceDraft = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const publisher = await resolvePublisher(request);
    const patch = request.data?.patch;
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      throw new HttpsError('invalid-argument', 'A configuration patch is required.');
    }
    const expectedDraftRevision = request.data?.expectedDraftRevision;
    if (!Number.isInteger(expectedDraftRevision) || expectedDraftRevision < 0) {
      throw new HttpsError('invalid-argument', 'A nonnegative integer expectedDraftRevision is required.');
    }
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(CONFIG_REF);
      const current = snapshot.exists ? snapshot.data() || {} : {};
      const currentRevision = integer(current.draftRevision);
      if (expectedDraftRevision !== currentRevision) {
        throw new HttpsError('aborted', 'The Experience draft changed before this save.', {
          code: 'experience-draft-conflict',
          expectedDraftRevision,
          actualDraftRevision: currentRevision
        });
      }
      const merged = mergeObjects(current.draft || current.published || DEFAULT_CONFIG, patch);
      const draft = normalizeConfig(merged, { bucketName: bucket.name });
      const bytes = assertConfigSize(draft);
      const draftRevision = currentRevision + 1;
      transaction.set(CONFIG_REF, {
        schemaVersion: SCHEMA_VERSION,
        draft,
        draftRevision,
        draftBytes: bytes,
        draftUpdatedAt: FieldValue.serverTimestamp(),
        draftUpdatedByUid: publisher.uid,
        createdAt: current.createdAt || FieldValue.serverTimestamp()
      }, { merge: true });
      transaction.set(db.collection('audit_logs').doc(), auditRecord(publisher, 'experience_draft_saved', {
        changedFields: Object.keys(patch),
        metadata: { draftRevision, bytes }
      }));
      return { draft, draftRevision, bytes };
    });
    return { ok: true, ...result };
  } catch (error) {
    throw callableError(error);
  }
});

exports.publishExperienceConfig = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const publisher = await resolvePublisher(request);
    const expectedDraftRevision = request.data?.expectedDraftRevision;
    if (!Number.isInteger(expectedDraftRevision) || expectedDraftRevision < 0) {
      throw new HttpsError('invalid-argument', 'A nonnegative integer expectedDraftRevision is required.');
    }
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(CONFIG_REF);
      const current = snapshot.exists ? snapshot.data() || {} : {};
      const draftRevision = integer(current.draftRevision);
      if (expectedDraftRevision !== draftRevision) {
        throw new HttpsError('aborted', 'The Experience draft changed before publication.', {
          code: 'experience-draft-conflict',
          expectedDraftRevision,
          actualDraftRevision: draftRevision
        });
      }
      const published = normalizeConfig(current.draft || current.published || DEFAULT_CONFIG, { bucketName: bucket.name });
      const bytes = assertConfigSize(published);
      const publishedVersion = integer(current.publishedVersion) + 1;
      transaction.set(CONFIG_REF, {
        schemaVersion: SCHEMA_VERSION,
        published,
        publishedVersion,
        publishedBytes: bytes,
        publishedAt: FieldValue.serverTimestamp(),
        publishedByUid: publisher.uid
      }, { merge: true });
      transaction.set(db.collection('audit_logs').doc(), auditRecord(publisher, 'experience_config_published', {
        changedFields: ['published', 'publishedVersion'],
        metadata: { draftRevision, publishedVersion, bytes }
      }));
      return { published, draftRevision, publishedVersion, bytes };
    });
    return { ok: true, ...result };
  } catch (error) {
    throw callableError(error);
  }
});

exports.uploadExperienceAsset = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const publisher = await resolvePublisher(request);
    const dataUrl = request.data?.dataUrl;
    if (typeof dataUrl !== 'string' || !dataUrl.length || dataUrl.length > DATA_URL_LIMIT) {
      throw new HttpsError('invalid-argument', 'Upload a PNG, JPEG, or WebP image smaller than 2 MB.');
    }
    const match = /^data:image\/(png|jpeg|webp);base64,([a-zA-Z0-9+/=]+)$/.exec(dataUrl);
    if (!match) throw new HttpsError('invalid-argument', 'Upload a PNG, JPEG, or WebP image.');
    const declaredType = match[1];
    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length || buffer.length > MAX_ASSET_BYTES) {
      throw new HttpsError('invalid-argument', 'Experience images must be smaller than 2 MB.');
    }
    const detectedType = detectImageType(buffer);
    if (!detectedType || detectedType !== declaredType) {
      throw new HttpsError('invalid-argument', 'The uploaded image content does not match its declared type.');
    }

    const safeName = cleanId(String(request.data?.fileName || 'experience-asset').replace(/\.[^.]+$/, ''), 80) || 'experience-asset';
    const extension = detectedType === 'jpeg' ? 'jpg' : detectedType;
    const storagePath = `experience-assets/global/${Date.now()}-${safeName}.${extension}`;
    const token = randomUUID();
    await bucket.file(storagePath).save(buffer, {
      resumable: false,
      contentType: detectedType === 'jpeg' ? 'image/jpeg' : `image/${detectedType}`,
      metadata: {
        cacheControl: 'public,max-age=31536000,immutable',
        metadata: {
          firebaseStorageDownloadTokens: token,
          ownerUid: publisher.uid,
          source: 'owner-experience-builder'
        }
      }
    });
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
    await db.collection('audit_logs').add(auditRecord(publisher, 'experience_asset_uploaded', {
      changedFields: ['experienceAsset'],
      metadata: { storagePath, bytes: buffer.length, contentType: detectedType }
    }));
    return { ok: true, url, storagePath, bytes: buffer.length };
  } catch (error) {
    throw callableError(error);
  }
});

exports.getPublicExperienceConfig = onRequest({ region: 'us-central1', cors: false }, async (request, response) => {
  if (request.method !== 'GET') {
    response.set('Allow', 'GET');
    response.status(405).json({ error: 'method-not-allowed' });
    return;
  }
  try {
    const snapshot = await CONFIG_REF.get();
    const data = snapshot.exists ? snapshot.data() || {} : {};
    const config = normalizeConfig(data.published || DEFAULT_CONFIG, { bucketName: bucket.name });
    response.set('Cache-Control', 'public,max-age=60,stale-while-revalidate=300');
    response.set('Content-Type', 'application/json; charset=utf-8');
    response.set('X-Content-Type-Options', 'nosniff');
    response.status(200).json({
      schemaVersion: SCHEMA_VERSION,
      publishedVersion: integer(data.publishedVersion),
      publishedAtMs: data.publishedAt?.toMillis?.() || null,
      config
    });
  } catch (error) {
    console.error('Public Experience configuration failed:', error);
    response.set('Cache-Control', 'no-store');
    response.status(503).json({ error: 'experience-config-unavailable' });
  }
});
