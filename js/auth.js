"use strict";

/**
 * Normaliza um texto de identificação para uso em nomes e mensagens.
 */
function authCleanText(value) {
  return String(value ?? "").trim().replace(/[\u0000-\u001F\u007F]/g, "");
}

const AUTH_USERS_KEY = "mapa_riscos_local_users_v1";
const AUTH_CURRENT_USER_KEY = "mapa_riscos_local_current_user_v1";
const AUTH_ROOMS_KEY = "mapa_riscos_local_rooms_v1";

/**
 * Lê uma lista JSON do localStorage e retorna um array seguro.
 */
function readAuthStore(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    const value = raw ? JSON.parse(raw) : fallback;
    return Array.isArray(fallback) ? (Array.isArray(value) ? value : fallback) : (value ?? fallback);
  } catch {
    return fallback;
  }
}

/**
 * Salva um valor JSON no localStorage.
 */
function writeAuthStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/**
 * Gera uma senha derivada com SHA-256 para evitar armazenar a senha em texto puro.
 */
async function hashPassword(password) {
  const input = new TextEncoder().encode(String(password ?? ""));
  if (window.crypto?.subtle) {
    const hash = await window.crypto.subtle.digest("SHA-256", input);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  return btoa(unescape(encodeURIComponent(String(password ?? ""))));
}

/**
 * Cria um novo usuário local e impede duplicidade de e-mail por perfil.
 */
async function registerUser(nome, email, senha, papel) {
  const cleanName = authCleanText(nome);
  const cleanEmail = authCleanText(email).toLowerCase();
  const role = papel === "professor" ? "professor" : "estudante";
  if (cleanName.length < 2) throw new Error("Informe seu nome completo.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error("Informe um email válido.");
  if (String(senha).length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");
  const users = readAuthStore(AUTH_USERS_KEY);
  if (users.some(u => u.email === cleanEmail && u.papel === role)) throw new Error("Já existe uma conta com esse email para este perfil.");
  const user = {
    id: crypto.randomUUID(),
    nome: cleanName,
    email: cleanEmail,
    senhaHash: await hashPassword(senha),
    papel: role,
    salasCriadas: [],
    salasParticipando: [],
    criadoEm: new Date().toISOString()
  };
  users.push(user);
  writeAuthStore(AUTH_USERS_KEY, users);
  const publicUser = { id: user.id, nome: user.nome, email: user.email, papel: user.papel, salasCriadas: [], salasParticipando: [] };
  writeAuthStore(AUTH_CURRENT_USER_KEY, publicUser);
  return publicUser;
}

/**
 * Autentica um usuário local pelo email, senha e perfil selecionado.
 */
async function loginUser(email, senha, papel) {
  const cleanEmail = authCleanText(email).toLowerCase();
  const role = papel === "professor" ? "professor" : "estudante";
  const users = readAuthStore(AUTH_USERS_KEY);
  const user = users.find(u => u.email === cleanEmail && u.papel === role);
  if (!user || user.senhaHash !== await hashPassword(senha)) throw new Error("Email, senha ou perfil inválido.");
  const publicUser = { id: user.id, nome: user.nome, email: user.email, papel: user.papel, salasCriadas: user.salasCriadas || [], salasParticipando: user.salasParticipando || [] };
  writeAuthStore(AUTH_CURRENT_USER_KEY, publicUser);
  return publicUser;
}

/**
 * Encerra a sessão local do usuário atual.
 */
function logoutUserLocal() {
  localStorage.removeItem(AUTH_CURRENT_USER_KEY);
}

/**
 * Retorna o usuário atualmente autenticado neste navegador.
 */
function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem(AUTH_CURRENT_USER_KEY) || "null"); } catch { return null; }
}

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Gera um código de sala curto usando aleatoriedade criptográfica quando disponível.
 */
function generateRoomCode() {
  const bytes = new Uint32Array(6);
  if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 0xFFFFFFFF);
  return Array.from(bytes, b => ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]).join("");
}

/**
 * Persiste o banco local de salas.
 */
function readRooms() { return readAuthStore(AUTH_ROOMS_KEY); }
function writeRooms(rooms) { writeAuthStore(AUTH_ROOMS_KEY, rooms); }

/**
 * Cria uma sala local ativa associada ao professor autenticado.
 */
function createLocalRoom(user) {
  if (!user || user.papel !== "professor") throw new Error("Apenas professores podem criar salas.");
  const rooms = readRooms();
  let codigo = generateRoomCode();
  while (rooms.some(r => r.codigo === codigo && r.status === "ativa")) codigo = generateRoomCode();
  const room = { codigo, status: "ativa", criadorId: user.id, criadaEm: new Date().toISOString(), projeto: null, participantes: [] };
  rooms.push(room); writeRooms(rooms);
  const users = readAuthStore(AUTH_USERS_KEY);
  const idx = users.findIndex(u => u.id === user.id);
  if (idx >= 0) { users[idx].salasCriadas = Array.from(new Set([...(users[idx].salasCriadas || []), codigo])); writeAuthStore(AUTH_USERS_KEY, users); }
  return { ok: true, sala: { ...room, papel: "professor", token: user.id } };
}

/**
 * Entra em uma sala local como professor ou estudante e registra a participação.
 */
function joinLocalRoom(user, codigo) {
  const rooms = readRooms();
  const idx = rooms.findIndex(r => r.codigo === String(codigo || "").toUpperCase() && r.status === "ativa");
  if (idx < 0) throw new Error("Código não encontrado ou sala encerrada.");
  const room = rooms[idx];
  const papel = room.criadorId === user.id ? "professor" : "estudante";
  if (papel === "estudante" && !room.participantes.includes(user.id)) room.participantes.push(user.id);
  rooms[idx] = room; writeRooms(rooms);
  const users = readAuthStore(AUTH_USERS_KEY);
  const uidx = users.findIndex(u => u.id === user.id);
  if (uidx >= 0 && papel === "estudante") { users[uidx].salasParticipando = Array.from(new Set([...(users[uidx].salasParticipando || []), room.codigo])); writeAuthStore(AUTH_USERS_KEY, users); }
  return { ok: true, sala: { ...room, papel, token: user.id } };
}

/**
 * Lista as salas criadas ou participadas pelo usuário atual.
 */
function listLocalRooms(user) {
  const rooms = readRooms();
  if (!user) return [];
  return rooms.filter(r => r.criadorId === user.id || (r.participantes || []).includes(user.id)).map(r => ({ ...r, papel: r.criadorId === user.id ? "professor" : "estudante", participantes: (r.participantes || []).length + (r.criadorId === user.id ? 1 : 0) }));
}

/**
 * Salva o projeto atual na sala local, somente para o professor que a criou.
 */
function saveLocalRoomProject(user, codigo, projeto) {
  const rooms = readRooms();
  const idx = rooms.findIndex(r => r.codigo === codigo && r.status === "ativa");
  if (idx < 0) throw new Error("Sala não encontrada.");
  if (rooms[idx].criadorId !== user?.id) throw new Error("Apenas o professor da sala pode salvar o projeto.");
  rooms[idx].projeto = projeto; writeRooms(rooms);
  return { ok: true };
}

/**
 * Encerra uma sala local criada pelo professor autenticado.
 */
function endLocalRoom(user, codigo) {
  const rooms = readRooms();
  const idx = rooms.findIndex(r => r.codigo === codigo);
  if (idx < 0) throw new Error("Sala não encontrada.");
  if (rooms[idx].criadorId !== user?.id) throw new Error("Apenas o professor da sala pode encerrá-la.");
  rooms[idx].status = "inativa"; writeRooms(rooms);
  return { ok: true };
}

/**
 * Adaptador compatível com a interface de backend usada pelo mapa.js.
 */
window.LocalRoomBackend = Object.freeze({
  request: async (path, options = {}) => {
    const user = getCurrentUser();
    const body = options.body ? JSON.parse(options.body) : {};
    if (path === "/api/sala/criar") return createLocalRoom(user);
    if (path === "/api/sala/entrar") return joinLocalRoom(user, body.codigo);
    if (path === "/api/usuario/salas") return { ok: true, salas: listLocalRooms(user) };
    if (path === "/api/sala/salvar") return saveLocalRoomProject(user, body.codigo, body.projeto);
    if (path === "/api/sala/encerrar") return endLocalRoom(user, body.codigo);
    if (path.startsWith("/api/sala/status/")) {
      const code = decodeURIComponent(path.slice("/api/sala/status/".length)).toUpperCase();
      const room = readRooms().find(r => r.codigo === code);
      if (!room || room.status !== "ativa") throw new Error("Código não encontrado ou sala encerrada.");
      return { ok: true, sala: { ...room, papel: user && room.criadorId === user.id ? "professor" : "estudante" } };
    }
    if (path === "/api/auth/logout") return { ok: true };
    throw new Error(`Endpoint local não suportado: ${path}`);
  }
});

window.AuthAPI = Object.freeze({ registerUser, loginUser, logoutUser: logoutUserLocal, getCurrentUser });
