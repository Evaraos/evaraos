import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
  getSavedUserProfile
} from "./firebase.js";

let jobsData = [];
let unsubscribeJobs = null;
let currentUser = null;

function normalize(v=""){
  return String(v||"").toLowerCase().trim();
}

function jobName(j={}){
  return j.title||j.name||j.customerName||"Untitled Job";
}

function actor(){
  const p = getSavedUserProfile()||{};
  return {
    uid: currentUser?.uid || p.uid,
    role: normalize(p.role),
    companyId: p.companyId || "",
    name: p.displayName || p.name || currentUser?.email
  };
}

function canCompanyClaim(j){
  const a = actor();
  return !j.companyClaimed && ["owner","admin","manager","sales"].includes(a.role);
}

function canStaffClaim(j){
  const a = actor();
  if(!j.companyClaimed) return false;
  if(j.staffClaimed) return false;
  if(j.companyId && a.companyId && j.companyId!==a.companyId) return false;
  return true;
}

function render(){
  const list = document.getElementById("jobsList");
  if(!list) return;

  list.innerHTML = jobsData.map(j=>{
    return `
    <div class="job-card">
      <strong>${jobName(j)}</strong>
      <p>${j.status||"open"}</p>
      ${canCompanyClaim(j)?`<button onclick="claimCompany('${j.id}')">Claim Company</button>`:""}
      ${canStaffClaim(j)?`<button onclick="claimStaff('${j.id}')">Accept Job</button>`:""}
    </div>
    `;
  }).join("");
}

window.claimCompany = async function(id){
  const a = actor();
  await updateDoc(doc(db,"jobs",id),{
    companyId: a.companyId,
    companyClaimed:true,
    companyClaimedBy:a.uid,
    companyClaimedAt:serverTimestamp(),
    status:"claimed"
  });
};

window.claimStaff = async function(id){
  const a = actor();
  await updateDoc(doc(db,"jobs",id),{
    staffClaimed:true,
    staffClaimedBy:a.uid,
    assignedTo:[a.uid],
    status:"in_progress",
    staffClaimedAt:serverTimestamp()
  });
};

function startLiveFeed(){
  if(unsubscribeJobs) unsubscribeJobs();

  unsubscribeJobs = onSnapshot(collection(db,"jobs"),(snap)=>{
    jobsData = snap.docs.map(d=>({id:d.id,...d.data()}));
    render();
  });
}

onAuthStateChanged(auth,(user)=>{
  if(!user) return location.href="/evaraos/login.html";
  currentUser = user;
  startLiveFeed();
});
