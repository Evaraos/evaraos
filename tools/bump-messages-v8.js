#!/usr/bin/env node
const fs=require('fs');
const file='public/messages.html';
let html=fs.readFileSync(file,'utf8');
html=html.replace(/messages-v2\.js\?v=\d+/,'messages-v2.js?v=8');
fs.writeFileSync(file,html);
console.log('Messages runtime bumped to v8.');
