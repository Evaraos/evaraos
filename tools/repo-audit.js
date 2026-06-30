#!/usr/bin/env node
const fs=require("fs"),path=require("path");
const ROOT=path.resolve(__dirname,".."),FIX=process.argv.includes("--fix"),IGNORE=new Set([".git","node_modules","tools/reports"]);
const CSS_VERSION="adaptive-liquid-v1",RUNTIME_VERSION="adaptive-liquid-v1",BOOT_VERSION="1";
const OBSOLETE=[
  "public/assets/js/theme-boot.js",
  "public/assets/js/appearance-mode-fix.js",
  "public/assets/js/theme-css-loader.js",
  "public/assets/css/pages/appearance-fix.css",
  "public/assets/css/components/application-polish.css",
  "public/assets/css/effects/liquid-ui-overrides.css",
  "public/assets/css/components/apple-settings-glass.css",
  "public/assets/css/effects/apple-settings-background.css"
];
function walk(dir,out=[]){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const absolute=path.join(dir,entry.name),relative=path.relative(ROOT,absolute).replace(/\\/g,"/");if(entry.isDirectory()){if(!IGNORE.has(entry.name)&&!IGNORE.has(relative))walk(absolute,out)}else out.push(relative)}return out}
const abs=file=>path.join(ROOT,file),exists=file=>fs.existsSync(abs(file)),read=file=>fs.readFileSync(abs(file),"utf8"),write=(file,content)=>fs.writeFileSync(abs(file),content,"utf8");
function fixHtml(content){return content
  .replace(/\s*<script\s+[^>]*src=["']\/assets\/js\/(?:theme-css-loader|appearance-mode-fix)\.js(?:\?[^"']*)?["'][^>]*><\/script>/gi,"")
  .replace(/\s*<link\s+[^>]*href=["']\/assets\/css\/pages\/appearance-fix\.css(?:\?[^"']*)?["'][^>]*>/gi,"")
  .replace(/<script\s+src=["']\/assets\/js\/(?:theme-boot|adaptive-appearance-boot)\.js(?:\?v=[^"']+)?["']><\/script>/gi,`<script src="/assets/js/adaptive-appearance-boot.js?v=${BOOT_VERSION}"></script>`)
  .replace(/<script\s+type=["']module["']\s+src=["']\/assets\/js\/theme\.js(?:\?v=[^"']+)?["']><\/script>/gi,`<script type="module" src="/assets/js/theme.js?v=${RUNTIME_VERSION}"></script>`)
  .replace(/href=["']\/assets\/css\/theme\.css(?:\?v=[^"']+)?["']/gi,`href="/assets/css/theme.css?v=${CSS_VERSION}"`)
  .replace(/<html([^>]*?)data-theme=["'](?:light|dark|system|image)["']([^>]*)>/gi,'<html$1data-theme="adaptive" data-theme-mode="image"$2>')
  .replace(/\sdata-theme-mode=["'](?:light|dark|system|image)["']/gi,' data-theme-mode="image"')
  .replace(/\s*html\s*,\s*body\s*\{\s*background:\s*#f4f7f6;\s*\}/gi,"")
  .replace(/\s*html\[data-theme=["']dark["']\][^\{]*\{[^}]*\}/gi,"");}
function main(){let files=walk(ROOT),changed=[],removed=[];if(FIX){for(const file of files.filter(name=>name.endsWith(".html"))){const before=read(file),after=fixHtml(before);if(before!==after){write(file,after);changed.push(file)}}for(const file of OBSOLETE){if(exists(file)){fs.rmSync(abs(file));removed.push(file)}}files=walk(ROOT)}
const issues=[];for(const file of files){if(!/\.(?:html|js|css)$/.test(file))continue;const source=read(file);if(file.endsWith(".html")){if(/theme-boot\.js|appearance-mode-fix\.js|theme-css-loader\.js|appearance-fix\.css/.test(source))issues.push(`${file}: obsolete appearance asset`);if(/\/assets\/css\/theme\.css\?v=(?!adaptive-liquid-v1)/.test(source))issues.push(`${file}: stale theme CSS`);if(/\/assets\/js\/theme\.js\?v=(?!adaptive-liquid-v1)/.test(source))issues.push(`${file}: stale theme runtime`);if(/data-theme=["'](?:light|dark|system)["']/.test(source))issues.push(`${file}: legacy mode attribute`)} }
for(const required of ["public/assets/js/theme.js","public/assets/js/theme-core-adaptive.js","public/assets/js/theme-adaptive.js","public/assets/js/adaptive-appearance-boot.js","public/assets/css/theme.css","public/assets/css/theme/adaptive-tokens.css","public/assets/css/theme/adaptive-material.css","public/assets/css/theme/adaptive-components.css"]){if(!exists(required))issues.push(`${required}: missing adaptive core`)}
console.log(JSON.stringify({changed:changed.length,removed,issues},null,2));if(issues.length)process.exitCode=1}
main();
