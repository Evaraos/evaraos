#!/usr/bin/env node
const fs=require("fs");
const path=require("path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const errors=[];
const check=(value,message)=>{if(!value)errors.push(message)};
const core=read("public/assets/js/theme-core-adaptive.js");
const theme=read("public/assets/css/theme.css");
const boot=read("public/assets/js/adaptive-appearance-boot.js");
const chat=read("public/assets/css/pages/messages-imessage-v3.css");
check(core.includes('root.dataset.theme="adaptive"'),"Core must keep one adaptive theme");
check(core.includes('["light","dark","system","image"]'),"Four environments are required");
check(theme.includes("liquid-optics.css?v=3"),"Optical material is missing");
check(theme.includes("liquid-environments.css?v=3"),"Environment tuning is missing");
check(!theme.includes("liquid-image-reference"),"A mode-specific material was reintroduced");
check(boot.includes("evara-boot-lock")&&boot.includes("evara:theme-applied"),"First-paint lock is missing");
check(chat.includes("--msg-blue:0,122,255")&&chat.includes("evara-liquid-refraction-clear"),"Liquid Glass chat bubbles are missing");
if(errors.length){console.error(errors.join("\n"));process.exit(1)}
console.log("Universal Liquid Glass audit passed.");
