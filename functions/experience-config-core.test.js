'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_CONFIG,
  MAX_CONFIG_BYTES,
  normalizeRole,
  canPublishGlobalExperience,
  safeAssetUrl,
  normalizeConfig,
  mergeObjects,
  assertConfigSize,
  detectImageType
} = require('./experience-config-core');

const bucketName = 'evaraos-web.firebasestorage.app';

test('global publishing is limited to active owner and platform authority', () => {
  assert.equal(canPublishGlobalExperience({ role: 'owner', status: 'active', approvalStatus: 'approved' }), true);
  assert.equal(canPublishGlobalExperience({ role: 'platform_admin', status: 'active' }), true);
  assert.equal(canPublishGlobalExperience({ role: 'super_admin', status: 'active' }), true);
  assert.equal(canPublishGlobalExperience({ role: 'admin', studioPublisher: true, status: 'active' }), false);
  assert.equal(canPublishGlobalExperience({ role: 'owner', status: 'suspended' }), false);
  assert.equal(normalizeRole('Super Admin'), 'platform_admin');
});

test('asset URLs are restricted to local assets and the configured Firebase Storage bucket', () => {
  const storageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/experience-assets%2Fglobal%2Fmark.png?alt=media&token=test`;
  assert.equal(safeAssetUrl('/assets/brand/evaraos-mark.png', { bucketName }), '/assets/brand/evaraos-mark.png');
  assert.equal(safeAssetUrl(storageUrl, { bucketName }), storageUrl);
  assert.equal(safeAssetUrl('/assets/../private.txt', { bucketName, fallback: 'fallback' }), 'fallback');
  assert.equal(safeAssetUrl('https://example.com/logo.png', { bucketName, fallback: 'fallback' }), 'fallback');
});

test('normalization keeps only bounded registered page slots and approved styles', () => {
  const config = normalizeConfig({
    loaderTheme: { accent: '#ABCDEF', radius: 999, markSize: 1 },
    loaders: {
      welcome: { minimumMs: 99999 },
      page: { delayMs: -100 },
      resume: { enabled: true }
    },
    pageOverrides: {
      '/dashboard.html': {
        text: { 'hero.title': ' Updated title ', 'bad slot!': 'Normalized key' },
        media: { 'hero.image': 'https://example.com/not-allowed.png' },
        style: { 'hero.card': { radius: 999, padding: -5, glass: 'arbitrary-css' } }
      }
    }
  }, { bucketName });

  const page = config.pageOverrides['dashboard.html'];
  assert.equal(config.loaderTheme.accent, '#abcdef');
  assert.equal(config.loaderTheme.radius, 52);
  assert.equal(config.loaderTheme.markSize, 24);
  assert.equal(config.loaders.welcome.minimumMs, 2000);
  assert.equal(config.loaders.page.delayMs, 0);
  assert.equal(config.loaders.resume.enabled, true);
  assert.equal(page.text['hero.title'], 'Updated title');
  assert.equal(page.text['bad-slot'], 'Normalized key');
  assert.deepEqual(page.media, {});
  assert.deepEqual(page.style['hero.card'], { radius: 64, padding: 0, glass: 'default' });
});

test('deep merge preserves unrelated configuration fields', () => {
  const merged = mergeObjects(DEFAULT_CONFIG, { home: { title: 'New title' } });
  assert.equal(merged.home.title, 'New title');
  assert.equal(merged.home.primaryAction, DEFAULT_CONFIG.home.primaryAction);
  assert.equal(merged.brand.markUrl, DEFAULT_CONFIG.brand.markUrl);
});

test('configuration size enforcement rejects oversized documents', () => {
  assert.ok(assertConfigSize(DEFAULT_CONFIG) < MAX_CONFIG_BYTES);
  const oversized = { payload: 'x'.repeat(MAX_CONFIG_BYTES + 1) };
  assert.throws(() => assertConfigSize(oversized), (error) => error.code === 'experience-config-too-large');
});

test('image signature detection rejects MIME spoofing', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const webp = Buffer.from('RIFF0000WEBP', 'ascii');
  assert.equal(detectImageType(png), 'png');
  assert.equal(detectImageType(jpeg), 'jpeg');
  assert.equal(detectImageType(webp), 'webp');
  assert.equal(detectImageType(Buffer.from('not-an-image')), '');
});
