'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');

// Source-only renderer fixtures. These do not authenticate users or certify role QA.
async function renderer(role, publicGuest=false) {
  const categories=[];
  const mount={innerHTML:'',querySelector:()=>null};
  const context=vm.createContext({
    window:{location:{pathname:'/dashboard.html'}},
    document:{body:{dataset:{routeGuard:publicGuest?'public':'private'}}},
    localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null},
    requestAnimationFrame: callback=>callback()
  });
  const dependencies={
    mountBottomNav:()=>{},getMount:()=>mount,buildHref:page=>'/'+page,
    getVisibleLinks:()=>({role,authed:!publicGuest}),isCanonicalPublicRoute:()=>publicGuest,
    isCurrentPage:()=>false,isVerifiedSession:()=>false,
    APP_CATEGORIES:{operations:'operations',organizations:'organizations',finance:'finance',customer:'customer',intelligence:'intelligence',system:'system'},
    appsByCategory:value=>{categories.push(value);return{operations:[{id:'jobs',route:'jobs.html',title:'Jobs'}]};},
    canAccessPageName:()=>true,iconSvg:()=>'<svg aria-hidden="true"></svg>',iconNameForApp:()=>'',iconNameForCategory:()=>''
  };
  const module=new vm.SourceTextModule(fs.readFileSync('public/assets/js/nav/nav-render.js','utf8'),{context});
  await module.link(async()=>new vm.SyntheticModule(Object.keys(dependencies),function(){for(const[name,value]of Object.entries(dependencies))this.setExport(name,value);},{context}));
  await module.evaluate();assert.equal(module.namespace.renderNav(),true);
  return { html:mount.innerHTML,categories,normalize:module.namespace.normalizeNavRole };
}
test('all nine canonical roles render and platform_admin uses the owner catalog',async()=>{
  const roles={platform_admin:'owner',owner:'owner',admin:'admin',manager:'admin',sales:'staff',technician:'staff',cleaner:'staff',customer:'customer',vendor:'vendor'};
  for(const[role,category]of Object.entries(roles)){
    const result=await renderer(role);assert.equal(result.normalize(role),category);assert.equal(result.categories[0],category);
    assert.match(result.html,/aria-controls="evaMenuPanel" aria-haspopup="dialog"/);
    assert.match(result.html,/role="dialog" tabindex="-1" inert aria-hidden="true"/);
    assert.match(result.html,/aria-label="Jobs"/);assert.match(result.html,/id="evaSearchInput" aria-label=/);
  }
});
test('public drawer actions have persistent accessible names',async()=>{
  const result=await renderer('guest',true);
  for(const label of ['Login','Sign Up','Apply'])assert(result.html.includes(`aria-label="${label}"`));
  assert.deepEqual(result.categories,[]);
});
