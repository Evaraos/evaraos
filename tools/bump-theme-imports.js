#!/usr/bin/env node
const fs=require("fs"),path=require("path");
const file=path.resolve(__dirname,"../public/assets/css/theme.css");
let css=fs.readFileSync(file,"utf8");
css=css.replace(/\?v=50/g,"?v=51").replace(/compact-surfaces\.css\?v=1/g,"compact-surfaces.css?v=2").replace(/liquid-beam\.css\?v=1/g,"liquid-beam.css?v=2");
fs.writeFileSync(file,css,"utf8");
console.log("Bumped universal theme imports.");
