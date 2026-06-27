#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'../public/assets/js/messages-v2.js');
let source=fs.readFileSync(file,'utf8');
source=source.replace(
  'const path=`messages/${conversationId}/${target==="background"?"background":"avatar"}.webp`;const ref=storageRef(storage,path);await uploadBytes(ref,blob,{contentType:"image/webp",customMetadata:{ownerUid:state.user.uid,conversationId}});return await getDownloadURL(ref)',
  'const companyId=String(state.profile.companyId||"global").replace(/[^a-zA-Z0-9_-]/g,"-");const path=`companies/${companyId}/message-${conversationId}-${target==="background"?"background":"avatar"}.webp`;const ref=storageRef(storage,path);await uploadBytes(ref,blob,{contentType:"image/webp"});return await getDownloadURL(ref)'
);
source=source.replace(
  'async function removeStoredVisuals(id){for(const file of ["avatar.webp","background.webp"]){try{await deleteObject(storageRef(storage,`messages/${id}/${file}`))}',
  'async function removeStoredVisuals(id){const companyId=String(state.profile.companyId||"global").replace(/[^a-zA-Z0-9_-]/g,"-");for(const file of ["avatar","background"]){try{await deleteObject(storageRef(storage,`companies/${companyId}/message-${id}-${file}.webp`))}'
);
source=source.replace(
  'storageRef(storage,`messages/${id}/avatar.webp`)',
  'storageRef(storage,`companies/${String(state.profile.companyId||"global").replace(/[^a-zA-Z0-9_-]/g,"-")}/message-${id}-avatar.webp`)'
);
source=source.replace(
  'storageRef(storage,`messages/${id}/background.webp`)',
  'storageRef(storage,`companies/${String(state.profile.companyId||"global").replace(/[^a-zA-Z0-9_-]/g,"-")}/message-${id}-background.webp`)'
);
fs.writeFileSync(file,source);
console.log('Message image uploads now use the established company image path.');
