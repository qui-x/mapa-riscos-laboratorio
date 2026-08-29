import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'js', 'mapa.js'), 'utf8');
const types = fs.readFileSync(path.join(root, 'js', 'types.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'mapa.css'), 'utf8');

const dataTypes = [...html.matchAll(/data-type="([^"]+)"/g)].map(m => m[1]);
const typeKeys = [...(types.match(/const TYPES\s*=\s*\{([\s\S]*?)\};/)?.[1] || '').matchAll(/^\s*([A-Za-z][\w]*)\s*:/gm)].map(m => m[1]);
const knownHtmlTypes = [...new Set(dataTypes)].filter(type => type !== 'standard');
assert.ok(dataTypes.length > 0, 'Nenhum botão de elemento encontrado');
for (const type of knownHtmlTypes) assert.ok(typeKeys.includes(type), `Tipo ${type} não existe em TYPES`);
assert.match(js, /querySelectorAll\("\.palette button\[data-type\]"\)/, 'Bindings da paleta não usam o seletor de todos os grupos');
assert.match(html, /id="palette"/, 'Âncora #palette ausente para o stepper');
assert.match(js, /\$\("ruler"\)\.onclick/, 'Botão Cotas sem listener');
assert.match(js, /state\.ruler\s*=\s*!state\.ruler/, 'Botão Cotas não alterna state.ruler');
assert.match(js, /if \(!state\.drag && !state\.ruler\) return;/, 'Tooltip de dimensões não respeita estado de Cotas');
assert.equal((html.match(/id="totalObjectsBadge"/g) || []).length, 1, 'totalObjectsBadge deve existir uma única vez');
assert.equal((html.match(/id="validationAlert"/g) || []).length, 1, 'validationAlert deve existir uma única vez');
assert.match(html, /href="css\/mapa\.css"/, 'CSS não está organizado em css/');
for (const script of ['js/types.js', 'js/geometry.js', 'js/validation.js', 'js/mapa.js']) {
  assert.match(html, new RegExp(`src="${script.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`), `Script ${script} não está referenciado pelo HTML`);
}
assert.ok(!/\.\/js\/|\.\/css\//.test(css), 'CSS contém caminhos relativos inesperados');
console.log(`UI bindings smoke: OK (${knownHtmlTypes.length} tipos de elementos)`);
