#!/usr/bin/env node
const fs=require("fs");
const path=require("path");
const root=path.resolve(__dirname,"../public");
const THEME="adaptive-liquid-v8";
const NAV="nav-v59-experience-builder";
const BOOT="/assets/js/adaptive-appearance-boot-v4.js?v=4";

function walk(dir,out=[]){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())walk(file,out);
    else if(entry.name.endsWith(".html"))out.push(file);
  }
  return out;
}

const changed=[];
for(const file of walk(root)){
  let html=fs.readFileSync(file,"utf8");
  if(!/<body\b/i.test(html))continue;
  const before=html;

  html=html.replace(/<html([^>]*)>/i,(all,attrs)=>`<html${attrs.replace(/\sdata-theme=("[^"]*"|'[^']*')/gi,"").replace(/\sdata-environment=("[^"]*"|'[^']*')/gi,"").replace(/\sdata-theme-mode=("[^"]*"|'[^']*')/gi,"").replace(/\sdata-appearance=("[^"]*"|'[^']*')/gi,"")} data-theme="adaptive" data-environment="light" data-theme-mode="system" data-appearance="adaptive-system">`);

  html=html.replace(/\s*<script[^>]+(?:theme-boot|appearance-mode-fix|adaptive-appearance-boot(?:-v4)?)\.js[^>]*><\/script>\s*/gi,"");
  html=html.replace(/\s*<script[^>]+src=["']\/assets\/js\/(?:theme|nav|liquid-optics)\.js[^>]*><\/script>\s*/gi,"");

  if(!/id=["']universalNavRoot["']/.test(html))html=html.replace(/<body([^>]*)>/i,'<body$1>\n  <div id="universalNavRoot"></div>');

  html=html.replace(/href=["']\/assets\/css\/theme\.css(?:\?[^"']*)?["']/gi,`href="/assets/css/theme.css?v=${THEME}"`);
  html=html.replace(/href=["']\/assets\/css\/nav\.css(?:\?[^"']*)?["']/gi,`href="/assets/css/nav.css?v=${NAV}"`);

  if(!/\/assets\/css\/theme\.css/.test(html))html=html.replace(/<\/head>/i,`  <link rel="stylesheet" href="/assets/css/theme.css?v=${THEME}" />\n</head>`);
  if(!/\/assets\/css\/nav\.css/.test(html))html=html.replace(/<\/head>/i,`  <link rel="stylesheet" href="/assets/css/nav.css?v=${NAV}" />\n</head>`);

  const boot=`<script src="${BOOT}"></script>`;
  html=/<meta\s+charset=[^>]+>/i.test(html)
    ? html.replace(/(<meta\s+charset=[^>]+>)/i,`$1\n  ${boot}`)
    : html.replace(/<head>/i,`<head>\n  ${boot}`);

  html=html.replace(/<\/body>/i,`  <script type="module" src="/assets/js/theme.js?v=${THEME}"></script>\n  <script type="module" src="/assets/js/nav.js?v=${NAV}"></script>\n</body>`);
  html=html.replace(/<meta\s+name=["']theme-color["'][^>]*>/i,'<meta name="theme-color" content="#eef5fb" />');
  html=html.replace(/\n{3,}/g,"\n\n");

  if(html!==before){
    fs.writeFileSync(file,html,"utf8");
    changed.push(path.relative(root,file).replace(/\\/g,"/"));
  }
}

console.log(`Updated ${changed.length} public HTML page(s) for universal Liquid Glass v8.`);
for(const file of changed)console.log(`- ${file}`);
