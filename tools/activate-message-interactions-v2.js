#!/usr/bin/env node
const fs=require('fs');
const htmlFile='public/messages.html';
let html=fs.readFileSync(htmlFile,'utf8');
if(!html.includes('messages-fixes-v2.css'))html=html.replace('</head>','<link rel="stylesheet" href="/assets/css/pages/messages-fixes-v2.css?v=1"></head>');
if(!html.includes('messages-interactions-v2.js'))html=html.replace('</body>','<script type="module" src="/assets/js/messages-interactions-v2.js?v=1"></script></body>');
html=html.replace(/messages-v2\.js\?v=\d+/,'messages-v2.js?v=9');
fs.writeFileSync(htmlFile,html);

const rulesFile='firebase/firestore.rules';
let rules=fs.readFileSync(rulesFile,'utf8');
const oldBlock=`    match /channels/{channelId}/messages/{messageId} {
      allow read: if signedIn();
      allow create: if signedIn()
        && request.resource.data.senderUid == request.auth.uid
        && request.resource.data.text is string
        && request.resource.data.text.size() <= 10000;
      allow update: if isOwnerOrAdmin() || (
        signedIn()
        && resource.data.senderUid == request.auth.uid
        && request.resource.data.senderUid == resource.data.senderUid
      );
      allow delete: if isOwnerOrAdmin() || (
        signedIn() && resource.data.senderUid == request.auth.uid
      );
    }`;
const newBlock=`    match /channels/{channelId}/messages/{messageId} {
      allow read: if signedIn();
      allow create: if signedIn()
        && request.resource.data.senderUid == request.auth.uid
        && (
          (request.resource.data.text is string && request.resource.data.text.size() <= 10000)
          || request.resource.data.imageUrl is string
        );
      allow update: if isOwnerOrAdmin() || (
        signedIn()
        && resource.data.senderUid == request.auth.uid
        && request.resource.data.senderUid == resource.data.senderUid
      );
      allow delete: if isOwnerOrAdmin() || (
        signedIn() && resource.data.senderUid == request.auth.uid
      );

      match /reactions/{userId} {
        allow read: if signedIn();
        allow create, update: if signedIn()
          && request.auth.uid == userId
          && request.resource.data.userUid == request.auth.uid
          && request.resource.data.emoji is string;
        allow delete: if signedIn() && (request.auth.uid == userId || isOwnerOrAdmin());
      }
    }`;
if(rules.includes(oldBlock))rules=rules.replace(oldBlock,newBlock);
fs.writeFileSync(rulesFile,rules);
console.log('Activated message camera, reactions, swipe dates, and Firestore reaction rules.');
