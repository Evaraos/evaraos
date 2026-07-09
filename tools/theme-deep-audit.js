#!/usr/bin/env node
const fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,".."),publicRoot=path.join(root,"public"),errors=[],warnings=[],files=[];
(function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,item.name);if(item.isDirectory())walk(full);else if(/\.(html|css|js)$/.test(item.name))files.push(full)}})(publicRoot);
const rel=file=>path.relative(root,file).replace(/\\/g,"/");
for(const file of files){
  const name=rel(file),text=fs.readFileSync(file,"utf8");
  if(file.endsWith(".html")){
    const count=(text.match(/\/assets\/css\/theme\.css/g)||[]).length;
    if(count!==1)errors.push(`${name}: expected one theme.css link, found ${count}`);
    if(!/adaptive-appearance-boot\.js\?v=\d+/.test(text))errors.push(`${name}: missing versioned prepaint boot`);
    if(!/theme\.css\?v=[^"']+/.test(text))errors.push(`${name}: missing versioned theme stylesheet`);
    if(!/theme\.js\?v=[^"']+/.test(text))errors.push(`${name}: missing versioned theme runtime`);
    if(/theme-boot\.js|appearance-mode-fix\.js|adaptive-liquid-v[1-6](?!\d)/.test(text))errors.push(`${name}: legacy theme asset remains`);
  }
  if(file.endsWith(".css")){
    if(/\*\s*var\(|var\([^)]*\)\s*\*/.test(text))errors.push(`${name}: unsupported multiplication inside CSS calculation`);
    if(name.startsWith("public/assets/css/pages/")&&/backdrop-filter\s*:/.test(text))warnings.push(`${name}: page-level backdrop material should be reviewed`);
  }
  if(file.endsWith(".js")&&!/adaptive-appearance-boot|theme-core-adaptive|theme\.js$/.test(name)){
    if(/dataset\.theme\s*=\s*["'`](light|dark|image|system)["'`]/.test(text))errors.push(`${name}: directly changes the universal theme`);
    if(/setAttribute\(["']data-theme["']\s*,\s*["'](light|dark|image|system)["']/.test(text))errors.push(`${name}: directly changes the universal theme`);
  }
}

const themePath=path.join(publicRoot,"assets/css/theme.css");
const opticsPath=path.join(publicRoot,"assets/css/theme/liquid-optics.css");
const cardsPath=path.join(publicRoot,"assets/css/theme/liquid-functional-cards.css");
const theme=fs.readFileSync(themePath,"utf8");
const optics=fs.readFileSync(opticsPath,"utf8");
const cards=fs.readFileSync(cardsPath,"utf8");

for(const required of [
  /base\/variables\.css\?v=\d+/,
  /liquid-optics\.css\?v=\d+/,
  /liquid-functional-cards\.css\?v=\d+/,
  /liquid-functional-controls\.css\?v=\d+/,
  /design-system\/primitives\.css\?v=\d+/
])if(!required.test(theme))errors.push(`theme.css: missing ${required}`);

if(/adaptive-material\.css/.test(theme))errors.push("theme.css: retired adaptive-material.css is still imported");
if(!/AUTHORITATIVE MATERIAL ENGINE/.test(optics))errors.push("liquid-optics.css: missing authoritative material declaration");

const forbiddenCardPaint=/(^|[;{}]\s*)(background(?:-image|-color)?|box-shadow|backdrop-filter|-webkit-backdrop-filter|border(?:-color|-width|-style)?)\s*:/m;
if(forbiddenCardPaint.test(cards))errors.push("liquid-functional-cards.css: material painting detected; only custom-property presets and interaction states are allowed");

for(const requiredVariable of [
  "--lg-surface-fill",
  "--lg-surface-edge",
  "--lg-surface-blur",
  "--lg-surface-shadow-y",
  "--lg-surface-highlight-alpha"
])if(!optics.includes(requiredVariable))errors.push(`liquid-optics.css: missing ${requiredVariable}`);

console.log(`Scanned ${files.length} public HTML/CSS/JS files.`);
if(warnings.length){console.log(`Warnings (${warnings.length}):`);warnings.forEach(x=>console.log(`- ${x}`))}
if(errors.length){console.error(`Errors (${errors.length}):`);errors.forEach(x=>console.error(`- ${x}`));process.exit(1)}
console.log("Liquid Glass deep audit passed.");
