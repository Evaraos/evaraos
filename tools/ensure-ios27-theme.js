#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'../public');
let updated=0;

function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full);
    else if(entry.isFile()&&entry.name.endsWith('.html'))patch(full);
  }
}

function patch(file){
  let html=fs.readFileSync(file,'utf8');
  const before=html;
  if(/assets\/css\/theme\.css\?v=[^"']+/.test(html))html=html.replace(/assets\/css\/theme\.css\?v=[^"']+/g,'assets/css/theme.css?v=ios27-v1');
  else if(html.includes('</head>'))html=html.replace('</head>','<link rel="stylesheet" href="/assets/css/theme.css?v=ios27-v1"></head>');
  if(/assets\/js\/theme\.js\?v=[^"']+/.test(html))html=html.replace(/assets\/js\/theme\.js\?v=[^"']+/g,'assets/js/theme.js?v=ios27-v1');
  else if(html.includes('</body>'))html=html.replace('</body>','<script type="module" src="/assets/js/theme.js?v=ios27-v1"></script></body>');
  if(before!==html){fs.writeFileSync(file,html);updated++;}
}

walk(root);
console.log(`iOS 27 theme connected to ${updated} page(s).`);
