#!/usr/bin/env node
const fs=require("fs");
const os=require("os");
const path=require("path");
const {execFileSync}=require("child_process");
const ROOT=path.resolve(__dirname,"..");
const failures=[];
const read=relative=>fs.readFileSync(path.join(ROOT,relative),"utf8");
const check=(name,condition,detail)=>{if(!condition)failures.push(`${name}: ${detail}`)};
function syntax(relative){const temporary=path.join(os.tmpdir(),`evaraos-${path.basename(relative,".js")}-${process.pid}.mjs`);try{fs.writeFileSync(temporary,read(relative),"utf8");execFileSync(process.execPath,["--check",temporary],{stdio:"pipe"})}catch(error){failures.push(`${relative}: JavaScript syntax check failed\n${String(error.stderr||error.message)}`)}finally{try{fs.rmSync(temporary,{force:true})}catch{}}}
const javascriptFiles=["public/assets/js/adaptive-appearance-boot.js","public/assets/js/theme-adaptive.js","public/assets/js/theme-text-inversion.js","public/assets/js/theme-core-adaptive.js","public/assets/js/theme.js","public/assets/js/nav.js","public/assets/js/nav/nav-main-v5.js","public/assets/js/nav/nav-render.js","public/assets/js/nav/nav-menu.js","public/assets/js/nav/nav-interactions.js","public/assets/js/nav/nav-bottom.js"];
javascriptFiles.forEach(syntax);
const menuCss=read("public/assets/css/nav/nav-menu-liquid.css");
const cleanControls=read("public/assets/css/nav/nav-menu-clean-controls.css");
const bottomCss=read("public/assets/css/nav/nav-bottom.css");
const navRender=read("public/assets/js/nav/nav-render.js");
const materialCss=read("public/assets/css/theme/adaptive-material.css");
const componentsCss=read("public/assets/css/theme/adaptive-components.css");
const adaptiveJs=read("public/assets/js/theme-adaptive.js");
const textJs=read("public/assets/js/theme-text-inversion.js");
const bootJs=read("public/assets/js/adaptive-appearance-boot.js");
const navEntry=read("public/assets/js/nav.js");
const themeEntry=read("public/assets/js/theme.js");
check("drawer-width",menuCss.includes("width:min(75vw,460px)"),"drawer must cover 75% of mobile width and remain capped on desktop");
check("drawer-origin",menuCss.includes("inset:0 auto 0 0")&&menuCss.includes("translate3d(-104%,0,0)"),"drawer must be full-height and enter from the left");
check("drawer-open",menuCss.includes("body.nav-menu-open .eva-menu-panel")&&menuCss.includes("translate3d(0,0,0)"),"open state must restore the drawer to x=0");
check("hybrid-groups",navRender.includes("eva-menu-glass-group")&&menuCss.includes(".eva-menu-glass-group"),"Account and AI must remain intentional glass groups");
check("flat-categories",navRender.includes('<section class="eva-app-section">')&&!navRender.includes('<section class="eva-app-section" data-glass='),"application categories must remain flat sections");
check("selected-menu-only",cleanControls.includes('[data-active="true"]')&&cleanControls.includes("background:transparent!important"),"menu rows must be transparent except selected or pressed states");
check("selected-bottom-only",bottomCss.includes('.eva-bottom-link.is-active')&&bottomCss.includes("background:transparent")&&bottomCss.includes('[aria-current="page"]'),"bottom-nav links must be transparent except the current page");
const materialControlLine=materialCss.split("\n").find(line=>line.includes("--glass-x:28%"))||"";
check("nav-theme-separation",!materialControlLine.includes(",.eva-bottom-link,")&&!materialControlLine.includes(",.eva-profile-trigger,")&&!materialControlLine.includes(",.eva-top-alert,"),"global material must not force bubbles onto navigation controls");
check("no-difference-blend",!componentsCss.includes("mix-blend-mode:difference")&&!adaptiveJs.includes("mix-blend-mode:difference"),"text inversion must not use difference blending");
check("animated-text-stops",componentsCss.includes("@property --adaptive-text-c0")&&componentsCss.includes("background-clip:text"),"text gradients must use animated typed color stops");
check("cached-pixels",adaptiveJs.includes("pixels=x.getImageData")&&adaptiveJs.includes("TEXT_X=[.04,.27,.5,.73,.96]"),"adaptive text must sample from a cached pixel buffer");
check("all-text-coverage",textJs.includes("createTreeWalker")&&textJs.includes("NodeFilter.SHOW_TEXT"),"all visible text nodes must be wrapped for adaptive gradients");
check("paint-lock",bootJs.includes("evara-boot-lock")&&bootJs.includes("evara-theme-painted"),"startup must hide legacy paint until adaptive CSS is active");
check("nav-build",navEntry.includes("nav-v25-x-drawer"),"navigation entry must load v25");
check("theme-build",themeEntry.includes("adaptive-liquid-v6"),"theme entry must load v6");
const htmlFiles=[];function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else if(entry.name.endsWith(".html"))htmlFiles.push(full)}}walk(path.join(ROOT,"public"));
for(const file of htmlFiles){const html=fs.readFileSync(file,"utf8"),relative=path.relative(ROOT,file);check(`${relative}-boot`,html.includes("adaptive-appearance-boot.js?v=2")&&!html.includes("theme-boot.js"),"page must use only the adaptive prepaint boot");check(`${relative}-theme`,html.includes("theme.css?v=adaptive-liquid-v6")&&html.includes("theme.js?v=adaptive-liquid-v6"),"page theme assets must be synchronized");check(`${relative}-nav`,html.includes("nav.css?v=nav-v25-x-drawer")&&html.includes("nav.js?v=nav-v25-x-drawer"),"page nav assets must be synchronized")}
if(failures.length){console.error(`Interface audit failed with ${failures.length} issue(s):`);failures.forEach(failure=>console.error(`- ${failure}`));process.exit(1)}
console.log(`Interface audit passed: ${javascriptFiles.length} JavaScript files, ${htmlFiles.length} HTML pages and 16 architecture checks.`);
