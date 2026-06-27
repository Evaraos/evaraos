#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '../public/assets/js/messages-v2.js');
let src = fs.readFileSync(file, 'utf8');

src = src.replace(
  'const companyId=String(state.profile.companyId||"global").replace(/[^a-zA-Z0-9_-]/g,"-");const path=`companies/${companyId}/message-${conversationId}-${target==="background"?"background":"avatar"}.webp`;',
  'const userId=state.user?.uid||auth.currentUser?.uid;if(!userId)throw new Error("Your session expired. Sign in again.");const path=`users/${userId}/message-${conversationId}-${target==="background"?"background":"avatar"}.webp`;'
);

src = src.replace(
  'const companyId=String(state.profile.companyId||"global").replace(/[^a-zA-Z0-9_-]/g,"-");for(const file of ["avatar","background"]){try{await deleteObject(storageRef(storage,`companies/${companyId}/message-${id}-${file}.webp`))}',
  'const userId=state.user?.uid||auth.currentUser?.uid;if(!userId)return;for(const file of ["avatar","background"]){try{await deleteObject(storageRef(storage,`users/${userId}/message-${id}-${file}.webp`))}'
);

src = src.split('companies/${String(state.profile.companyId||"global").replace(/[^a-zA-Z0-9_-]/g,"-")}/message-${id}-avatar.webp').join('users/${state.user?.uid||auth.currentUser?.uid}/message-${id}-avatar.webp');
src = src.split('companies/${String(state.profile.companyId||"global").replace(/[^a-zA-Z0-9_-]/g,"-")}/message-${id}-background.webp').join('users/${state.user?.uid||auth.currentUser?.uid}/message-${id}-background.webp');

fs.writeFileSync(file, src);
console.log('Updated Messages image storage path to users/{uid}.');
