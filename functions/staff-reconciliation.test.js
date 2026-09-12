const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { normalizeAuthorityRole } = require('./staff-authority');
function harness(file = 'staff-onboarding.js') {
  const documents = new Map();
  const writes = [];
  const snap = ref => ({ exists: documents.has(ref.path), id: ref.path.split('/').pop(), data: () => documents.get(ref.path) });
  const db = {
    doc: path => ({ path, get: async () => snap({ path }), set: async data => { documents.set(path, {...documents.get(path), ...data}); } }),
    collection: name => ({doc: () => ({path: `${name}/event`})}),
    runTransaction: async fn => {
      const pending = [];
      const result = await fn({get: async ref => snap(ref), update: (ref, data) => pending.push([ref.path,data]), set: (ref,data) => pending.push([ref.path,data])});
      for (const [key,data] of pending) { documents.set(key,{...documents.get(key),...data}); writes.push([key,data]); }
      return result;
    }
  };
  const firestore = () => db;
  firestore.FieldValue = {serverTimestamp: () => 'SERVER_TIME', delete: () => null};
  class HttpsError extends Error { constructor(code,message) {super(message); this.code=code;} }
  const exports = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,file),'utf8'), {
    exports, console, setTimeout,
    require: name => name === 'firebase-admin' ? {firestore, auth: () => ({getUser: async () => ({}), setCustomUserClaims: async () => {}})}
      : name === 'firebase-functions/v2/https' ? {HttpsError,onCall: (options,fn) => { assert.equal(options.enforceAppCheck,true); return fn; }}
      : require(name)
  });
  const profile = {uid:'alice',userId:'alice',role:'technician',companyId:'a',status:'active',approvalStatus:'approved',onboardingTasks:{}};
  documents.set('users/alice',{...profile}); documents.set('staff_profiles/alice',{...profile});
  return {documents,writes,call:exports.updateStaffOnboardingTask || exports.reviewStaffApplication};
}
const request = data => ({auth:{uid:'alice',token:{}},data});
test('own approved staff task updates only checklist fields and writes audit atomically', async () => {
  const h=harness();
  for (const taskKey of ['reviewPolicies','completeTaxDocs','completeTraining','receiveAssignment','activatePayouts']) {
    await h.call(request({taskKey,completed:true}));
  }
  const p=h.documents.get('staff_profiles/alice');
  assert.equal(p.onboardingStage,'fully_active'); assert.equal(p.updatedAt,'SERVER_TIME');
  assert.equal(p.role,'technician'); assert.equal(p.companyId,'a'); assert.equal(p.status,'active');
  for (const [key,data] of h.writes.filter(([key])=>key.startsWith('staff_profiles/'))) {
    assert.deepEqual(Object.keys(data).sort(),['onboardingStage','onboardingTasks','updatedAt']);
  }
  assert.ok(h.writes.some(([key])=>key.startsWith('audit_logs/')));
  await h.call(request({taskKey:'reviewPolicies',completed:false}));
  assert.equal(h.documents.get('staff_profiles/alice').onboardingStage,'in_progress');
});
test('no authentication, missing profile, inactive staff and mismatched identity denied', async () => {
  const h=harness(); await assert.rejects(h.call({data:{}}),{code:'unauthenticated'});
  h.documents.delete('staff_profiles/alice'); await assert.rejects(h.call(request({taskKey:'reviewPolicies',completed:true})),{code:'not-found'});
  for (const patch of [{status:'suspended'},{companyId:'other'},{uid:'bob'},{userId:'bob'},{role:'owner'},{approvalStatus:'pending'}]) {
    const x=harness();Object.assign(x.documents.get('staff_profiles/alice'),patch);
    await assert.rejects(x.call(request({taskKey:'reviewPolicies',completed:true})),{code:'permission-denied'}); assert.equal(x.writes.length,0);
  }
});
test('cross-user targeting, privileged fields, malformed values and invalid keys rejected', async () => {
  for (const field of ['uid','userId','profileId','role','companyId','companyName','status','approvalStatus','permissions','customClaims','reviewedBy','employmentType','updatedAt','onboardingStage']) {
    const h=harness(); await assert.rejects(h.call(request({taskKey:'reviewPolicies',completed:true,[field]:'bob'})),{code:'invalid-argument'});assert.equal(h.writes.length,0);
  }
  for (const taskKey of ['role','__proto__','constructor','onboardingTasks.reviewPolicies','']) {
    await assert.rejects(harness().call(request({taskKey,completed:true})),{code:'invalid-argument'});
  }
  for (const completed of ['true',1,null,{}]) await assert.rejects(harness().call(request({taskKey:'reviewPolicies',completed})),{code:'invalid-argument'});
});
test('trusted approval creates expected profile and does not promote applicant authority', async () => {
  for (const role of ['owner','super_admin','platform_admin']) {
    const h=harness('staff-approval.js'); h.documents.set('users/alice',{role,status:'active',approvalStatus:'approved'});
    h.documents.set('users/bob',{role:'customer'}); h.documents.set('companies/a',{name:'A'});
    h.documents.set('staff_applications/bob',{applicantUid:'bob',status:'submitted',roleRequested:'technician'});
    await h.call(request({applicationId:'bob',decision:'approved',companyId:'a',finalRole:'technician'}));
    const p=h.documents.get('staff_profiles/bob'); assert.equal(p.uid,'bob'); assert.equal(p.role,'technician');
    assert.equal(p.onboardingStage,'approved_pending_setup'); assert.equal(Object.keys(p.onboardingTasks).length,5);
    assert.ok(Object.values(p.onboardingTasks).every(v=>v===false));
  }
});
test('company admin cannot use global assignment authority', async () => {
  const h=harness('staff-approval.js');h.documents.set('users/alice',{role:'admin',status:'active',approvalStatus:'approved',companyId:'a'});
  await assert.rejects(h.call(request({applicationId:'bob',decision:'assigned',companyId:'b'})),{code:'permission-denied'});
});
test('role normalization preserves scope and only maps established global alias', () => {
  assert.equal(normalizeAuthorityRole('super_admin'),'platform_admin');
  for (const role of ['owner','admin','manager','technician','customer','unknown']) assert.equal(normalizeAuthorityRole(role),role);
  assert.equal(normalizeAuthorityRole({role:'owner'}),'');
});
test('Spark intake does not call Storage and explicitly defers verification', () => {
  const source=fs.readFileSync(path.join(__dirname,'../public/assets/js/staff-application.js'),'utf8');
  assert.doesNotMatch(source,/uploadBytes|getStorage|uploadAttachment/);
  assert.match(source,/documentVerificationStatus:"deferred"/);assert.match(source,/verificationStatus:"pending_review"/);
  const html=fs.readFileSync(path.join(__dirname,'../public/staff_application.html'),'utf8');
  assert.doesNotMatch(html,/Upload one valid identity document/);
  assert.doesNotMatch(html,/<input[^>]*id="appIdFront"[^>]*\brequired/);
  const onboarding=fs.readFileSync(path.join(__dirname,'../public/assets/js/onboarding.js'),'utf8');
  assert.doesNotMatch(onboarding,/updateDoc|setDoc/);assert.match(onboarding,/httpsCallable\(functions, "updateStaffOnboardingTask"\)/);
});


test('submission executes successfully without files and writes pending unassigned records', async () => {
  let source=fs.readFileSync(path.join(__dirname,'../public/assets/js/staff-application.js'),'utf8');
  source=source.replace(/import[\s\S]*?from "[^"\n]+";\n/g,'');
  source=source.slice(0,source.indexOf('function upgradePage'));
  const writes=[];
  const fields=new Map();
  const values={appRole:'technician',appPassword:'password123',appPasswordConfirm:'password123',appDriversLicense:'no',appEmail:'alice@example.com'};
  const get=id=>{
    if(!fields.has(id)) fields.set(id,{value:values[id]||'Provided',checked:true,files:[],dataset:{},reset(){}});
    return fields.get(id);
  };
  const context={
    auth:{},db:{},document:{getElementById:get,querySelectorAll:()=>[]},console,
    setAuthPersistence:async()=>{},createUserWithEmailAndPassword:async()=>({user:{uid:'alice'}}),
    updateProfile:async()=>{},syncUserSession:()=>{},doc:(_db,collection,id)=>`${collection}/${id}`,
    setDoc:async(ref,data)=>writes.push([ref,data]),serverTimestamp:()=> 'SERVER_TIME',
    ACCOUNT_STATUS_ROUTE:'/account-status.html',setTimeout:()=>{},
  };
  vm.createContext(context);vm.runInContext(source,context);
  await vm.runInContext('handleSubmit({preventDefault(){}})',context);
  assert.equal(writes.length,2);
  assert.equal(writes[0][1].role,'customer');assert.equal(writes[0][1].companyId,'');
  const app=writes[1][1];assert.equal(app.status,'submitted');assert.equal(app.verificationStatus,'pending_review');
  assert.equal(app.attachments.length,0);assert.equal(app.documentVerificationStatus,'deferred');
  assert.equal(Object.hasOwn(app,'companyId'),false);
});
