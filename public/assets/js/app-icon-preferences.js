const EVARAOS_ICON_KEY = 'evaraos-app-icon';
const OG_ICON_SRC = '/assets/img/brand/evaraos-og-logo.svg';
const E_PATHS = '<path d="M146 168h197c9 0 13 10 8 17l-28 40c-5 7-12 11-21 11H190l-44 43v-67l42-37c6-5 12-7 20-7Z"/><path d="M146 259h171c8 0 12 9 7 16l-25 36c-5 7-12 10-20 10H146Z"/><path d="M146 342h198c9 0 13 10 8 17l-29 41c-5 7-12 11-21 11H146Z"/>';
const E_MARK = '<svg class="app-icon-e" viewBox="0 0 512 512" aria-hidden="true">'+E_PATHS+'</svg>';
const OG_MARK = '<img class="app-icon-og-img" src="'+OG_ICON_SRC+'" alt="" aria-hidden="true">';

const EVARAOS_APP_ICONS = {
  primaryRed:{id:'primaryRed',label:'1. Primary Red',tone:'red',description:'Primary Evaraos Liquid Glass icon.'},
  coreWhite:{id:'coreWhite',label:'2. Core White',tone:'light',description:'White glass shell with the red E mark.'},
  darkCore:{id:'darkCore',label:'3. Dark Core',tone:'dark',description:'Black glass shell with the white E mark.'},
  clearGlass:{id:'clearGlass',label:'4. Clear Glass',tone:'dark',description:'Clear glass edge with the white E mark.'},
  redGlow:{id:'redGlow',label:'5. Red Glow',tone:'red',description:'Dark shell with glowing red E.'},
  matteBlack:{id:'matteBlack',label:'6. Matte Black',tone:'dark',description:'Black-on-black executive icon.'},
  stripedRed:{id:'stripedRed',label:'7. Striped Red',tone:'red',description:'Red glass with diagonal motion lines.'},
  waveWhite:{id:'waveWhite',label:'8. Wave White',tone:'light',description:'White liquid texture with red E.'},
  hexBlack:{id:'hexBlack',label:'9. Hex Black',tone:'dark',description:'Technical black hex texture.'},
  pulse:{id:'pulse',label:'10. Pulse',tone:'red',description:'Red pulse glass icon.'},
  frosted:{id:'frosted',label:'11. Frosted',tone:'dark',description:'Frosted chrome dark glass.'},
  outlineRed:{id:'outlineRed',label:'12. Outline Red',tone:'dark',description:'Black shell with red E and outline.'},
  fabricCoin:{id:'fabricCoin',label:'13. Fabric Coin',tone:'red',description:'Coin badge version.'},
  loadingOrbit:{id:'loadingOrbit',label:'14. Loading Orbit',tone:'red',description:'Orbiting E loading icon.'},
  progress:{id:'progress',label:'15. Progress',tone:'dark',description:'Circular progress version.'},
  crystal:{id:'crystal',label:'16. Crystal',tone:'red',description:'Faceted red crystal glass.'},
  topography:{id:'topography',label:'17. Topography',tone:'light',description:'White topographic texture.'},
  halftone:{id:'halftone',label:'18. Halftone',tone:'dark',description:'Black and red halftone style.'},
  liquidFlow:{id:'liquidFlow',label:'19. Liquid Flow',tone:'red',description:'Liquid red motion background.'},
  stardust:{id:'stardust',label:'20. Stardust',tone:'dark',description:'Black star-particle glass.'},
  standaloneGlass:{id:'standaloneGlass',label:'21. Standalone Glass E',tone:'red',standalone:true,description:'Clear Liquid Glass E without a square.'},
  standaloneRed:{id:'standaloneRed',label:'22. Red E',tone:'red',standalone:true,description:'Standalone red E mark.'},
  standaloneBlack:{id:'standaloneBlack',label:'23. Black E',tone:'dark',standalone:true,description:'Standalone black E mark.'},
  standaloneClear:{id:'standaloneClear',label:'24. Clear E',tone:'light',standalone:true,description:'Transparent glass E mark.'},
  standaloneAbstract:{id:'standaloneAbstract',label:'25. Abstract E',tone:'red',standalone:true,description:'Standalone E with abstract liquid texture.'},
  ogLogo:{id:'ogLogo',label:'26. OG Logo',tone:'red',og:true,description:'Original Evaraos orbit logo.'}
};

function currentIconId(){try{const stored=localStorage.getItem(EVARAOS_ICON_KEY);return EVARAOS_APP_ICONS[stored]?stored:'primaryRed'}catch{return'primaryRed'}}
function iconSrc(icon){if(icon.og)return OG_ICON_SRC;return icon.id==='primaryRed'?'/assets/img/brand/evaraos-mark-red.svg':svgData(icon)}
function upsertLink(rel,href,attrs){let link=document.querySelector('link[rel="'+rel+'"]');if(!link){link=document.createElement('link');link.rel=rel;document.head.appendChild(link)}link.href=href+(href.startsWith('data:')?'':'?v=evaraos-icon-system-27');Object.entries(attrs||{}).forEach(([k,v])=>link.setAttribute(k,v))}
function themeColor(icon){return icon.tone==='light'?'#f4f7f6':icon.tone==='dark'?'#050506':'#e30613'}
function applyIcon(id){const icon=EVARAOS_APP_ICONS[id]||EVARAOS_APP_ICONS.primaryRed;document.documentElement.dataset.evaraosAppIcon=icon.id;upsertLink('icon',iconSrc(icon),{type:'image/svg+xml'});upsertLink('apple-touch-icon','/assets/img/brand/evaraos-mark-red.svg',{});const themeMeta=document.querySelector('meta[name="theme-color"]');if(themeMeta)themeMeta.setAttribute('content',themeColor(icon));document.querySelectorAll('[data-evaraos-brand-icon]').forEach(node=>{if(node.tagName==='IMG')node.setAttribute('src',iconSrc(icon));node.style.setProperty('--evaraos-brand-icon',"url('"+iconSrc(icon)+"')")});return icon}
function saveIcon(id){const icon=EVARAOS_APP_ICONS[id]||EVARAOS_APP_ICONS.primaryRed;try{localStorage.setItem(EVARAOS_ICON_KEY,icon.id)}catch{}return applyIcon(icon.id)}
function svgData(icon){const eClass='e-'+icon.id;const html='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><style>'+svgCss()+'</style><rect class="bg '+eClass+'" x="34" y="34" width="444" height="444" rx="110"/>'+svgEffects(icon)+svgMark(icon)+'</svg>';return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(html)}
function svgCss(){return '.bg{fill:#08090c}.e-coreWhite,.e-waveWhite,.e-topography{fill:#f6f7f9}.e-primaryRed,.e-stripedRed,.e-pulse,.e-crystal,.e-liquidFlow{fill:#b80010}.e-darkCore,.e-clearGlass,.e-hexBlack,.e-frosted,.e-halftone,.e-stardust{fill:#0b0c10}.mark{fill:#fff}.redmark{fill:#e30613}.darkmark{fill:#070708}.line{fill:none;stroke:#fff;stroke-opacity:.25;stroke-width:10}.ring{fill:none;stroke:#e30613;stroke-width:20}'}
function svgMark(icon){const cls=icon.id==='coreWhite'||icon.id==='outlineRed'||icon.id==='halftone'||icon.id==='topography'||icon.id==='redGlow'||icon.id==='standaloneRed'||icon.id==='standaloneAbstract'?'redmark':icon.id==='matteBlack'||icon.id==='standaloneBlack'?'darkmark':'mark';const scale=icon.standalone?'translate(12 8) scale(.98)':'translate(0 0)';return '<g class="'+cls+'" transform="'+scale+'">'+E_PATHS+'</g>'}
function svgEffects(icon){if(icon.standalone)return '';if(icon.id==='fabricCoin')return '<circle class="ring" cx="256" cy="256" r="205" stroke-dasharray="14 14"/>';if(icon.id==='loadingOrbit')return '<circle class="ring" cx="256" cy="256" r="200"/><circle fill="#e30613" cx="64" cy="256" r="26"/><circle fill="#e30613" cx="448" cy="256" r="26"/>';if(icon.id==='progress')return '<path class="ring" d="M256 56a200 200 0 0 1 178 292"/>';if(icon.id==='stripedRed')return '<path class="line" d="M40 350 350 40M110 470 470 110"/>';if(icon.id==='stardust')return '<circle fill="#fff" opacity=".55" cx="140" cy="100" r="4"/><circle fill="#fff" opacity=".35" cx="380" cy="180" r="3"/><circle fill="#fff" opacity=".3" cx="300" cy="410" r="3"/>';return '<path class="line" d="M88 96c88-44 205-48 336-12"/>'}
function renderIconButton(icon,current){return '<button class="app-icon-choice '+(icon.id===current?'is-active':'')+'" type="button" data-app-icon-choice="'+icon.id+'" aria-pressed="'+(icon.id===current)+'"><span class="app-icon-preview app-icon-preview--'+icon.id+' '+(icon.standalone?'is-standalone':'')+'">'+(icon.og?OG_MARK:E_MARK)+'</span><span class="app-icon-copy"><strong>'+icon.label+'</strong><span>'+icon.description+'</span></span></button>'}
function renderPicker(){const grid=document.querySelector('[data-app-icon-grid]');if(!grid)return;const current=currentIconId();grid.innerHTML=Object.values(EVARAOS_APP_ICONS).map(icon=>renderIconButton(icon,current)).join('');hydrateIconPicker()}
function hydrateIconPicker(){document.querySelectorAll('[data-app-icon-choice]').forEach(button=>{button.addEventListener('click',()=>{const selected=saveIcon(button.dataset.appIconChoice);document.querySelectorAll('[data-app-icon-choice]').forEach(choice=>{const active=choice.dataset.appIconChoice===selected.id;choice.classList.toggle('is-active',active);choice.setAttribute('aria-pressed',String(active))});const status=document.getElementById('appIconSaveStatus');if(status){status.textContent=selected.label+' selected. iPhone Home Screen may require removing and re-adding the saved web app.';status.hidden=false}})})}
window.EvaraosAppIcons={icons:EVARAOS_APP_ICONS,applyIcon,saveIcon,currentIconId,renderPicker};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{applyIcon(currentIconId());renderPicker()},{once:true});else{applyIcon(currentIconId());renderPicker()}
