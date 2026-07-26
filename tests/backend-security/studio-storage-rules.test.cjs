const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} = require('@firebase/rules-unit-testing');
const { doc, setDoc } = require('firebase/firestore');
const { ref, uploadBytes, getMetadata, deleteObject } = require('firebase/storage');

const projectId = process.env.GCLOUD_PROJECT || 'evaraos-web';
const root = path.resolve(__dirname, '../..');
let env;

const user = (uid, role, companyId = '', overrides = {}) => ({
  uid,
  id: uid,
  email: `${uid}@example.com`,
  role,
  companyId,
  status: 'active',
  approvalStatus: 'approved',
  platformAccess: false,
  ...overrides
});

async function seed() {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const users = [
      user('owner', 'owner'),
      user('adminA', 'admin', 'company-a'),
      user('adminB', 'admin', 'company-b'),
      user('managerA', 'manager', 'company-a'),
      user('customerA', 'customer', 'company-a'),
      user('customerB', 'customer', 'company-b')
    ];
    for (const record of users) await setDoc(doc(db, 'users', record.uid), record);
    await setDoc(doc(db, 'companies', 'company-a'), { name: 'Company A' });
    await setDoc(doc(db, 'companies', 'company-b'), { name: 'Company B' });
  });
}

function metadata(uid, companyId, contentType) {
  return {
    contentType,
    customMetadata: {
      companyId,
      uploadedBy: uid,
      studioVersion: 'studio-canvas-workbench-v5'
    }
  };
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: { rules: fs.readFileSync(path.join(root, 'firebase/firestore.rules'), 'utf8') },
    storage: { rules: fs.readFileSync(path.join(root, 'firebase/storage.rules'), 'utf8') }
  });
});

test.beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await seed();
});

test.after(async () => {
  await env.cleanup();
});

test('owner and same-company admin can upload Studio images and videos', async () => {
  const ownerStorage = env.authenticatedContext('owner').storage();
  const adminStorage = env.authenticatedContext('adminA').storage();
  const imagePayload = new Uint8Array([137, 80, 78, 71]);
  const videoPayload = new Uint8Array([0, 0, 0, 20, 102, 116, 121, 112]);

  const ownerImage = ref(ownerStorage, 'companies/company-a/studio/media/owner-image.png');
  await assertSucceeds(uploadBytes(ownerImage, imagePayload, metadata('owner', 'company-a', 'image/png')));
  await assertSucceeds(getMetadata(ownerImage));

  const adminVideo = ref(adminStorage, 'companies/company-a/studio/media/admin-video.mp4');
  await assertSucceeds(uploadBytes(adminVideo, videoPayload, metadata('adminA', 'company-a', 'video/mp4')));
  await assertSucceeds(getMetadata(adminVideo));
});

test('Studio uploads reject managers, cross-company admins, and forged metadata', async () => {
  const managerStorage = env.authenticatedContext('managerA').storage();
  const adminBStorage = env.authenticatedContext('adminB').storage();
  const adminAStorage = env.authenticatedContext('adminA').storage();
  const payload = new Uint8Array([137, 80, 78, 71]);

  await assertFails(uploadBytes(
    ref(managerStorage, 'companies/company-a/studio/media/manager.png'),
    payload,
    metadata('managerA', 'company-a', 'image/png')
  ));
  await assertFails(uploadBytes(
    ref(adminBStorage, 'companies/company-a/studio/media/cross-company.png'),
    payload,
    metadata('adminB', 'company-a', 'image/png')
  ));
  await assertFails(uploadBytes(
    ref(adminAStorage, 'companies/company-a/studio/media/forged-company.png'),
    payload,
    metadata('adminA', 'company-b', 'image/png')
  ));
  await assertFails(uploadBytes(
    ref(adminAStorage, 'companies/company-a/studio/media/forged-user.png'),
    payload,
    metadata('owner', 'company-a', 'image/png')
  ));
});

test('Studio media enforces content types and byte limits', async () => {
  const adminStorage = env.authenticatedContext('adminA').storage();
  await assertFails(uploadBytes(
    ref(adminStorage, 'companies/company-a/studio/media/script.js'),
    new Uint8Array([99, 111, 110, 115, 111, 108, 101]),
    metadata('adminA', 'company-a', 'application/javascript')
  ));

  const imageAtLimit = new Uint8Array(16 * 1024 * 1024);
  await assertFails(uploadBytes(
    ref(adminStorage, 'companies/company-a/studio/media/too-large.png'),
    imageAtLimit,
    metadata('adminA', 'company-a', 'image/png')
  ));

  const videoAtLimit = new Uint8Array(80 * 1024 * 1024);
  await assertFails(uploadBytes(
    ref(adminStorage, 'companies/company-a/studio/media/too-large.mp4'),
    videoAtLimit,
    metadata('adminA', 'company-a', 'video/mp4')
  ));
});

test('same-company members can read Studio media while other tenants cannot', async () => {
  const adminStorage = env.authenticatedContext('adminA').storage();
  const customerAStorage = env.authenticatedContext('customerA').storage();
  const customerBStorage = env.authenticatedContext('customerB').storage();
  const target = ref(adminStorage, 'companies/company-a/studio/media/shared.png');

  await assertSucceeds(uploadBytes(
    target,
    new Uint8Array([137, 80, 78, 71]),
    metadata('adminA', 'company-a', 'image/png')
  ));
  await assertSucceeds(getMetadata(ref(customerAStorage, 'companies/company-a/studio/media/shared.png')));
  await assertFails(getMetadata(ref(customerBStorage, 'companies/company-a/studio/media/shared.png')));
});

test('only Studio managers can delete company media', async () => {
  const adminStorage = env.authenticatedContext('adminA').storage();
  const managerStorage = env.authenticatedContext('managerA').storage();
  const targetPath = 'companies/company-a/studio/media/delete-me.png';

  await assertSucceeds(uploadBytes(
    ref(adminStorage, targetPath),
    new Uint8Array([137, 80, 78, 71]),
    metadata('adminA', 'company-a', 'image/png')
  ));
  await assertFails(deleteObject(ref(managerStorage, targetPath)));
  await assertSucceeds(deleteObject(ref(adminStorage, targetPath)));
});
