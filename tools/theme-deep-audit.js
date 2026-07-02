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
    if(!text.includes("adaptive-appearance-boot.js?v=2"))errors.push(`${name}: missing prepaint boot v2`);
    if(!text.includes("theme.css?v=adaptive-liquid-v7"))errors.push(`${name}: stale theme stylesheet`);
    if(!text.includes("theme.js?v=adaptive-liquid-v7"))errors.push(`${name}: stale theme runtime`);
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
const theme=fs.readFileSync(path.join(publicRoot,"assets/css/theme.css"),"utf8");
for(const required of ["liquid-functional-cards.css?v=1","liquid-functional-controls.css?v=1"])if(!theme.includes(required))errors.push(`theme.css: missing ${required}`);
console.log(`Scanned ${files.length} public HTML/CSS/JS files.`);
if(warnings.length){console.log(`Warnings (${warnings.length}):`);warnings.forEach(x=>console.log(`- ${x}`))}
if(errors.length){console.error(`Errors (${errors.length}):`);errors.forEach(x=>console.error(`- ${x}`));process.exit(1)}
console.log("Liquid Glass deep audit passed.");
