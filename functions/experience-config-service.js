'use strict';

const admin = require('firebase-admin');
const { randomUUID } = require('crypto');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');

const db = admin.firestore();
const bucket = admin.storage().bucket();
const FieldValue = admin.firestore.FieldValue;
const CALLABLE_OPTIONS = Object.freeze({ region: 'us-central1', enforceAppCheck: true, cors: true });
const CONFIG_REF = db.doc('experience_configs/global');
const SCHEMA_VERSION = 'evara.experience.v1';
const MAX_ASSET_BYTES = 2 * 1024 * 1024;
const MAX_CONFIG_BYTES = 700 * 1024;

const DEFAULT_CONFIG = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  brand: {
    markUrl: '/assets/brand/evaraos-mark.png',
    appIconUrl: '/assets/brand/evaraos-app-icon.png',
    alt: 'EvaraOS'
  },
  loaderTheme: {
    accent: '#f2172d',
    background: '#eef5fb',
    radius: 34,
    markSize: 42,
    showProgress: true
  },
  loaders: {
    welcome: {
      enabled: true,
      eyebrow: 'EVARAOS',
      title: 'Welcome to Evaraos',
      subtitle: 'Preparing your operating system.',
      minimumMs: 1200
    },
    page: {
      enabled: true,
      label: 'Loading EvaraOS'
    },
    resume: {
      enabled: true,
      title: 'Welcome back to Evaraos',
      subtitle: 'Refreshing your workspace.',
      minimumAwayMs: 45000
    }
  },
  home: {
    kicker: 'Subsidiaries Allocation SaaS',
    title: 'Run companies like a world-class operating system.',
    subtitle: 'Evaraos Inc is built to power multiple subsidiaries, teams, customer portals, leads, jobs, reporting, approvals, and operations from one premium control center. One platform. Multiple categories. Scalable infrastructure.',
    primaryAction: 'Enter Platform',
    secondaryAction: 'Create Account'
  },
  pageOverrides: {}
});

function cleanText(value, max = 1000) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

function cleanId(value, max = 160) {
  return cleanText(value, max)
    .replace(/[^a-zA-Z0-9:._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function bool(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function integer(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function hex(value, fallback) {
  const candidate = cleanText(value, 16);
  return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate.toLowerCase() : fallback;
}

function safeAssetUrl(value, fallback = '') {
  const candidate = cleanText(value, 2200);
  if (!candidate) return fallback;
  if (candidate.startsWith('/assets/')) return candidate;
  try {
    const url = new URL(candidate);
    const expectedPrefix = `/v0/b/${bucket.name}/o/`;
    if (url.protocol !== 'https:' || url.hostname !== 'firebasestorage.googleapis.com') return fallback;
    if (!url.pathname.startsWith(expectedPrefix) || url.searchParams.get('alt') !== 'media') return fallback;
    return url.href;
  } catch {
    return fallback;
  }
}

function normalizeStyle(raw = {}) {
  const glass = ['default', 'soft', 'liquid', 'strong'].includes(raw.glass) ? raw.glass : 'default';
  return {
    radius: integer(raw.radius, 24, 0, 64),
    padding: integer(raw.padding, 18, 0, 72),
    glass
  };
}

function normalizePageOverrides(raw = {}) {
  const output = {};
  Object.entries(raw && typeof raw === 'object' ? raw : {}).slice(0, 60).forEach(([pageKey, page]) => {
    const safePage = cleanId(pageKey, 140);
    if (!safePage) return;
    const text = {};
    const media = {};
    const style = {};
    Object.entries(page?.text || {}).slice(0, 200).forEach(([key, value]) => {
      const safeKey = cleanId(key, 180);
      if (safeKey) text[safeKey] = cleanText(value, 4000);
    });
    Object.entries(page?.media || {}).slice(0, 80).forEach(([key, value]) => {
      const safeKey = cleanId(key, 180);
      const url = safeAssetUrl(value);
      if (safeKey && url) media[safeKey] = url;
    });
    Object.entries(page?.style || {}).slice(0, 200).forEach(([key, value]) => {
      const safeKey = cleanId(key, 180);
      if (safeKey) style[safeKey] = normalizeStyle(value);
    });
    output[safePage] = { text, media, style };
  });
  return output;
}

function normalizeConfig(raw = {}) {
  const fallback = DEFAULT_CONFIG;
  return {
    schemaVersion: SCHEMA_VERSION,
    brand: {
      markUrl: safeAssetUrl(raw?.brand?.markUrl, fallback.brand.markUrl),
      appIconUrl: safeAssetUrl(raw?.brand?.appIconUrl, fallback.brand.appIconUrl),
      alt: cleanText(raw?.brand?.alt || fallback.brand.alt, 120)
    },
    loaderTheme: {
      accent: hex(raw?.loaderTheme?.accent, fallback.loaderTheme.accent),
      background: hex(raw?.loaderTheme?.background, fallback.loaderTheme.background),
      radius: integer(raw?.loaderTheme?.radius, fallback.loaderTheme.radius, 16, 52),
      markSize: integer(raw?.loaderTheme?.markSize, fallback.loaderTheme.markSize, 24, 96),
      showProgress: bool(raw?.loaderTheme?.showProgress, fallback.loaderTheme.showProgress)
    },
    loaders: {
      welcome: {
        enabled: bool(raw?.loaders?.welcome?.enabled, fallback.loaders.welcome.enabled),
        eyebrow: cleanText(raw?.loaders?.welcome?.eyebrow || fallback.loaders.welcome.eyebrow, 80),
        title: cleanText(raw?.loaders?.welcome?.title || fallback.loaders.welcome.title, 180),
        subtitle: cleanText(raw?.loaders?.welcome?.subtitle || fallback.loaders.welcome.subtitle, 320),
        minimumMs: integer(raw?.loaders?.welcome?.minimumMs, fallback.loaders.welcome.minimumMs, 400, 5000)
      },
      page: {
        enabled: bool(raw?.loaders?.page?.enabled, fallback.loaders.page.enabled),
        label: cleanText(raw?.loaders?.page?.label || fallback.loaders.page.label, 160)
      },
      resume: {
        enabled: bool(raw?.loaders?.resume?.enabled, fallback.loaders.resume.enabled),
        title: cleanText(raw?.loaders?.resume?.title || fallback.loaders.resume.title, 180),
        subtitle: cleanText(raw?.loaders?.resume?.subtitle || fallback.loaders.resume.subtitle, 320),
        minimumAwayMs: integer(raw?.loaders?.resume?.minimumAwayMs, fallback.loaders.resume.minimumAwayMs, 10000, 600000)
      }
    },
    home: {
      kicker: cleanText(raw?.home?.kicker || fallback.home.kicker, 180),
      title: cleanText(raw?.home?.title || fallback.home.title, 260),
      subtitle: cleanText(raw?.home?.subtitle || fallback.home.subtitle, 1200),
      primaryAction: cleanText(raw?.home?.primaryAction || fallback.home.primaryAction, 100),
      secondaryAction: cleanText(raw?.home?.secondaryAction || fallback.home.secondaryAction, 100)
    },
    pageOverrides: normalizePageOverrides(raw?.pageOverrides)
  };
}

function assertConfigSize(config) {
  const bytes = Buffer.byteLength(JSON.stringify(config), 'utf8');
  if (bytes > MAX_CONFIG_BYTES) {
    throw new HttpsError('resource-exhausted', 'The experience draft is too large. Remove unused page overrides before saving.', {
      code: 'experience-config-too-large',
      bytes,
      maxBytes: MAX_CONFIG_BYTES
    });
  }
  return bytes;
}

function mergeObjects(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return base;
  const output = { ...(base || {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) output[key] = mergeObjects(output[key], value);
    else output[key] = value;
  }
  return output;
}

function accountIsActive(profile = {}) {
  const status = cleanText(profile.status || 'active', 40).toLowerCase();
  const approval = cleanText(profile.approvalStatus || '', 40).toLowerCase();
  return !['inactive', 'suspended', 'disabled', 'rejected'].includes(status) && approval !== 'rejected';
}

async function resolveOwner(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Authentication is required.');
  const snapshot = await db.doc(`users/${uid}`).get();
  if (!snapshot.exists) throw new HttpsError('permission-denied', 'A verified user profile is required.');
  const profile = snapshot.data() || {};
  const role = cleanText(profile.role, 80).toLowerCase().replace(/[\s-]+/g, '_');
  const elevatedAdmin = role === 'admin' && profile.platformAccess === true;
  if (!accountIsActive(profile) || (!['owner', 'super_admin', 'platform_admin'].includes(role) && !elevatedAdmin)) {
    throw new HttpsError('permission-denied', 'Owner experience authority is required.');
  }
  return {
    uid,
    role,
    email: cleanText(request.auth.token?.email || profile.email, 254),
    name: cleanText(profile.displayName || profile.fullName || profile.name || request.auth.token?.email || uid, 160)
  };
}

function auditRecord(owner, action, extra = {}) {
  return {
    action,
    actorUserId: owner.uid,
    actorEmail: owner.email,
    actorName: owner.name,
    actorRole: owner.role,
    targetCollection: 'experience_configs',
    targetDocumentId: 'global',
    changedFields: extra.changedFields || [],
    notes: cleanText(extra.notes || action, 500),
    metadata: extra.metadata || {},
    source: 'trusted_experience_config_service',
    createdAt: FieldValue.serverTimestamp()
  };
}

exports.getExperienceEditorState = onCall(CALLABLE_OPTIONS, async (request) => {
  await resolveOwner(request);
  const snapshot = await CONFIG_REF.get();
  const data = snapshot.exists ? snapshot.data() || {} : {};
  return {
    ok: true,
    draft: normalizeConfig(data.draft || data.published || DEFAULT_CONFIG),
    published: normalizeConfig(data.published || DEFAULT_CONFIG),
    draftRevision: integer(data.draftRevision, 0, 0, Number.MAX_SAFE_INTEGER),
    publishedVersion: integer(data.publishedVersion, 0, 0, Number.MAX_SAFE_INTEGER),
    publishedAtMs: data.publishedAt?.toMillis?.() || null
  };
});

exports.saveExperienceDraft = onCall(CALLABLE_OPTIONS, async (request) => {
  const owner = await resolveOwner(request);
  const patch = request.data?.patch;
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new HttpsError('invalid-argument', 'A configuration patch is required.');
  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(CONFIG_REF);
    const current = snapshot.exists ? snapshot.data() || {} : {};
    const draft = normalizeConfig(mergeObjects(current.draft || current.published || DEFAULT_CONFIG, patch));
    const bytes = assertConfigSize(draft);
    const revision = integer(current.draftRevision, 0, 0, Number.MAX_SAFE_INTEGER - 1) + 1;
    transaction.set(CONFIG_REF, {
      schemaVersion: SCHEMA_VERSION,
      draft,
      draftRevision: revision,
      draftBytes: bytes,
      draftUpdatedAt: FieldValue.serverTimestamp(),
      draftUpdatedByUid: owner.uid,
      createdAt: current.createdAt || FieldValue.serverTimestamp()
    }, { merge: true });
    transaction.set(db.collection('audit_logs').doc(), auditRecord(owner, 'experience_draft_saved', {
      changedFields: Object.keys(patch).slice(0, 50),
      metadata: { draftRevision: revision, bytes }
    }));
    return { draft, revision, bytes };
  });
  return { ok: true, draft: result.draft, draftRevision: result.revision, bytes: result.bytes };
});

exports.publishExperienceConfig = onCall(CALLABLE_OPTIONS, async (request) => {
  const owner = await resolveOwner(request);
  const expectedDraftRevision = request.data?.expectedDraftRevision;
  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(CONFIG_REF);
    const current = snapshot.exists ? snapshot.data() || {} : {};
    const draftRevision = integer(current.draftRevision, 0, 0, Number.MAX_SAFE_INTEGER);
    if (expectedDraftRevision !== undefined && Number(expectedDraftRevision) !== draftRevision) {
      throw new HttpsError('aborted', 'The experience draft changed before publication.', {
        code: 'experience-draft-conflict',
        expectedDraftRevision: Number(expectedDraftRevision),
        actualDraftRevision: draftRevision
      });
    }
    const published = normalizeConfig(current.draft || current.published || DEFAULT_CONFIG);
    const bytes = assertConfigSize(published);
    const publishedVersion = integer(current.publishedVersion, 0, 0, Number.MAX_SAFE_INTEGER - 1) + 1;
    transaction.set(CONFIG_REF, {
      schemaVersion: SCHEMA_VERSION,
      published,
      publishedVersion,
      publishedBytes: bytes,
      publishedAt: FieldValue.serverTimestamp(),
      publishedByUid: owner.uid
    }, { merge: true });
    transaction.set(db.collection('audit_logs').doc(), auditRecord(owner, 'experience_config_published', {
      changedFields: ['published', 'publishedVersion'],
      metadata: { draftRevision, publishedVersion, bytes }
    }));
    return { published, publishedVersion, draftRevision, bytes };
  });
  return { ok: true, ...result };
});

exports.uploadExperienceAsset = onCall(CALLABLE_OPTIONS, async (request) => {
  const owner = await resolveOwner(request);
  const dataUrl = cleanText(request.data?.dataUrl, 4_000_000);
  const fileName = cleanText(request.data?.fileName || 'experience-asset', 160);
  const match = /^data:image\/(png|jpeg|webp);base64,([a-zA-Z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new HttpsError('invalid-argument', 'Upload a PNG, JPEG, or WebP image.');
  const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > MAX_ASSET_BYTES) throw new HttpsError('invalid-argument', 'Experience images must be smaller than 2 MB.');
  const token = randomUUID();
  const safeName = cleanId(fileName.replace(/\.[^.]+$/, ''), 80) || 'experience-asset';
  const path = `experience-assets/global/${Date.now()}-${safeName}.${extension}`;
  await bucket.file(path).save(buffer, {
    resumable: false,
    contentType: `image/${match[1]}`,
    metadata: {
      cacheControl: 'public,max-age=31536000,immutable',
      metadata: {
        firebaseStorageDownloadTokens: token,
        ownerUid: owner.uid,
        source: 'owner-experience-builder'
      }
    }
  });
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
  await db.collection('audit_logs').add(auditRecord(owner, 'experience_asset_uploaded', {
    changedFields: ['brand.markUrl'],
    metadata: { path, bytes: buffer.length, contentType: `image/${match[1]}` }
  }));
  return { ok: true, url, path, bytes: buffer.length };
});

exports.getPublicExperienceConfig = onRequest({ region: 'us-central1', cors: true }, async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.set('Access-Control-Allow-Headers', 'Content-Type');
    response.status(204).send('');
    return;
  }
  if (request.method !== 'GET') {
    response.set('Allow', 'GET, OPTIONS');
    response.status(405).json({ error: 'method-not-allowed' });
    return;
  }
  try {
    const snapshot = await CONFIG_REF.get();
    const data = snapshot.exists ? snapshot.data() || {} : {};
    const config = normalizeConfig(data.published || DEFAULT_CONFIG);
    const publishedVersion = integer(data.publishedVersion, 0, 0, Number.MAX_SAFE_INTEGER);
    response.set('Cache-Control', 'no-store, max-age=0');
    response.set('Content-Type', 'application/json; charset=utf-8');
    response.status(200).json({
      schemaVersion: SCHEMA_VERSION,
      publishedVersion,
      publishedAtMs: data.publishedAt?.toMillis?.() || null,
      config
    });
  } catch (error) {
    console.error('Public experience configuration failed:', error);
    response.set('Cache-Control', 'no-store, max-age=0');
    response.status(200).json({ schemaVersion: SCHEMA_VERSION, publishedVersion: 0, publishedAtMs: null, config: DEFAULT_CONFIG });
  }
});

exports.DEFAULT_EXPERIENCE_CONFIG = DEFAULT_CONFIG;
exports.normalizeExperienceConfig = normalizeConfig;
exports.assertExperienceConfigSize = assertConfigSize;
