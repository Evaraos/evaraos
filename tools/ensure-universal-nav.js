#!/usr/bin/env node
const fs=require("fs");
const path=require("path");
const root=path.resolve(__dirname,"../public");
const THEME="adaptive-liquid-v6";
const NAV="nav-v25-x-drawer";

function walk(dir,out=[]){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p,out);else if(e.name.endsWith(".html"))out.push(p)}return out}
function strip(html,pattern){return html.replace(pattern,"")}

const changed=[];
for(const file of walk(root)){
  let html=fs.readFileSync(file,"utf8");
  if(!/<body\b/i.test(html))continue;
  const before=html;

  html=html.replace(/<html([^>]*)>/i,(all,attrs)=>`<html${attrs.replace(/\sdata-theme=("[^"]*"|'[^']*')/gi,"").replace(/\sdata-theme-mode=("[^"]*"|'[^']*')/gi,"").replace(/\sdata-appearance=("[^"]*"|'[^']*')/gi,"")} data-theme="adaptive" data-theme-mode="image" data-appearance="adaptive-image">`);
  html=strip(html,/\s*<script[^>]+(?:theme-boot|appearance-mode-fix|adaptive-appearance-boot)\.js[^>]*><\/script>\s*/gi);
  html=strip(html,/\s*<script[^>]+src=["']\/assets\/js\/(?:theme|nav)\.js[^>]*><\/script>\s*/gi);

  if(!/id=["']universalNavRoot["']/.test(html))html=html.replace(/<body([^>]*)>/i,'<body$1>\n  <div id="universalNavRoot"></div>');
  html=html.replace(/href=["']\/assets\/css\/theme\.css(?:\?[^"']*)?["']/gi,`href="/assets/css/theme.css?v=${THEME}"`);
  html=html.replace(/href=["']\/assets\/css\/nav\.css(?:\?[^"']*)?["']/gi,`href="/assets/css/nav.css?v=${NAV}"`);
  if(!/\/assets\/css\/theme\.css/.test(html))html=html.replace(/<\/head>/i,`  <link rel="stylesheet" href="/assets/css/theme.css?v=${THEME}" />\n</head>`);
  if(!/\/assets\/css\/nav\.css/.test(html))html=html.replace(/<\/head>/i,`  <link rel="stylesheet" href="/assets/css/nav.css?v=${NAV}" />\n</head>`);

  const boot='<script src="/assets/js/adaptive-appearance-boot.js?v=2"></script>';
  html=/<meta\s+charset=[^>]+>/i.test(html)?html.replace(/(<meta\s+charset=[^>]+>)/i,`$1\n  ${boot}`):html.replace(/<head>/i,`<head>\n  ${boot}`);
  html=html.replace(/<\/body>/i,`  <script type="module" src="/assets/js/theme.js?v=${THEME}"></script>\n  <script type="module" src="/assets/js/nav.js?v=${NAV}"></script>\n</body>`);
  html=html.replace(/<meta\s+name=["']theme-color["'][^>]*>/i,'<meta name="theme-color" content="#111827" />');
  html=html.replace(/\n{3,}/g,"\n\n");

  if(html!==before){fs.writeFileSync(file,html,"utf8");changed.push(path.relative(root,file).replace(/\\/g,"/"))}
}
console.log(`Updated ${changed.length} public HTML page(s) for the single adaptive runtime.`);
for(const f of changed)console.log(`- ${f}`);
