#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'../public/messages.html');
let html=fs.readFileSync(file,'utf8');
html=html.replace('/assets/js/messages-v2.js?v=6','/assets/js/messages-v2.js?v=7');
fs.writeFileSync(file,html);
console.log('Messages runtime bumped to v7.');
