#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'../firebase/firestore.rules');
let source=fs.readFileSync(file,'utf8');
const oldBlock=`    match /channels/{channelId}/messages/{messageId} {
      allow read, write: if signedIn();
    }`;
const newBlock=`    match /channels/{channelId}/messages/{messageId} {
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
    }

    match /channels/_group_registry/messages/{conversationId} {
      allow read: if signedIn();
      allow create: if signedIn() && (
        request.resource.data.kind in ['group_meta', 'direct_meta']
        || (request.resource.data.kind == 'role_meta' && isOwnerOrAdmin())
      );
      allow update: if signedIn() && (
        isOwnerOrAdmin()
        || request.auth.uid in resource.data.adminUids
      );
      allow delete: if isOwnerOrAdmin();
    }`;
if(!source.includes(oldBlock)){
  console.log('Messaging Firestore rules already migrated or source block changed.');
  process.exit(0);
}
source=source.replace(oldBlock,newBlock);
fs.writeFileSync(file,source);
console.log('Messaging Firestore rules updated.');
