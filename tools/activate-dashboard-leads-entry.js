#!/usr/bin/env node
const fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"../public");
const updates=[
  ["dashboard.html",/\/assets\/js\/dashboard\.js\?v=[^"']+/g,"/assets/js/dashboard-entry.js?v=1"],
  ["leads.html",/\/assets\/js\/lead-job-conversion\.js\?v=[^"']+/g,"/assets/js/leads-entry.js?v=1"]
];
for(const [name,pattern,replacement] of updates){const file=path.join(root,name);let html=fs.readFileSync(file,"utf8");const before=html;html=html.replace(pattern,replacement).replace(/\/assets\/css\/theme\.css\?v=[^"']+/g,"/assets/css/theme.css?v=52").replace(/\/assets\/css\/nav\.css\?v=[^"']+/g,"/assets/css/nav.css?v=nav-v7").replace(/\/assets\/js\/theme\.js\?v=[^"']+/g,"/assets/js/theme.js?v=52").replace(/\/assets\/js\/nav\.js\?v=[^"']+/g,"/assets/js/nav.js?v=52");if(html!==before){fs.writeFileSync(file,html,"utf8");console.log(`Updated ${name}`)}}
