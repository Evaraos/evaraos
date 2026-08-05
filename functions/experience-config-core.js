'use strict';

const SCHEMA_VERSION = 'evara.experience.v1';
const MAX_ASSET_BYTES = 2 * 1024 * 1024;
const MAX_CONFIG_BYTES = 700 * 1024;
const GLOBAL_PUBLISHER_ROLES = new Set(['owner', 'platform_admin']);
const GLASS_STYLES = new Set(['default', 'soft', 'liquid', 'strong']);

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
      minimumMs: 450
    },
    page: {
      enabled: true,
      label: 'Loading EvaraOS',
      delayMs: 20
    },
    resume: {
      enabled: false,
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

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function cleanText(value, maxLength = 1000) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

function cleanId(value, maxLength = 180) {
  return cleanText(value, maxLength)
    .replace(/[^a-zA-Z0-9:._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeRole(value = '') {
  const role = cleanText(value, 100).toLowerCase().replace(/\s+/g, '_');
  if (role === 'super_admin') return 'platform_admin';
  if (['organization_owner', 'office_owner', 'branch_owner'].includes(role)) return 'owner';
  return role;
}

function isActiveProfile(profile = {}) {
  const status = cleanText(profile.status || 'active', 40).toLowerCase();
  const approval = cleanText(profile.approvalStatus || 'approved', 40).toLowerCase();
  return !['inactive', 'suspended', 'disabled', 'rejected'].includes(status)
    && !['rejected', 'denied', 'suspended'].includes(approval);
}

function canPublishGlobalExperience(profile = {}) {
  return isActiveProfile(profile) && GLOBAL_PUBLISHER_ROLES.has(normalizeRole(profile.role));
}

function boolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function integer(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function hex(value, fallback) {
  const candidate = cleanText(value, 16);
  return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate.toLowerCase() : fallback;
}

function safeAssetUrl(value, { bucketName = '', fallback = '' } = {}) {
  const candidate = cleanText(value, 2200);
  if (!candidate) return fallback;
  if (candidate.startsWith('/assets/') && !candidate.includes('..') && !candidate.includes('\\')) return candidate;
  if (!bucketName) return fallback;
  try {
    const url = new URL(candidate);
    const expectedPrefix = `/v0/b/${bucketName}/o/`;
    if (url.protocol !== 'https:' || url.hostname !== 'firebasestorage.googleapis.com') return fallback;
    if (!url.pathname.startsWith(expectedPrefix) || url.searchParams.get('alt') !== 'media') return fallback;
    return url.href;
  } catch {
    return fallback;
  }
}

function normalizeStyle(raw = {}) {
  return {
    radius: integer(raw.radius, 24, 0, 64),
    padding: integer(raw.padding, 18, 0, 72),
    glass: GLASS_STYLES.has(raw.glass) ? raw.glass : 'default'
  };
}

function normalizePageOverrides(raw = {}, { bucketName = '' } = {}) {
  const output = {};
  const pages = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  Object.entries(pages).slice(0, 60).forEach(([pageKey, page]) => {
    const safePage = cleanId(pageKey, 140);
    if (!safePage || !page || typeof page !== 'object' || Array.isArray(page)) return;
    const text = {};
    const media = {};
    const style = {};

    Object.entries(page.text || {}).slice(0, 200).forEach(([slotKey, value]) => {
      const safeSlot = cleanId(slotKey, 180);
      if (safeSlot) text[safeSlot] = cleanText(value, 4000);
    });
    Object.entries(page.media || {}).slice(0, 80).forEach(([slotKey, value]) => {
      const safeSlot = cleanId(slotKey, 180);
      const url = safeAssetUrl(value, { bucketName });
      if (safeSlot && url) media[safeSlot] = url;
    });
    Object.entries(page.style || {}).slice(0, 200).forEach(([slotKey, value]) => {
      const safeSlot = cleanId(slotKey, 180);
      if (safeSlot) style[safeSlot] = normalizeStyle(value);
    });

    output[safePage] = { text, media, style };
  });
  return output;
}

function normalizeConfig(raw = {}, { bucketName = '' } = {}) {
  const fallback = DEFAULT_CONFIG;
  return {
    schemaVersion: SCHEMA_VERSION,
    brand: {
      markUrl: safeAssetUrl(raw?.brand?.markUrl, { bucketName, fallback: fallback.brand.markUrl }),
      appIconUrl: safeAssetUrl(raw?.brand?.appIconUrl, { bucketName, fallback: fallback.brand.appIconUrl }),
      alt: cleanText(raw?.brand?.alt || fallback.brand.alt, 120)
    },
    loaderTheme: {
      accent: hex(raw?.loaderTheme?.accent, fallback.loaderTheme.accent),
      background: hex(raw?.loaderTheme?.background, fallback.loaderTheme.background),
      radius: integer(raw?.loaderTheme?.radius, fallback.loaderTheme.radius, 16, 52),
      markSize: integer(raw?.loaderTheme?.markSize, fallback.loaderTheme.markSize, 24, 96),
      showProgress: boolean(raw?.loaderTheme?.showProgress, fallback.loaderTheme.showProgress)
    },
    loaders: {
      welcome: {
        enabled: boolean(raw?.loaders?.welcome?.enabled, fallback.loaders.welcome.enabled),
        eyebrow: cleanText(raw?.loaders?.welcome?.eyebrow || fallback.loaders.welcome.eyebrow, 80),
        title: cleanText(raw?.loaders?.welcome?.title || fallback.loaders.welcome.title, 180),
        subtitle: cleanText(raw?.loaders?.welcome?.subtitle || fallback.loaders.welcome.subtitle, 320),
        minimumMs: integer(raw?.loaders?.welcome?.minimumMs, fallback.loaders.welcome.minimumMs, 250, 2000)
      },
      page: {
        enabled: boolean(raw?.loaders?.page?.enabled, fallback.loaders.page.enabled),
        label: cleanText(raw?.loaders?.page?.label || fallback.loaders.page.label, 160),
        delayMs: integer(raw?.loaders?.page?.delayMs, fallback.loaders.page.delayMs, 0, 250)
      },
      resume: {
        enabled: boolean(raw?.loaders?.resume?.enabled, fallback.loaders.resume.enabled),
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
    pageOverrides: normalizePageOverrides(raw?.pageOverrides, { bucketName })
  };
}

function mergeObjects(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return clone(base);
  const output = { ...(base || {}) };
  Object.entries(patch).forEach(([key, value]) => {
    output[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? mergeObjects(output[key], value)
      : clone(value);
  });
  return output;
}

function configBytes(config) {
  return Buffer.byteLength(JSON.stringify(config), 'utf8');
}

function assertConfigSize(config) {
  const bytes = configBytes(config);
  if (bytes > MAX_CONFIG_BYTES) {
    const error = new RangeError('The Experience configuration exceeds the maximum allowed size.');
    error.code = 'experience-config-too-large';
    error.bytes = bytes;
    error.maxBytes = MAX_CONFIG_BYTES;
    throw error;
  }
  return bytes;
}

function detectImageType(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) return '';
  if (buffer.length >= 8
    && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
    && buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a) return 'png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (buffer.length >= 12
    && buffer.toString('ascii', 0, 4) === 'RIFF'
    && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return '';
}

module.exports = {
  SCHEMA_VERSION,
  MAX_ASSET_BYTES,
  MAX_CONFIG_BYTES,
  GLOBAL_PUBLISHER_ROLES,
  DEFAULT_CONFIG,
  clone,
  cleanText,
  cleanId,
  normalizeRole,
  isActiveProfile,
  canPublishGlobalExperience,
  safeAssetUrl,
  normalizeStyle,
  normalizePageOverrides,
  normalizeConfig,
  mergeObjects,
  configBytes,
  assertConfigSize,
  detectImageType
};
