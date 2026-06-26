#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "settings");
const target = path.join(root, "public", "settings");

fs.mkdirSync(target, { recursive: true });

for (const name of fs.readdirSync(source)) {
  if (!name.endsWith(".html")) continue;
  fs.copyFileSync(path.join(source, name), path.join(target, name));
  console.log(`Published settings/${name}`);
}
