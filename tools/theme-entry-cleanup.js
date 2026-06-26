#!/usr/bin/env node
const fs=require("fs"),path=require("path");
const file=path.resolve(__dirname,"../public/assets/css/theme.css");
const before=fs.readFileSync(file,"utf8");
const after=before.replace(/^.*apple-settings-glass\.css.*\n?/m,"");
if(after!==before){fs.writeFileSync(file,after,"utf8");console.log("Removed dead settings glass import.");}
