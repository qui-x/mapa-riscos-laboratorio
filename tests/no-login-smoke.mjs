import assert from "node:assert/strict";
import { accessSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const html = readFileSync(join(root, "index.html"), "utf8");
const runtime = readFileSync(join(root, "js/mapa.js"), "utf8");
const styles = readFileSync(join(root, "css/tailwind.css"), "utf8");

const requiredIds = [
  "canvas",
  "roomW",
  "roomH",
  "applyRoom",
  "fitRoom",
  "palette",
  "selectMode",
  "panMode",
  "grid",
  "snap",
  "ruler",
  "zoomOut",
  "zoomIn",
  "undo",
  "redo",
  "save",
  "exportSvg",
  "load",
  "objectsTree",
  "props",
  "applyProps",
  "rotate",
  "duplicate",
  "delete",
  "riskList",
  "compliance-badge",
  "fileInput"
];

for (const id of requiredIds) {
  assert.ok(html.includes(`id="${id}"`), `Missing required editor element: ${id}`);
}

for (const forbidden of ["loginScreen", "authForm", "auth.js", "authSubmit", "studentRoomCodeAuth"]) {
  assert.ok(!html.includes(forbidden), `The no-login editor must not contain ${forbidden}`);
}

assert.ok(html.includes('href="css/tailwind.css"'), "Tailwind entry stylesheet is not linked");
assert.ok(html.includes('src="js/mapa.js"'), "Legacy 2D editor script is not loaded");
assert.ok(!html.includes('src="js/auth.js"'), "Authentication script must not be loaded");
assert.ok(runtime.includes('getElementById("canvas")'), "Canvas initialization is missing");
assert.ok(styles.includes('@import "./mapa.css" layer(legacy)'), "Original CSS must remain in the compatibility layer");

for (const asset of [
  "assets/svg/risk-chemical.svg",
  "assets/svg/equipment-eyewash.svg",
  "assets/svg/equipment-extinguisher.svg"
]) {
  accessSync(join(root, asset));
}

console.log("No-login editor smoke checks passed.");
