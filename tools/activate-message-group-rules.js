#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'../firebase/firestore.rules');
let source=fs.readFileSync(file,'utf8');
const old=`    match /channels/{channelId}/messages/{messageId} {
      allow read, write: if signedIn();
    }`;
const replacement=`    match /channels/{channelId} {
      allow read: if signedIn() && (
        isManagerPlus() ||
        request.auth.uid in resource.data.memberUids ||
        request.auth.uid in resource.data.adminUids ||
        role() in resource.data.allowedRoles
      );
      allow create: if signedIn()
        && request.auth.uid in request.resource.data.adminUids
        && request.auth.uid in request.resource.data.memberUids
        && request.resource.data.type == 'group';
      allow update: if signedIn() && (
        isOwnerOrAdmin() ||
        request.auth.uid in resource.data.adminUids
      );
      allow delete: if isOwnerOrAdmin();

      match /messages/{messageId} {
        allow read, create: if signedIn();
        allow update, delete: if isOwnerOrAdmin();
      }
    }`;
if(!source.includes(old)){
  console.log('Message rules already migrated or source pattern changed.');
  process.exit(0);
}
source=source.replace(old,replacement);
fs.writeFileSync(file,source);
console.log('Updated Firestore channel rules.');
