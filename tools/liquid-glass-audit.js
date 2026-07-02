#!/usr/bin/env node
const fs=require("fs");
const path=require("path");
const root=path.resolve(__dirname,"..");
const errors=[];
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const test=(ok,msg)=>{if(!ok)errors.push(msg)};
const core=read("public/assets/js/theme-core-adaptive.js");
const boot=read("public/assets/js/adaptive-appearance-boot.js");
const theme=read("public/assets/css/theme.css");
const optics=read("public/assets/css/theme/liquid-optics.css");
const messages=read("public/assets/css/pages/messages-imessage-v3.css");
test(core.includes('["light","dark","system","image"]'),"four appearance modes missing");
test(boot.includes("adaptive-liquid-v7")&&boot.includes("evara-boot-lock"),"v7 prepaint lock missing");
test(theme.includes("liquid-optics.css?v=1"),"optical layer not loaded last");
test(optics.includes("evara-liquid-refraction")&&optics.includes("--evara-wallpaper-image"),"environment refraction missing");
test(messages.includes("--msg-blue:0,122,255")&&messages.includes("evara-liquid-refraction-clear"),"Liquid Glass chat bubbles missing");
const pages=[];(function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())walk(file);else if(item.name.endsWith(".html"))pages.push(file)}})(path.join(root,"public"));
for(const file of pages){const html=fs.readFileSync(file,"utf8"),name=path.relative(root,file);test(html.includes("adaptive-appearance-boot.js?v=2"),`${name}: boot`);test(html.includes("theme.css?v=adaptive-liquid-v7"),`${name}: theme css`);test(html.includes("theme.js?v=adaptive-liquid-v7"),`${name}: theme js`);test(html.includes("nav.css?v=nav-v25-x-drawer"),`${name}: nav css`);test(html.includes("nav.js?v=nav-v25-x-drawer"),`${name}: nav js`);test(!html.includes("theme-boot.js")&&!html.includes("appearance-mode-fix.js"),`${name}: legacy loader`)}
if(errors.length){console.error(errors.join("\n"));process.exit(1)}
console.log(`Liquid Glass audit passed for ${pages.length} pages.`);
