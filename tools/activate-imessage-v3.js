#!/usr/bin/env node
const fs=require('fs');
const file='public/messages.html';
let html=fs.readFileSync(file,'utf8');
if(!html.includes('messages-imessage-v3.css'))html=html.replace('</head>','<link rel="stylesheet" href="/assets/css/pages/messages-imessage-v3.css?v=1"></head>');
if(!html.includes('messages-imessage-v3.js'))html=html.replace('</body>','<script type="module" src="/assets/js/messages-imessage-v3.js?v=1"></script></body>');
fs.writeFileSync(file,html);
console.log('Activated iMessage v3.');
