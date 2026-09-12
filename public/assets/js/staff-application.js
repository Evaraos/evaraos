import {
  auth, db, setAuthPersistence, createUserWithEmailAndPassword, updateProfile,
  syncUserSession, doc, setDoc, serverTimestamp
} from "./firebase.js";
import { ACCOUNT_STATUS_ROUTE } from "./account-lifecycle.js";

const DEFAULT_PUBLIC_ROLE = "customer";
const DEFAULT_PUBLIC_STATUS = "pending";
const DEFAULT_PUBLIC_APPROVAL = "pending";
// Initial intake deliberately does not access Storage. Attachments retain their schema
// for a separate, capability-checked document collection flow after submission.

const AVAILABLE_STAFF_ROLES = [
  { value:"sales_rep", label:"Sales Representative", summary:"Generate leads, educate customers, and close service opportunities in assigned territories." },
  { value:"technician", label:"Technician", summary:"Complete assigned field services, document work, and maintain quality and safety standards." },
  { value:"lead_technician", label:"Lead Technician", summary:"Lead crews, verify job quality, manage equipment, and support field training." },
  { value:"cleaner", label:"Cleaner", summary:"Perform residential or commercial cleaning services using Evaraos job workflows." },
  { value:"lead_cleaner", label:"Lead Cleaner", summary:"Coordinate cleaning teams, inspect completed work, and maintain customer standards." },
  { value:"crew_lead", label:"Crew Lead", summary:"Coordinate a field crew, assignments, arrival times, materials, and completion reporting." },
  { value:"quality_control", label:"Quality Control", summary:"Review job evidence, inspect results, document issues, and protect service standards." },
  { value:"field_staff", label:"Field Staff", summary:"Support assigned field services, job documentation, equipment handling, and daily operating standards." },
  { value:"staff", label:"General Staff", summary:"Join the operating team in a flexible role based on experience and business needs." }
];

const form = document.getElementById("staffApplicationForm");
const submitBtn = document.getElementById("staffApplicationSubmit");
const messageEl = document.getElementById("staffApplicationMessage");
const byId = id => document.getElementById(id);
const value = id => String(byId(id)?.value || "").trim();
const checked = id => Boolean(byId(id)?.checked);

function fullName(){ return [value("appFirstName"),value("appMiddleName"),value("appLastName")].filter(Boolean).join(" "); }
function normalizeUsername(email=""){ return String(email).trim().toLowerCase().split("@")[0].replace(/[^a-z0-9._-]+/g,"").slice(0,40); }
function sanitizeRole(role=""){ const v=String(role).trim().toLowerCase(); return AVAILABLE_STAFF_ROLES.some(r=>r.value===v)?v:""; }
function setMessage(text="",state=""){ if(messageEl){messageEl.textContent=text;messageEl.dataset.state=state;} }
function setBusy(busy,text="Submit Staff Application"){ if(submitBtn){submitBtn.disabled=busy;submitBtn.textContent=busy?text:"Submit Staff Application";} }

function validateForm(){
  const required=[
    ["appFirstName","First name"],["appLastName","Last name"],["appEmail","Email"],["appPassword","Password"],
    ["appRole","Role"],["appPathway","Work pathway"],["appDesiredCompany","Preferred company or program"],
    ["appCampaign","Preferred campaign"],["appPreferredCity","Preferred city"],["appPhone","Phone"],["appDob","Date of birth"],
    ["appAddress","Street address"],["appCity","City"],["appState","State"],["appZip","ZIP"],["appWorkAuth","Work authorization"],
    ["appDriversLicense","Driver’s license answer"],["appTransportation","Transportation answer"],["appAvailability","Availability"],
    ["appEmploymentType","Employment type"],["appEarliestStartDate","Earliest start date"],["appBackgroundConsent","Background-check consent"],
    ["appEmergencyName","Emergency contact name"],["appEmergencyPhone","Emergency contact phone"],["appEmergencyEmail","Emergency contact email"]
  ];
  for(const [id,label] of required){if(!value(id))throw new Error(`${label} is required.`);}
  if(!sanitizeRole(value("appRole")))throw new Error("Select a valid role.");
  if(value("appPassword").length<6)throw new Error("Password must be at least 6 characters.");
  if(value("appPassword")!==value("appPasswordConfirm"))throw new Error("Passwords do not match.");
  if(value("appDriversLicense")==="yes"&&!value("appDriversNumber"))throw new Error("Driver’s license number is required when you have a license.");
  if(!checked("appConsentAccurate"))throw new Error("Confirm that the application information is accurate.");
}

function buildPayload(user,attachments){
  const email=value("appEmail").toLowerCase(),role=sanitizeRole(value("appRole")),name=fullName();
  const photo=attachments.find(x=>x.kind==="profile_photo");
  return {
    applicantUid:user.uid,applicantEmail:email,firstName:value("appFirstName"),middleName:value("appMiddleName"),lastName:value("appLastName"),fullName:name,
    username:normalizeUsername(email),roleRequested:role,desiredRole:role,workPathway:value("appPathway"),preferredCompanyCategory:value("appCompanyCategory"),
    desiredCompany:value("appDesiredCompany"),preferredCampaign:value("appCampaign"),preferredCity:value("appPreferredCity"),phone:value("appPhone"),
    address:value("appAddress"),city:value("appCity"),state:value("appState"),zip:value("appZip"),dateOfBirth:value("appDob"),workAuthorization:value("appWorkAuth"),
    hasDriversLicense:value("appDriversLicense"),driversLicenseState:value("appDriversState"),driversLicenseNumber:value("appDriversNumber"),driversLicenseExpiration:value("appDriversExpiration"),
    hasReliableTransportation:value("appTransportation"),availability:value("appAvailability"),preferredSchedule:value("appPreferredSchedule"),employmentType:value("appEmploymentType"),
    earliestStartDate:value("appEarliestStartDate"),payExpectation:value("appPayExpectation"),equipmentExperience:value("appEquipmentExperience"),backgroundConsent:value("appBackgroundConsent"),
    consentAccurate:checked("appConsentAccurate"),experienceSummary:value("appExperience"),idDocumentType:value("appIdType"),emergencyContactName:value("appEmergencyName"),
    emergencyContactPhone:value("appEmergencyPhone"),emergencyContactEmail:value("appEmergencyEmail"),attachments,attachmentCount:attachments.length,
    documentVerificationStatus:"deferred",documentVerificationReason:"document_collection_unavailable",profilePhotoUploaded:Boolean(photo),profilePhotoURL:photo?.downloadURL||"",status:"submitted",verificationStatus:"pending_review",reviewNotes:"",
    createdAt:serverTimestamp(),submittedAt:serverTimestamp(),updatedAt:serverTimestamp(),
    searchText:[name,email,role,value("appDesiredCompany"),value("appCampaign"),value("appPreferredCity"),value("appPhone"),value("appCity"),value("appState")].filter(Boolean).join(" ").toLowerCase()
  };
}

async function handleSubmit(event){
  event.preventDefault();
  try{
    validateForm();setBusy(true,"Creating secure account…");setMessage("Creating your secure applicant account…","info");
    const email=value("appEmail").toLowerCase(),name=fullName(),username=normalizeUsername(email);
    await setAuthPersistence(true);
    const {user}=await createUserWithEmailAndPassword(auth,email,value("appPassword"));
    await updateProfile(user,{displayName:name});
    await setDoc(doc(db,"users",user.uid),{uid:user.uid,id:user.uid,email,username,usernameLower:username,displayName:name,fullName:name,name,role:DEFAULT_PUBLIC_ROLE,phone:value("appPhone"),bio:"Staff applicant pending review.",status:DEFAULT_PUBLIC_STATUS,approvalStatus:DEFAULT_PUBLIC_APPROVAL,companyId:"",companyName:"",createdAt:serverTimestamp(),updatedAt:serverTimestamp()},{merge:true});
    syncUserSession(user,DEFAULT_PUBLIC_ROLE,{displayName:name,fullName:name,name,username,companyId:"",companyName:"",approvalStatus:DEFAULT_PUBLIC_APPROVAL,status:DEFAULT_PUBLIC_STATUS});
    const uploads=[];
    setBusy(true,"Submitting application…");
    await setDoc(doc(db,"staff_applications",user.uid),buildPayload(user,uploads),{merge:false});
    setMessage("Application submitted. Document verification is pending; documents will be requested separately. Opening your secure account status…","success");
    form.reset();document.querySelectorAll(".role-choice").forEach(x=>x.classList.remove("active"));
    setTimeout(()=>window.location.assign(`${ACCOUNT_STATUS_ROUTE}?state=pending`),1000);
  }catch(error){console.error("Staff application failed:",error);setMessage(error.message||"Could not submit staff application.","error");}
  finally{setBusy(false);}
}

function upgradePage(){
  // Do not accept sensitive files that this release cannot submit.
  for (const id of ["appIdFront", "appIdBack", "appResume", "appProfilePhoto", "appIdType"]) {
    const input = byId(id);
    if (input) { input.required = false; input.disabled = true; }
  }

  const oldName=byId("appFullName")?.closest(".application-field");
  if(oldName){oldName.className="application-field full name-grid-host";oldName.innerHTML=`<div class="name-grid"><div class="application-field"><label for="appFirstName">First name *</label><input id="appFirstName" autocomplete="given-name" required></div><div class="application-field"><label for="appMiddleName">Middle name <small>Optional</small></label><input id="appMiddleName" autocomplete="additional-name"></div><div class="application-field"><label for="appLastName">Last name *</label><input id="appLastName" autocomplete="family-name" required></div></div>`;}

  const roleField=byId("appRole")?.closest(".application-field");
  if(roleField){byId("appRole").innerHTML=`<option value="">Select role</option>${AVAILABLE_STAFF_ROLES.map(r=>`<option value="${r.value}">${r.label}</option>`).join("")}`;roleField.insertAdjacentHTML("beforebegin",`<div class="application-field full role-explorer"><label>Roles you may apply for</label><p class="form-subnote">Select a role card to view its responsibilities and set it as your preferred role. Management, HR, administrative, and platform authority roles are assigned only through an authorized internal review.</p><div class="role-choice-grid">${AVAILABLE_STAFF_ROLES.map(r=>`<button type="button" class="role-choice" data-role="${r.value}" aria-expanded="false"><span><strong>${r.label}</strong><small>View role</small></span><p>${r.summary}</p></button>`).join("")}</div></div>`);}

  const company=byId("appDesiredCompany");
  if(company){company.outerHTML=`<select id="appDesiredCompany" required><option value="">Select company or pathway</option><optgroup label="Evaraos in-house companies"><option>Supreme True Clean</option><option>OneofOne Cleaning</option><option>Solar Bright</option><option>Evaraos Inc</option></optgroup><optgroup label="Programs and marketplace pathways"><option value="Evaraos Independent Service Program">Evaraos Independent Service Program</option><option value="Evaraos Lead Vendor Program">Evaraos Lead Vendor Program</option><option value="Evaraos Service Vendor Program">Evaraos Service Vendor Program</option><option value="Independent Freelancer / Contractor">Independent Freelancer / Contractor</option></optgroup><optgroup label="Established third-party businesses"><option value="Third-Party Business — Operations Platform Only">Third-Party Business — Operations Platform Only</option><option value="Third-Party Service Vendor">Third-Party Service Vendor</option><option value="Third-Party Lead Vendor">Third-Party Lead Vendor</option></optgroup></select>`;}
  const companyField=byId("appDesiredCompany")?.closest(".application-field");
  companyField?.insertAdjacentHTML("beforebegin",`<div class="application-field"><label for="appPathway">Work pathway *</label><select id="appPathway" required><option value="">Select pathway</option><option value="in_house">Evaraos in-house team</option><option value="program">Evaraos program participant</option><option value="independent">Independent freelancer / contractor</option><option value="third_party">Established third-party business</option></select></div>`);
  companyField?.insertAdjacentHTML("afterend",`<div class="application-field"><label for="appCompanyCategory">Company category</label><select id="appCompanyCategory"><option value="">Select category</option><option value="in_house">In-house company</option><option value="program">Program / marketplace</option><option value="independent">Independent contractor</option><option value="third_party">Third-party business</option></select></div>`);

  const market=byId("appDesiredMarket")?.closest(".application-field");
  if(market){market.className="application-field";market.innerHTML=`<label for="appCampaign">Preferred campaign or service *</label><select id="appCampaign" required><option value="">Select campaign</option><option>Pressure Washing</option><option>Trash Bin Cleaning</option><option>House Washing</option><option>Driveway & Sidewalk Cleaning</option><option>Interior Residential Cleaning</option><option>Commercial Cleaning</option><option>Solar Panel Cleaning</option><option>Mobile Car Wash & Detailing</option><option>Lead Generation</option><option>Customer Support</option><option>Operations & Dispatch</option><option>Platform / Data Operations</option></select>`;market.insertAdjacentHTML("afterend",`<div class="application-field"><label for="appPreferredCity">Preferred work city *</label><input id="appPreferredCity" placeholder="Jacksonville, FL" required></div>`);}

  byId("appDriversState")?.closest(".application-field")?.insertAdjacentHTML("afterend",`<div class="application-field"><label for="appDriversNumber">Driver’s license number</label><input id="appDriversNumber" autocomplete="off"></div><div class="application-field"><label for="appDriversExpiration">License expiration date</label><input id="appDriversExpiration" type="date"></div>`);
  byId("appEmergencyPhone")?.closest(".application-field")?.insertAdjacentHTML("afterend",`<div class="application-field full"><label for="appEmergencyEmail">Contact email *</label><input id="appEmergencyEmail" type="email" autocomplete="email" inputmode="email" required></div>`);

  document.querySelectorAll('.application-field input[type="file"]').forEach(input=>input.closest(".application-field")?.classList.add("file-field"));
  document.querySelectorAll(".role-choice").forEach(button=>button.addEventListener("click",()=>{const active=button.classList.toggle("active");button.setAttribute("aria-expanded",String(active));if(active){document.querySelectorAll(".role-choice").forEach(other=>{if(other!==button){other.classList.remove("active");other.setAttribute("aria-expanded","false");}});byId("appRole").value=button.dataset.role||"";}}));
  byId("appRole")?.addEventListener("change",event=>document.querySelectorAll(".role-choice").forEach(button=>button.classList.toggle("active",button.dataset.role===event.target.value)));
  byId("appDriversLicense")?.addEventListener("change",event=>{const disabled=event.target.value!=="yes";["appDriversState","appDriversNumber","appDriversExpiration"].forEach(id=>{const node=byId(id);if(node){node.disabled=disabled;if(disabled)node.value="";}});});
}

function addFooter(){
  if(document.querySelector(".site-footer"))return;
  document.getElementById("appRoot")?.insertAdjacentHTML("beforeend",`<footer class="site-footer"><div class="site-footer-inner glass-card"><div class="site-footer-left"><strong>© 2026 Evaraos Inc</strong><span>Built to power multi-company operations from one system.</span></div><nav class="site-footer-right" aria-label="Evaraos social media"><a class="social-link social-instagram" href="https://instagram.com/evaraos.inc" target="_blank" rel="noopener noreferrer">Instagram</a><a class="social-link social-x" href="https://x.com/evaraos_inc" target="_blank" rel="noopener noreferrer">X</a><a class="social-link social-tiktok" href="https://tiktok.com/@evaraos.inc" target="_blank" rel="noopener noreferrer">TikTok</a></nav></div></footer>`);
}

function init(){
  if(!form)return;upgradePage();addFooter();form.addEventListener("submit",handleSubmit);
  window.EvaraLoader?.markAppReady?.();document.body.classList.remove("app-loading");document.body.classList.add("app-ready");document.documentElement.classList.remove("boot-pending");
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
