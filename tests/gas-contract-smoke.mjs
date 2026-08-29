import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const gas = fs.readFileSync(path.join(root, 'gas', 'Code.gs'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const config = fs.readFileSync(path.join(root, 'js', 'config.js'), 'utf8');
const crypto = fs.readFileSync(path.join(root, 'js', 'crypto.js'), 'utf8');
const room = fs.readFileSync(path.join(root, 'js', 'room-gas.js'), 'utf8');

for (const name of ['doGet','doPost','createRoom','joinRoom','getRoomStatus','saveProject','endRoom','sendSignal','getSignals','listParticipants']) {
  assert.match(gas, new RegExp(`function ${name}\\(`), `GAS missing ${name}`);
}
for (const header of ['SALAS_HEADERS','SIGNAL_HEADERS','PROJECT_HEADERS']) assert.match(gas, new RegExp(`const ${header} =`));
for (const action of ['criar','entrar','status','salvar','encerrar','enviarSinal','receberSinal','participantes']) assert.match(gas, new RegExp(`['"]${action}['"]`));
assert.match(gas, /LockService\.getScriptLock\(\)/);
assert.match(gas, /AES-GCM|Web Crypto|criptograf/);
assert.match(html, /js\/config\.js/);
assert.match(html, /js\/crypto\.js/);
assert.match(html, /js\/room-gas\.js/);
assert.match(config, /GAS_URL/);
assert.match(crypto, /PBKDF2/);
assert.match(crypto, /AES-GCM/);
assert.match(room, /requestAction\('receberSinal'/);
assert.match(room, /RTCPeerConnection/);
assert.match(room, /createDataChannel\('sync'/);
console.log('GAS contract smoke: OK');
