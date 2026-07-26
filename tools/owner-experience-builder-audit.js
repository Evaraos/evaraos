'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];

function check(condition, message) {
  if (condition) console.log(`PASS: ${message}`);
  else {
    console.error(`FAIL: ${message}`);
    failures.push(message);
  }
}

const service = read('functions/experience-config-service.js');
const exportsFile = read('functions/index-stats.js');
const firebase = JSON.parse(read('firebase.json'));
const runtime = read('public/assets/js/experience/experience-runtime.js');
const clientAuthority = read('public/assets/js/experience/experience-authority.js');
const client = read('public/assets/js/experience/experience-config-client.js');
const publisher = read('public/assets/js/experience/owner-experience-publisher.js');
const builder = read('public/assets/js/studio/studio-experience-builder.js');
const loader = read('public/assets/js/loader.js');
const nav = read('public/assets/js/nav.js');
const navMain = read('public/assets/js/nav/nav-main-v6.js');
const studio = read('public/website-builder.html');
const home = read('public/index.html');
const trustedDeploy = read('.github/workflows/deploy-trusted-studio-functions-once.yml');
const permanentWorkflow = read('.github/workflows/owner-experience-builder-audit.yml');

const callableNames = [
  'getExperienceEditorState',
  'saveExperienceDraft',
  'publishExperienceConfig',
  'uploadExperienceAsset'
];
const allFunctionNames = [...callableNames, 'getPublicExperienceConfig'];

check(service.includes("const CALLABLE_OPTIONS = Object.freeze({ region: 'us-central1', enforceAppCheck: true"), 'owner editor callables enforce App Check');
callableNames.forEach((name) => check(service.includes(`exports.${name} = onCall(CALLABLE_OPTIONS`), `${name} uses the trusted callable policy`));
check(service.includes("require('./studio-journal-core')"), 'Experience publishing reuses trusted Studio authority');
check(service.includes('canPublishStudio(profile)'), 'publisher authority is resolved by the Studio policy');
check(service.includes('isActiveProfile(profile)'), 'inactive profiles cannot publish experiences');
check(service.includes("exports.getPublicExperienceConfig = onRequest"), 'public experience endpoint is an HTTP function');
check(service.includes('data.published || DEFAULT_CONFIG'), 'public endpoint reads only published configuration');
check(!/getPublicExperienceConfig[\s\S]*data\.draft/.test(service), 'public endpoint never exposes draft configuration');
check(service.includes('MAX_CONFIG_BYTES') && service.includes('assertConfigSize'), 'experience documents are bounded below Firestore limits');
check(service.includes("url.hostname !== 'firebasestorage.googleapis.com'"), 'published remote assets are restricted to Firebase Storage');
check(service.includes("targetCollection: 'experience_configs'"), 'draft and publish actions emit security audit records');
check(service.includes("throw new HttpsError('aborted'"), 'publish uses optimistic draft revision protection');

allFunctionNames.forEach((name) => check(exportsFile.includes(`exports.${name} = experienceConfig.${name}`), `${name} is exported by Functions`));

const rewrites = firebase.hosting?.rewrites || [];
const experienceRewrite = rewrites.findIndex((item) => item.source === '/__experience/config');
const catchAllRewrite = rewrites.findIndex((item) => item.source === '**');
check(experienceRewrite >= 0, 'Hosting exposes the same-origin experience endpoint');
check(catchAllRewrite < 0 || experienceRewrite < catchAllRewrite, 'experience endpoint rewrite precedes the SPA catch-all');

check(runtime.includes("const ENDPOINT = '/__experience/config'"), 'runtime refreshes the same-origin published endpoint');
check(runtime.includes("const CACHE_KEY = 'evaraos-experience-config-v1'"), 'runtime has a first-paint cache');
check(runtime.includes('window.EvaraLoader?.configure?.(config)'), 'loader behavior is configured through one authority');
check(runtime.includes('[data-experience-text]'), 'registered text slots are supported');
check(runtime.includes('pageOverrides'), 'published existing-page overrides are supported');
check(runtime.includes('MutationObserver'), 'late-rendered application surfaces receive published configuration');
check(runtime.includes("url.hostname !== 'firebasestorage.googleapis.com'"), 'runtime rejects unapproved cached asset origins');
check(clientAuthority.includes('canPublishExperience'), 'owner surfaces share one client publisher authority');
check(clientAuthority.includes("permissions.has('studio.publish')"), 'client authority mirrors Studio publisher permissions');

check(client.includes("'getExperienceEditorState'"), 'owner client loads draft and live versions');
check(client.includes("'saveExperienceDraft'"), 'owner client saves secure drafts');
check(client.includes("'publishExperienceConfig'"), 'owner client publishes live configuration');
check(client.includes("'uploadExperienceAsset'"), 'owner client uploads approved image assets');

check(builder.includes("const TABS = ['brand', 'welcome', 'page', 'resume', 'home', 'overrides']"), 'Studio exposes all Experience Builder sections');
check(builder.includes('refreshPreview()'), 'live preview updates without rebuilding the form on every keystroke');
check(builder.includes('saveExperienceDraftPatch'), 'Studio saves through the trusted draft callable');
check(builder.includes('publishExperienceDraft'), 'Studio publishes through the trusted publish callable');
check(builder.includes('uploadExperienceAsset'), 'Studio supports owner image uploads');
check(publisher.includes("pageOverrides: { [pageKey()]: readLocalPage() }"), 'Live Edit joins the shared page-override draft');
check(publisher.includes('publishExperienceDraft()'), 'Live Edit can publish existing page changes');

check(loader.includes('const EXPERIENCE_CACHE_KEY="evaraos-experience-config-v1"'), 'loader reads cached Experience configuration before runtime refresh');
check(loader.includes("addEventListener('evara:experience-config'"), 'loader accepts published runtime updates');
check(loader.includes('configure:configureExperience'), 'loader exposes one configuration method');
check(loader.includes('experience.loaders.page.enabled'), 'page-loader enablement is enforced on future transitions');
check(loader.includes('experience.loaders.resume.minimumAwayMs'), 'resume timing is enforced by the loader authority');
check(loader.includes("url.hostname!=='firebasestorage.googleapis.com'"), 'loader rejects unapproved cached asset origins');

check(nav.includes('./experience/experience-runtime.js?v=1'), 'navigation loads the published runtime');
check(nav.includes('./experience/owner-experience-publisher.js?v=1'), 'owner sessions receive trusted Live Edit publishing');
check(nav.includes('nav-v59-experience-builder'), 'navigation entry uses the Experience Builder build');
check(navMain.includes('nav-v59-experience-builder'), 'navigation core uses the same Experience Builder build');

check(studio.includes('/assets/css/pages/studio-experience-builder.css?v=1'), 'Studio loads Experience Builder styling');
check(studio.includes('/assets/js/studio/studio-experience-builder.js?v=1'), 'Studio loads the owner Experience Builder module');
check(home.includes("const cacheKey='evaraos-experience-config-v1'"), 'homepage applies cached loader configuration before modules');
['home.kicker', 'home.title', 'home.subtitle', 'home.primaryAction', 'home.secondaryAction'].forEach((slot) => {
  check(home.includes(`data-experience-text=\"${slot}\"`), `homepage registers ${slot}`);
});

allFunctionNames.forEach((name) => check(trustedDeploy.includes(name), `trusted manual deployment includes ${name}`));
check(trustedDeploy.includes('functions/experience-config-service.js'), 'trusted deployment validates the experience service');
check(trustedDeploy.includes('node tools/owner-experience-builder-audit.js'), 'trusted deployment runs the Experience Builder audit');
check(permanentWorkflow.includes('name: Owner Experience Builder Audit'), 'dedicated Experience Builder CI is permanent');
check(permanentWorkflow.includes('node tools/owner-experience-builder-audit.js'), 'dedicated CI runs the architecture audit');
check(permanentWorkflow.includes("public/assets/js/experience/**"), 'dedicated CI watches runtime changes');
check(permanentWorkflow.includes('functions/experience-config-service.js'), 'dedicated CI watches trusted backend changes');

if (failures.length) {
  console.error(`\nOwner Experience Builder audit failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log('\nOwner Experience Builder architecture audit passed.');
