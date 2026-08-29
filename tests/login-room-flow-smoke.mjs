import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('../js/mapa.js', import.meta.url), 'utf8');

const createStart = src.indexOf('async function createRoomFromLogin()');
assert.ok(createStart >= 0, 'createRoomFromLogin não encontrada');
const nextFn = src.indexOf('\n/**', createStart + 10);
const createFn = src.slice(createStart, nextFn > createStart ? nextFn : createStart + 2200);

assert.match(createFn, /console\.log\("1\. Tentando criar sala/);
assert.match(createFn, /console\.log\("2\. Sala criada:/);
assert.match(createFn, /enterRoomFromServer\(data\.sala, "professor"\)/);
assert.match(createFn, /console\.log\("4\. Entrou no editor como professor/);
assert.doesNotMatch(createFn, /showHomeScreen\(\)/, 'O fluxo de criação não deve voltar para a Home');
assert.match(createFn, /console\.error\("ERRO na criação da sala:/);

const enterStart = src.indexOf('async function enterRoomFromServer(sala, role)');
const enterEnd = src.indexOf('\n/**', enterStart + 10);
const enterFn = src.slice(enterStart, enterEnd > enterStart ? enterEnd : enterStart + 1800);
assert.match(enterFn, /state\.role = role === "professor" \? "professor" : "student"/);
assert.match(enterFn, /state\.roomToken = state\.user\?\.id \|\| sala\?\.token/);
assert.match(enterFn, /if \(!state\.roomToken\) throw new Error/);

const authBlock = src.slice(src.indexOf('async function handleGoogleSignIn'), src.indexOf('\nwindow.handleGoogleSignIn'));
assert.match(authBlock, /localStorage\.setItem\(SESSION_TOKEN_KEY, state\.sessionToken\)/);
assert.match(authBlock, /console\.log\("Usuário autenticado:"/);

const roomGas = fs.readFileSync(new URL('../js/room-gas.js', import.meta.url), 'utf8');
assert.match(roomGas, /requestAction\('receberSinal', \{ sessionToken:/, 'Polling deve enviar sessionToken ao GAS');

console.log('Login/room flow smoke: OK');
