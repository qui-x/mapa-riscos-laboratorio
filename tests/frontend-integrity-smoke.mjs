import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const mapa = fs.readFileSync(path.join(root, 'js', 'mapa.js'), 'utf8');

const eventAssignments = mapa.match(/\.(onclick|oninput|onchange|onkeydown|onkeyup|onblur|onfocus)\s*=/g) || [];
if (eventAssignments.length) throw new Error(`Atribuições diretas de eventos encontradas: ${eventAssignments.length}`);
if (mapa.includes('a2 0 0 3-3.42 0z')) throw new Error('Path SVG de alerta inválido ainda presente.');
if (/<div id="g_id_onload"[^>]+data-callback=/i.test(html)) throw new Error('GIS ainda está usando callback declarativo automático.');

const requiredAssets = [
  'risk-chemical.svg','risk-biological.svg','risk-physical.svg','risk-fire.svg',
  'risk-electrical.svg','risk-ergonomic.svg','risk-radiation.svg','risk-slip.svg',
  'equipment-shower.svg','equipment-eyewash.svg','equipment-extinguisher.svg'
];
for (const name of requiredAssets) {
  const file = path.join(root, 'assets', 'svg', name);
  if (!fs.existsSync(file)) throw new Error(`Asset ausente: ${name}`);
  const text = fs.readFileSync(file, 'utf8');
  if (!/^\s*<svg\b/i.test(text) || !/<\/svg>\s*$/i.test(text)) throw new Error(`SVG inválido: ${name}`);
}

console.log('Frontend integrity smoke: OK');
