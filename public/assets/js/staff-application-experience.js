import { db, collection, getDocs } from "./firebase.js";

const ROLES = [
  {value:"sales_rep",label:"Sales Representative",eyebrow:"Growth",summary:"Build relationships and convert service opportunities.",details:"Sales Representatives introduce customers to Evaraos-powered services, qualify needs, create accurate quotes, follow opportunities through the pipeline, and maintain professional communication from first contact through booking. This role can include field canvassing, referral development, follow-up, and account growth."},
  {value:"lead_generator",label:"Lead Generator",eyebrow:"Demand",summary:"Create qualified opportunities through field and digital outreach.",details:"Lead Generators identify potential customers, collect accurate contact and property information, explain the value of available services, and route qualified opportunities to the correct sales or operating team. Success depends on consistency, clear notes, territory awareness, and respectful customer engagement."},
  {value:"sales_manager",label:"Sales Manager",eyebrow:"Leadership",summary:"Coach representatives and oversee pipeline performance.",details:"Sales Managers guide the sales team, review lead quality, support territory strategy, monitor conversion performance, coach representatives, and help resolve difficult opportunities. They work closely with operations so that promises made during the sales process match actual service capacity."},
  {value:"technician",label:"Technician",eyebrow:"Field Service",summary:"Complete assigned services safely and document every job.",details:"Technicians perform scheduled field services, follow company procedures, inspect the work area, use equipment responsibly, capture before-and-after documentation, communicate job status, and protect the customer experience. The exact service mix depends on the selected campaign and company."},
  {value:"lead_technician",label:"Lead Technician",eyebrow:"Field Leadership",summary:"Lead crews and protect service quality.",details:"Lead Technicians coordinate crews, verify equipment and materials, support training, confirm safety requirements, review job evidence, and make sure completed work meets company standards. They also help field teams solve problems without losing schedule control."},
  {value:"cleaner",label:"Cleaner",eyebrow:"Interior Service",summary:"Deliver dependable residential or commercial cleaning.",details:"Cleaners complete assigned interior or commercial cleaning work using the job checklist, document completion, protect customer property, communicate supply or access issues, and maintain consistent quality. Assignments may be recurring, one-time, residential, commercial, or marketplace-based."},
  {value:"lead_cleaner",label:"Lead Cleaner",eyebrow:"Team Quality",summary:"Coordinate cleaning teams and inspect completed work.",details:"Lead Cleaners organize team assignments, confirm supplies, support newer cleaners, inspect completed areas, address quality concerns, and communicate with operations when a job requires additional time or resources."},
  {value:"crew_lead",label:"Crew Lead",eyebrow:"Execution",summary:"Coordinate people, materials, and field completion.",details:"Crew Leads keep assigned teams organized from departure through completion. They confirm attendance, equipment, routing, customer instructions, work distribution, documentation, and closeout so every team member knows what success looks like."},
  {value:"dispatcher",label:"Dispatcher",eyebrow:"Scheduling",summary:"Keep jobs, routes, and field communication moving.",details:"Dispatchers assign jobs, monitor schedules, communicate changes, resolve routing conflicts, track arrivals, and keep customers and field staff informed. The role requires strong judgment, calm communication, and accurate updates inside Evaraos."},
  {value:"operations_coordinator",label:"Operations Coordinator",eyebrow:"Operations",summary:"Support daily scheduling, records, and customer flow.",details:"Operations Coordinators connect the office, field, customers, and management. They maintain schedules, organize documentation, follow up on incomplete tasks, support service recovery, and help make sure information moves to the correct team."},
  {value:"field_manager",label:"Field Manager",eyebrow:"Management",summary:"Oversee field teams, safety, and route performance.",details:"Field Managers are responsible for field execution across teams and territories. They review productivity, job quality, safety, staffing, route performance, equipment needs, and escalations while helping crews operate at a consistent professional standard."},
  {value:"quality_control",label:"Quality Control",eyebrow:"Standards",summary:"Review evidence and protect service quality.",details:"Quality Control reviewers inspect photos, checklists, customer feedback, and job records to confirm that work meets the expected standard. They document issues, request corrections, identify recurring problems, and help improve training and operating procedures."},
  {value:"customer_support",label:"Customer Support",eyebrow:"Customer Care",summary:"Help customers before, during, and after service.",details:"Customer Support team members assist with booking questions, schedule updates, account access, service details, billing concerns, and service recovery. They document every interaction clearly and coordinate with the correct operating team when action is needed."},
  {value:"hr",label:"Human Resources",eyebrow:"People",summary:"Support hiring, onboarding, records, and staff communication.",details:"Human Resources supports recruiting, application review, onboarding, staff records, policy communication, training coordination, and workplace concerns. The role protects both the applicant experience and the operating standards of Evaraos companies and programs."},
  {value:"staff",label:"General Staff",eyebrow:"Flexible",summary:"Join where your experience fits the operation best.",details:"General Staff applicants are considered for flexible operating, office, customer, or field assignments based on experience, availability, selected campaign, and current business needs. Leadership may recommend a more specific role during review."}
];

const PATHWAYS = [
  {value:"in_house",title:"Join an Evaraos company",label:"In-house team",copy:"Apply directly to an operating company with company leadership, assignments, standards, and internal workflows."},
  {value:"program",title:"Join an Evaraos program",label:"Program pathway",copy:"Participate in a structured marketplace, lead-vendor, or service-vendor program while operating through the platform."},
  {value:"independent",title:"Work independently",label:"Freelancer / contractor",copy:"Use Evaraos like a flexible earning platform, accepting eligible opportunities without joining one specific company."},
  {value:"third_party",title:"Connect an existing business",label:"Third-party business",copy:"Bring an established company onto Evaraos for operations, data, dispatch, leads, or service-vendor workflows."}
];

const TERRITORIES = ["Downtown / Urban Core","Northside / Airport","Arlington","Southside","The Beaches","Westside","Mandarin","Orange Park / Clay","St. Johns","Ponte Vedra"];

const byId=id=>document.getElementById(id);

function ensureHidden(id,value=""){
  let node=byId(id);
  if(!node){node=document.createElement("input");node.type="hidden";node.id=id;node.name=id;document.getElementById("staffApplicationForm")?.appendChild(node);}
  if(value&&!node.value)node.value=value;
  return node;
}

function buildRoleCarousel(){
  const roleField=byId("appRole")?.closest(".application-field");
  if(!roleField||document.querySelector(".role-showcase"))return;
  document.querySelectorAll(".role-explorer").forEach(n=>n.remove());
  let index=Math.max(0,ROLES.findIndex(r=>r.value===byId("appRole")?.value));
  const wrap=document.createElement("section");
  wrap.className="role-showcase application-field full";
  wrap.innerHTML=`<div class="experience-heading"><div><span>Explore staff roles</span><h3>Find the role that fits how you work.</h3></div><div class="role-counter"><b id="roleCurrent">01</b><span>/ ${String(ROLES.length).padStart(2,"0")}</span></div></div><div class="role-stage"><button type="button" class="role-arrow role-prev" aria-label="Previous role">‹</button><article class="role-feature"><p class="role-eyebrow"></p><h4></h4><p class="role-summary"></p><div class="role-details" hidden></div><div class="role-feature-actions"><button type="button" class="role-view">View role</button><button type="button" class="role-select">Select this role</button></div></article><button type="button" class="role-arrow role-next" aria-label="Next role">›</button></div><div class="role-progress" aria-label="Role carousel position"></div>`;
  roleField.before(wrap);
  const card=wrap.querySelector(".role-feature"),details=wrap.querySelector(".role-details"),view=wrap.querySelector(".role-view");
  function render(){
    const role=ROLES[index];
    wrap.querySelector(".role-eyebrow").textContent=role.eyebrow;
    wrap.querySelector("h4").textContent=role.label;
    wrap.querySelector(".role-summary").textContent=role.summary;
    details.textContent=role.details;details.hidden=true;view.textContent="View role";
    wrap.querySelector("#roleCurrent").textContent=String(index+1).padStart(2,"0");
    wrap.querySelector(".role-progress").innerHTML=ROLES.map((_,i)=>`<button type="button" aria-label="Show ${ROLES[i].label}" class="${i===index?'active':''}" data-role-index="${i}"></button>`).join("");
    card.dataset.role=role.value;
  }
  wrap.addEventListener("click",e=>{
    if(e.target.closest(".role-prev")){index=(index-1+ROLES.length)%ROLES.length;render();}
    if(e.target.closest(".role-next")){index=(index+1)%ROLES.length;render();}
    const dot=e.target.closest("[data-role-index]");if(dot){index=Number(dot.dataset.roleIndex);render();}
    if(e.target.closest(".role-view")){details.hidden=!details.hidden;view.textContent=details.hidden?"View role":"Hide details";}
    if(e.target.closest(".role-select")){byId("appRole").value=ROLES[index].value;wrap.classList.add("has-selection");wrap.querySelector(".role-select").textContent="Selected";setTimeout(()=>wrap.querySelector(".role-select").textContent="Select this role",1200);}
  });
  render();
}

async function loadCompanies(){
  const fallback=["Supreme True Clean","OneofOne Cleaning","Evaraos Inc"];
  try{
    const snapshot=await getDocs(collection(db,"companies"));
    const live=snapshot.docs.map(d=>({id:d.id,...d.data()})).filter(c=>String(c.status||"active").toLowerCase()!=="inactive").map(c=>c.name||c.companyName||c.title).filter(Boolean);
    return [...new Set([...fallback,...live])];
  }catch(error){console.warn("Using fallback company list:",error);return fallback;}
}

async function buildPathways(){
  const pathwayField=byId("appPathway")?.closest(".application-field");
  const companyField=byId("appDesiredCompany")?.closest(".application-field");
  const categoryField=byId("appCompanyCategory")?.closest(".application-field");
  if(!pathwayField||document.querySelector(".pathway-experience"))return;
  pathwayField.hidden=true;companyField.hidden=true;if(categoryField)categoryField.hidden=true;
  const section=document.createElement("section");section.className="pathway-experience application-field full";
  section.innerHTML=`<div class="experience-heading"><div><span>Choose your work pathway</span><h3>How do you want to operate through Evaraos?</h3></div></div><div class="pathway-grid">${PATHWAYS.map(p=>`<button type="button" class="pathway-card" data-pathway="${p.value}"><small>${p.label}</small><strong>${p.title}</strong><span>${p.copy}</span></button>`).join("")}</div><div class="pathway-detail" hidden><div class="pathway-company" hidden><label for="appCompanyChoice">Choose an in-house company</label><select id="appCompanyChoice"><option value="">Loading companies…</option></select><p>Company choices update from the Companies collection as new businesses are added.</p></div><div class="pathway-program" hidden><label for="appProgramChoice">Choose a program</label><select id="appProgramChoice"><option value="">Select program</option><option value="Evaraos Independent Service Program">Independent Service Program</option><option value="Evaraos Lead Vendor Program">Lead Vendor Program</option><option value="Evaraos Service Vendor Program">Service Vendor Program</option><option value="Evaraos Marketplace Partner Program">Marketplace Partner Program</option></select></div><div class="pathway-third-party" hidden><label for="appThirdPartyBusiness">Business name</label><input id="appThirdPartyBusiness" placeholder="Your registered or operating business name"><label for="appThirdPartyUse">How will the business use Evaraos?</label><select id="appThirdPartyUse"><option value="">Select use</option><option>Operations and data only</option><option>Service vendor</option><option>Lead vendor</option><option>Full operating workspace</option></select></div><div class="pathway-independent" hidden><p>You will be reviewed for flexible marketplace opportunities and can operate without joining one in-house company.</p></div></div>`;
  pathwayField.before(section);
  const companies=await loadCompanies();
  const companyChoice=section.querySelector("#appCompanyChoice");companyChoice.innerHTML=`<option value="">Select company</option>${companies.map(c=>`<option value="${c}">${c}</option>`).join("")}`;
  function choose(type){
    byId("appPathway").value=type;byId("appCompanyCategory").value=type;
    section.querySelectorAll(".pathway-card").forEach(c=>c.classList.toggle("active",c.dataset.pathway===type));
    section.querySelector(".pathway-detail").hidden=false;
    ["company","program","third-party","independent"].forEach(k=>section.querySelector(`.pathway-${k}`).hidden=true);
    const key=type==="in_house"?"company":type==="third_party"?"third-party":type;
    section.querySelector(`.pathway-${key}`).hidden=false;
    if(type==="independent")byId("appDesiredCompany").value="Independent Freelancer / Contractor";
  }
  section.addEventListener("click",e=>{const card=e.target.closest("[data-pathway]");if(card)choose(card.dataset.pathway);});
  companyChoice.addEventListener("change",()=>byId("appDesiredCompany").value=companyChoice.value);
  section.querySelector("#appProgramChoice").addEventListener("change",e=>byId("appDesiredCompany").value=e.target.value);
  section.querySelector("#appThirdPartyBusiness").addEventListener("input",e=>byId("appDesiredCompany").value=e.target.value||"Third-Party Business");
}

function organizeCampaigns(){
  const select=byId("appCampaign");if(!select)return;
  select.innerHTML=`<option value="">Select campaign</option><optgroup label="Exterior Cleaning"><option>Pressure Washing</option><option>Trash Bin Cleaning</option><option>House Washing</option><option>Driveway & Sidewalk Cleaning</option><option>Solar Panel Cleaning</option></optgroup><optgroup label="Interior Cleaning"><option>Interior Residential Cleaning</option><option>Commercial Cleaning</option></optgroup><optgroup label="Automotive"><option>Mobile Car Wash & Detailing</option></optgroup><optgroup label="Growth and Support"><option>Lead Generation</option><option>Customer Support</option><option>Operations & Dispatch</option></optgroup><optgroup label="Platform"><option>Platform / Data Operations</option></optgroup>`;
}

function buildTerritories(){
  const input=byId("appPreferredCity");const field=input?.closest(".application-field");if(!field||document.querySelector(".territory-experience"))return;
  input.type="hidden";field.classList.add("territory-experience","full");
  field.insertAdjacentHTML("beforeend",`<div class="experience-heading"><div><span>Preferred territory</span><h3>Select every Jacksonville area that works for you.</h3><p>Your selections help operations understand travel convenience. They do not guarantee assignments.</p></div></div><div class="territory-layout"><div class="territory-map" aria-label="Jacksonville territory selector">${TERRITORIES.map((t,i)=>`<button type="button" class="territory-node territory-${i+1}" data-territory="${t}"><span>${i+1}</span>${t}</button>`).join("")}</div><div class="territory-selection"><strong>Selected territories</strong><p id="territorySummary">None selected yet.</p><button type="button" id="territoryClear">Clear selections</button></div></div>`);
  const selected=new Set();
  const sync=()=>{input.value=[...selected].join(", ");field.querySelector("#territorySummary").textContent=selected.size?[...selected].join(" • "):"None selected yet.";};
  field.addEventListener("click",e=>{const node=e.target.closest("[data-territory]");if(node){const v=node.dataset.territory;selected.has(v)?selected.delete(v):selected.add(v);node.classList.toggle("active",selected.has(v));sync();}if(e.target.closest("#territoryClear")){selected.clear();field.querySelectorAll(".territory-node").forEach(n=>n.classList.remove("active"));sync();}});
}

function fixFooterAndNav(){
  const apply=()=>{const tiktok=document.querySelector('.site-footer a[href*="tiktok.com"]');if(tiktok)tiktok.href="https://tiktok.com/@aviros";};
  apply();setTimeout(apply,300);setTimeout(apply,900);
}

async function init(){
  if(!document.body?.classList.contains("staff-application-page"))return;
  ensureHidden("appPathway");ensureHidden("appCompanyCategory");
  buildRoleCarousel();await buildPathways();organizeCampaigns();buildTerritories();fixFooterAndNav();
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(init,40),{once:true});else setTimeout(init,40);
