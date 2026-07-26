const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} = require('@firebase/rules-unit-testing');
const {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch
} = require('firebase/firestore');

const projectId = process.env.GCLOUD_PROJECT || 'evaraos-web';
const root = path.resolve(__dirname, '../..');
let env;

function user(uid, overrides = {}) {
  return {
    uid,
    id: uid,
    email: `${uid}@example.com`,
    role: 'customer',
    status: 'pending',
    approvalStatus: 'pending',
    companyId: '',
    companyName: '',
    platformAccess: false,
    ...overrides
  };
}

function application(uid, roleRequested = 'crew_lead') {
  return {
    applicantUid: uid,
    applicantEmail: `${uid}@example.com`,
    fullName: 'Applicant User',
    phone: '555-0100',
    roleRequested,
    status: 'submitted',
    verificationStatus: 'pending_review',
    attachments: [],
    submittedAt: new Date(),
    updatedAt: new Date()
  };
}

function promotionUser(uid, role, companyId = 'company-a') {
  return {
    role,
    status: 'active',
    approvalStatus: 'approved',
    companyId,
    companyName: 'Company A',
    companySlug: companyId,
    companyCategory: 'staff',
    staffApplicationId: uid,
    approvedBy: 'owner',
    updatedBy: 'owner'
  };
}

function staffProfile(uid, role, companyId = 'company-a') {
  return {
    uid,
    userId: uid,
    applicationId: uid,
    email: `${uid}@example.com`,
    fullName: 'Applicant User',
    role,
    companyId,
    companyName: 'Company A',
    status: 'active',
    approvalStatus: 'approved',
    onboardingStage: 'approved_pending_setup',
    onboardingTasks: {
      reviewPolicies: false,
      completeTaxDocs: false,
      completeTraining: false,
      receiveAssignment: false,
      activatePayouts: false
    },
    approvedBy: 'owner',
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

async function seed() {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', 'owner'), user('owner', {
      role: 'owner',
      status: 'active',
      approvalStatus: 'approved'
    }));
    await setDoc(doc(db, 'users', 'manager'), user('manager', {
      role: 'manager',
      status: 'active',
      approvalStatus: 'approved',
      companyId: 'company-a'
    }));
    await setDoc(doc(db, 'users', 'applicant'), user('applicant'));
    await setDoc(doc(db, 'users', 'leadApplicant'), user('leadApplicant'));
    await setDoc(doc(db, 'companies', 'company-a'), { name: 'Company A' });
    await setDoc(doc(db, 'staff_applications', 'applicant'), application('applicant', 'crew_lead'));
    await setDoc(doc(db, 'staff_applications', 'leadApplicant'), application('leadApplicant', 'lead_generator'));
  });
}

function approvalReview() {
  return {
    status: 'approved',
    verificationStatus: 'verified',
    reviewNotes: 'Approved by test',
    reviewedAt: new Date(),
    reviewedBy: 'owner',
    reviewedByEmail: 'owner@example.com',
    reviewedByName: 'Owner',
    approvedAt: new Date(),
    approvedBy: 'owner',
    approvedByEmail: 'owner@example.com',
    approvedByName: 'Owner',
    updatedAt: new Date()
  };
}

async function commitPromotion(db, uid, role, companyId = 'company-a') {
  const batch = writeBatch(db);
  batch.update(doc(db, 'staff_applications', uid), approvalReview());
  batch.update(doc(db, 'users', uid), promotionUser(uid, role, companyId));
  batch.set(doc(db, 'staff_profiles', uid), staffProfile(uid, role, companyId), { merge: true });
  return batch.commit();
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync(path.join(root, 'firebase/firestore.rules'), 'utf8')
    }
  });
});

test.beforeEach(async () => {
  await env.clearFirestore();
  await seed();
});

test.after(async () => {
  await env.cleanup();
});

test('platform owner can atomically approve and create onboarding profile', async () => {
  const db = env.authenticatedContext('owner').firestore();
  await assertSucceeds(commitPromotion(db, 'applicant', 'crew_lead'));
  await assertSucceeds(getDoc(doc(db, 'staff_profiles', 'applicant')));
});

test('expanded lead generator role can be approved through the same contract', async () => {
  const db = env.authenticatedContext('owner').firestore();
  await assertSucceeds(commitPromotion(db, 'leadApplicant', 'lead_generator'));
});

test('application cannot be marked approved without user and staff profile writes', async () => {
  const db = env.authenticatedContext('owner').firestore();
  await assertFails(updateDoc(doc(db, 'staff_applications', 'applicant'), approvalReview()));
});

test('non-platform manager cannot approve staff', async () => {
  const db = env.authenticatedContext('manager').firestore();
  await assertFails(commitPromotion(db, 'applicant', 'crew_lead'));
});

test('mismatched onboarding role or company is rejected', async () => {
  const db = env.authenticatedContext('owner').firestore();
  const batch = writeBatch(db);
  batch.update(doc(db, 'staff_applications', 'applicant'), approvalReview());
  batch.update(doc(db, 'users', 'applicant'), promotionUser('applicant', 'crew_lead', 'company-a'));
  batch.set(doc(db, 'staff_profiles', 'applicant'), staffProfile('applicant', 'technician', 'company-b'));
  await assertFails(batch.commit());
});

test('platform reviewer may reject without promoting the user', async () => {
  const db = env.authenticatedContext('owner').firestore();
  await assertSucceeds(updateDoc(doc(db, 'staff_applications', 'applicant'), {
    status: 'rejected',
    verificationStatus: 'rejected',
    reviewNotes: 'Identity could not be verified',
    reviewedAt: new Date(),
    reviewedBy: 'owner',
    reviewedByEmail: 'owner@example.com',
    reviewedByName: 'Owner',
    rejectedAt: new Date(),
    rejectedBy: 'owner',
    rejectedByEmail: 'owner@example.com',
    rejectedByName: 'Owner',
    updatedAt: new Date()
  }));
});

test('approved staff member can update only onboarding fields on their own profile', async () => {
  const ownerDb = env.authenticatedContext('owner').firestore();
  await assertSucceeds(commitPromotion(ownerDb, 'applicant', 'crew_lead'));

  const staffDb = env.authenticatedContext('applicant').firestore();
  await assertSucceeds(updateDoc(doc(staffDb, 'staff_profiles', 'applicant'), {
    onboardingStage: 'training',
    onboardingTasks: {
      reviewPolicies: true,
      completeTaxDocs: false,
      completeTraining: false,
      receiveAssignment: false,
      activatePayouts: false
    },
    updatedAt: new Date()
  }));

  await assertFails(updateDoc(doc(staffDb, 'staff_profiles', 'applicant'), {
    role: 'owner'
  }));
});
