import { auth, db, doc, getSavedUserProfile, writeBatch } from './firebase.js';
import { groupAssignmentIndexWrites, planAssignmentIndexWrites } from './assignment-index-utils.mjs';

const FIRESTORE_BATCH_LIMIT = 400;
const ASSIGNMENT_MANAGER_ROLES = new Set([
  'owner',
  'super_admin',
  'platform_admin',
  'admin',
  'manager',
  'operations_manager',
  'operations_coordinator',
  'field_manager',
  'sales_manager',
  'dispatcher',
  'hr',
  'hr_manager'
]);

export async function syncStaffAssignmentIndex(collectionName, recordId, before = {}, after = {}) {
  const user = auth.currentUser;
  const profile = getSavedUserProfile();
  const canManageAssignments = Boolean(user?.uid && profile?.uid === user.uid
    && ASSIGNMENT_MANAGER_ROLES.has(String(profile.role || '').trim().toLowerCase()));
  const writes = planAssignmentIndexWrites(collectionName, recordId, before, after, {
    uid: user?.uid || '',
    canManageAssignments
  });
  // Commit new access references before stale-reference cleanup. A cleanup
  // denial for a former cross-tenant assignee must not cancel the new assignee.
  for (const group of groupAssignmentIndexWrites(writes)) {
    for (let offset = 0; offset < group.length; offset += FIRESTORE_BATCH_LIMIT) {
      const batch = writeBatch(db);
      for (const write of group.slice(offset, offset + FIRESTORE_BATCH_LIMIT)) {
        const reference = doc(db, 'users', write.userId, write.indexCollection, write.recordId);
        if (write.operation === 'delete') batch.delete(reference);
        else batch.set(reference, {});
      }
      await batch.commit();
    }
  }
}
