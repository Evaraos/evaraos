#!/usr/bin/env node
const fs=require("fs");
const path=require("path");
const root=path.resolve(__dirname,"../public");

function walk(dir,out=[]){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p,out);else if(e.name.endsWith(".html"))out.push(p)}return out}

const changed=[];
for(const file of walk(root)){
  let html=fs.readFileSync(file,"utf8");
  if(!/<body\b/i.test(html))continue;
  const before=html;
  if(!/id=["']universalNavRoot["']/.test(html))html=html.replace(/<body([^>]*)>/i,'<body$1>\n  <div id="universalNavRoot"></div>');
  if(!/\/assets\/css\/nav\.css/.test(html))html=html.replace(/<\/head>/i,'  <link rel="stylesheet" href="/assets/css/nav.css?v=nav-v5" />\n</head>');
  else html=html.replace(/\/assets\/css\/nav\.css\?v=[^"']+/g,'/assets/css/nav.css?v=nav-v5');
  if(!/\/assets\/js\/nav\.js/.test(html))html=html.replace(/<\/body>/i,'  <script type="module" src="/assets/js/nav.js?v=51"></script>\n</body>');
  else html=html.replace(/\/assets\/js\/nav\.js\?v=[^"']+/g,'/assets/js/nav.js?v=51');
  if(html!==before){fs.writeFileSync(file,html,"utf8");changed.push(path.relative(root,file).replace(/\\/g,"/"))}
}
console.log(`Updated ${changed.length} HTML page(s) for universal nav coverage.`);
for(const f of changed)console.log(`- ${f}`);
