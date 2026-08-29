import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const code = fs.readFileSync(new URL('../js/auth.js', import.meta.url), 'utf8');
const store = new Map();
const localStorage = {
  getItem: k => store.has(k) ? store.get(k) : null,
  setItem: (k,v) => store.set(k, String(v)),
  removeItem: k => store.delete(k)
};
const ctx = vm.createContext({
  console, TextEncoder, TextDecoder,
  btoa: s => Buffer.from(s, 'binary').toString('base64'),
  atob: s => Buffer.from(s, 'base64').toString('binary'),
  unescape, encodeURIComponent, decodeURIComponent,
  window: null, localStorage, crypto: webcrypto,
  setTimeout, clearTimeout
});
ctx.window = ctx;
vm.runInContext(code, ctx);

const professor = await ctx.AuthAPI.registerUser('Professor Teste', 'professor@example.com', 'senha123', 'professor');
assert.equal(professor.papel, 'professor');
await assert.rejects(() => ctx.AuthAPI.registerUser('Outro', 'professor@example.com', 'senha123', 'professor'));
const logged = await ctx.AuthAPI.loginUser('professor@example.com', 'senha123', 'professor');
assert.equal(logged.id, professor.id);
const wrong = ctx.AuthAPI.loginUser('professor@example.com', 'errada123', 'professor');
await assert.rejects(wrong);
const room = ctx.LocalRoomBackend.request('/api/sala/criar', { body: '{}' });
const created = await room;
assert.match(created.sala.codigo, /^[A-HJ-NP-Z2-9]{6}$/);
const student = await ctx.AuthAPI.registerUser('Aluno Teste', 'aluno@example.com', 'senha123', 'estudante');
const joined = await ctx.LocalRoomBackend.request('/api/sala/entrar', { body: JSON.stringify({ codigo: created.sala.codigo }) });
assert.equal(joined.sala.papel, 'estudante');
console.log('Local auth functional smoke: OK');
