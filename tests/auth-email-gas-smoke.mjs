import fs from 'node:fs';
import assert from 'node:assert/strict';

const code = fs.readFileSync(new URL('../gas/Code.gs', import.meta.url), 'utf8');
for (const fn of ['authRegister','authLogin','ensureAuthenticated','createRoom','joinRoom','saveProject','endRoom','setupMasterSpreadsheet']) {
  assert.match(code, new RegExp(`function\\s+${fn}\\s*\\(`), `missing ${fn}`);
}
assert.ok(code.includes("'authRegister': return authRegister(data);"));
assert.ok(code.includes("const USUARIOS_HEADERS = ['id', 'email', 'nome', 'foto', 'papel', 'senhaHash', 'senhaSalt', 'criadoEm', 'ultimoAcesso'];"));
assert.ok(!code.includes('GOOGLE_CLIENT_ID'));
assert.ok(!code.includes('verifyIdToken'));
console.log('Email/password GAS smoke: OK');
