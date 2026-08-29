/**
 * Mapa de Riscos do Laboratório — Backend Google Apps Script.
 *
 * Responsabilidades:
 * - cadastro/login/logout por e-mail e senha;
 * - recuperação e redefinição de senha por e-mail;
 * - sessões temporárias via CacheService;
 * - gerenciamento de salas no Google Sheets;
 * - persistência de projetos e sinalização WebRTC;
 * - armazenamento opcional de projetos no Google Drive.
 *
 * IMPORTANTE:
 * 1. Execute setupMasterSpreadsheet() uma vez.
 * 2. Publique o projeto como Web App.
 * 3. O frontend deve apontar para a URL /exec do Web App.
 */

const SPREADSHEET_ID = 'SEU_ID_DA_PLANILHA';
const SHEET_USUARIOS = 'usuarios';
const SHEET_SALAS = 'salas';
const SHEET_SINALIZACAO = 'sinalizacao';
const SHEET_PROJETOS = 'projetos';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SESSION_TTL_SECONDS = 3600;
const RESET_TTL_MS = 60 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 8;
const LOGIN_WINDOW_SECONDS = 900;

const USUARIOS_HEADERS = [
  'id', 'email', 'nome', 'foto', 'papel', 'senhaHash', 'senhaSalt',
  'resetToken', 'resetExpira', 'criadoEm', 'ultimoAcesso'
];
const SALAS_HEADERS = ['codigo', 'status', 'criadorId', 'criadaEm', 'projeto', 'projetoDriveId', 'participantes'];
const SIGNAL_HEADERS = ['codigoSala', 'remetente', 'destinatario', 'tipo', 'payload', 'timestamp'];
const PROJECT_HEADERS = ['id', 'codigoSala', 'criadorId', 'versao', 'criadoEm', 'atualizadoEm', 'projeto'];

/** Cria uma resposta JSON padronizada para o Web App. */
function jsonOutput(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

/** Cria uma resposta de sucesso. */
function ok(data) {
  return jsonOutput(Object.assign({ ok: true }, data || {}));
}

/** Cria uma resposta de erro com mensagem e código técnico. */
function fail(message, code) {
  return jsonOutput({ ok: false, error: message, code: code || 'ERROR' });
}

/** Normaliza e-mail para comparação e armazenamento consistente. */
function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

/** Valida o formato básico de um e-mail. */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Retorna o ID da planilha mestra salvo nas propriedades do projeto. */
function getSpreadsheetId() {
  const saved = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (saved) return saved;
  if (SPREADSHEET_ID && SPREADSHEET_ID !== 'SEU_ID_DA_PLANILHA') return SPREADSHEET_ID;
  throw new Error('Planilha mestra não configurada. Execute setupMasterSpreadsheet().');
}

/** Obtém uma aba da planilha e cria cabeçalhos quando necessário. */
function getSheet(name, headers) {
  const ss = SpreadsheetApp.openById(getSpreadsheetId());
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (headers && sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }
  return sheet;
}

/** Cria a planilha mestra, salva o ID nas propriedades e inicializa todas as abas. */
function setupMasterSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty('SPREADSHEET_ID');
  if (existingId) {
    try {
      const existing = SpreadsheetApp.openById(existingId);
      setupSheetsInternal_(existing);
      return { ok: true, created: false, spreadsheetId: existing.getId(), spreadsheetName: existing.getName(), spreadsheetUrl: existing.getUrl() };
    } catch (err) {
      props.deleteProperty('SPREADSHEET_ID');
    }
  }
  if (SPREADSHEET_ID && SPREADSHEET_ID !== 'SEU_ID_DA_PLANILHA') {
    const configured = SpreadsheetApp.openById(SPREADSHEET_ID);
    props.setProperty('SPREADSHEET_ID', configured.getId());
    setupSheetsInternal_(configured);
    return { ok: true, created: false, spreadsheetId: configured.getId(), spreadsheetName: configured.getName(), spreadsheetUrl: configured.getUrl() };
  }
  const ss = SpreadsheetApp.create('Mapa de Riscos - Planilha Mestra');
  setupSheetsInternal_(ss);
  props.setProperty('SPREADSHEET_ID', ss.getId());
  return { ok: true, created: true, spreadsheetId: ss.getId(), spreadsheetName: ss.getName(), spreadsheetUrl: ss.getUrl() };
}

/** Cria e corrige a estrutura das abas do sistema. */
function setupSheetsInternal_(ss) {
  const configs = {
    usuarios: USUARIOS_HEADERS,
    salas: SALAS_HEADERS,
    sinalizacao: SIGNAL_HEADERS,
    projetos: PROJECT_HEADERS
  };
  const first = ss.getSheets()[0];
  if (first && first.getName() === 'Sheet1' && !ss.getSheetByName('usuarios')) first.setName('usuarios');
  Object.keys(configs).forEach(function(name) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    const headers = configs[name];
    const width = Math.max(headers.length, sheet.getLastColumn() || 1);
    const current = sheet.getLastRow() > 0 ? sheet.getRange(1, 1, 1, width).getValues()[0] : [];
    let same = true;
    for (let i = 0; i < headers.length; i++) if (String(current[i] || '') !== headers[i]) { same = false; break; }
    if (!same) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  });
}

/** Inicializa as abas existentes sem recriar a planilha. */
function setupSheets() {
  const ss = SpreadsheetApp.openById(getSpreadsheetId());
  setupSheetsInternal_(ss);
  return ok({ spreadsheetId: ss.getId(), spreadsheetUrl: ss.getUrl() });
}

/** Gera um UUID para usuários, sessões ou outros identificadores. */
function generateToken() { return Utilities.getUuid(); }

/** Gera um código de sala de seis caracteres sem caracteres ambíguos. */
function generateRoomCode() {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length));
  return code;
}

/** Lê todas as linhas de uma aba sem o cabeçalho. */
function readRows(sheet) {
  const values = sheet.getDataRange().getValues();
  return values.length > 1 ? values.slice(1) : [];
}

/** Retorna mapa de cabeçalho para índice da coluna. */
function headerMap(sheet) {
  const headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
  const map = {};
  headers.forEach(function(v, i) { map[String(v || '').trim()] = i; });
  return map;
}

/** Procura usuário por e-mail. */
function findUserByEmail(email) {
  const sheet = getSheet(SHEET_USUARIOS, USUARIOS_HEADERS);
  const map = headerMap(sheet);
  const emailIndex = map.email != null ? map.email : 1;
  const rows = readRows(sheet);
  for (let i = 0; i < rows.length; i++) {
    if (normalizeEmail(rows[i][emailIndex]) === email) {
      return { sheet: sheet, index: i + 2, row: rows[i], map: map };
    }
  }
  return null;
}

/** Converte uma linha de usuário para o objeto público usado pelo frontend. */
function userFromRow(found) {
  const row = found.row;
  const map = found.map || {};
  return {
    id: String(row[map.id != null ? map.id : 0] || ''),
    email: normalizeEmail(row[map.email != null ? map.email : 1]),
    nome: String(row[map.nome != null ? map.nome : 2] || ''),
    foto: String(row[map.foto != null ? map.foto : 3] || ''),
    papel: String(row[map.papel != null ? map.papel : 4] || 'estudante')
  };
}

/** Gera um salt aleatório para a senha. */
function generatePasswordSalt() {
  return Utilities.getUuid().replace(/-/g, '');
}

/** Calcula o hash SHA-256 da senha combinada com o salt. */
function hashPassword(password, salt) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(salt) + String(password),
    Utilities.Charset.UTF_8
  );
  return digest.map(function(b) { const v = b < 0 ? b + 256 : b; return ('0' + v.toString(16)).slice(-2); }).join('');
}

/** Cria uma sessão temporária e a coloca no CacheService. */
function createSession(usuario) {
  const token = generateToken();
  CacheService.getScriptCache().put('session_' + token, JSON.stringify(usuario), SESSION_TTL_SECONDS);
  return token;
}

/** Invalida uma sessão existente. */
function destroySession(sessionToken) {
  if (sessionToken) CacheService.getScriptCache().remove('session_' + sessionToken);
}

/** Valida uma sessão e retorna o usuário autenticado. */
function ensureAuthenticated(sessionToken) {
  if (!sessionToken) throw new Error('Sessão não encontrada. Faça login novamente.');
  const cached = CacheService.getScriptCache().get('session_' + sessionToken);
  if (!cached) throw new Error('Sessão expirada. Faça login novamente.');
  return JSON.parse(cached);
}

/** Controla tentativas excessivas de login por e-mail. */
function enforceLoginRateLimit(email) {
  const key = 'login_attempts_' + Utilities.base64EncodeWebSafe(email).slice(0, 80);
  const cache = CacheService.getScriptCache();
  const count = Number(cache.get(key) || 0);
  if (count >= MAX_LOGIN_ATTEMPTS) throw new Error('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
  cache.put(key, String(count + 1), LOGIN_WINDOW_SECONDS);
}

/** Registra um usuário novo no Sheets e cria sua sessão. */
function authRegister(data) {
  const nome = String(data.nome || '').trim();
  const email = normalizeEmail(data.email);
  const senha = String(data.senha || '');
  const papel = String(data.papel || 'estudante').toLowerCase();
  if (nome.length < 2) return fail('Informe seu nome completo.', 'INVALID_NAME');
  if (!isValidEmail(email)) return fail('Informe um e-mail válido.', 'INVALID_EMAIL');
  if (senha.length < 6) return fail('A senha deve ter pelo menos 6 caracteres.', 'WEAK_PASSWORD');
  if (!['professor', 'estudante'].includes(papel)) return fail('Perfil inválido.', 'INVALID_ROLE');
  if (findUserByEmail(email)) return fail('Este e-mail já está cadastrado.', 'EMAIL_EXISTS');
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    if (findUserByEmail(email)) return fail('Este e-mail já está cadastrado.', 'EMAIL_EXISTS');
    const now = new Date().toISOString();
    const salt = generatePasswordSalt();
    const hash = hashPassword(senha, salt);
    const id = generateToken();
    const sheet = getSheet(SHEET_USUARIOS, USUARIOS_HEADERS);
    sheet.appendRow([id, email, nome, '', papel, hash, salt, '', '', now, now]);
    const usuario = { id: id, email: email, nome: nome, papel: papel };
    return ok({ usuario: usuario, sessionToken: createSession(usuario) });
  } finally {
    lock.releaseLock();
  }
}

/** Autentica um usuário pelo e-mail, senha e perfil selecionado. */
function authLogin(data) {
  const email = normalizeEmail(data.email);
  const senha = String(data.senha || '');
  const requestedRole = String(data.papel || '').toLowerCase();
  if (!isValidEmail(email)) return fail('Informe um e-mail válido.', 'INVALID_EMAIL');
  enforceLoginRateLimit(email);
  const found = findUserByEmail(email);
  if (!found) return fail('E-mail ou senha inválidos.', 'INVALID_CREDENTIALS');
  const map = found.map;
  const salt = String(found.row[map.senhaSalt != null ? map.senhaSalt : 6] || '');
  const stored = String(found.row[map.senhaHash != null ? map.senhaHash : 5] || '');
  if (!stored || hashPassword(senha, salt) !== stored) return fail('E-mail ou senha inválidos.', 'INVALID_CREDENTIALS');
  const usuario = userFromRow(found);
  if (requestedRole && usuario.papel !== requestedRole) return fail('O perfil selecionado não corresponde a esta conta.', 'ROLE_MISMATCH');
  found.sheet.getRange(found.index, (map.ultimoAcesso != null ? map.ultimoAcesso : 10) + 1).setValue(new Date().toISOString());
  return ok({ usuario: usuario, sessionToken: createSession(usuario) });
}

/** Encerra uma sessão de forma explícita. */
function authLogout(data) {
  destroySession(String(data.sessionToken || ''));
  return ok({ message: 'Sessão encerrada.' });
}

/** Solicita redefinição de senha e envia o link por e-mail. */
function authForgotPassword(data) {
  const email = normalizeEmail(data.email);
  const generic = 'Se este e-mail estiver cadastrado, você receberá um link de redefinição.';
  if (!isValidEmail(email)) return fail('Informe um e-mail válido.', 'INVALID_EMAIL');
  const found = findUserByEmail(email);
  if (!found) return ok({ message: generic });
  const token = generateToken();
  const expires = new Date(Date.now() + RESET_TTL_MS).toISOString();
  const map = found.map;
  found.sheet.getRange(found.index, (map.resetToken != null ? map.resetToken : 7) + 1).setValue(token);
  found.sheet.getRange(found.index, (map.resetExpira != null ? map.resetExpira : 8) + 1).setValue(expires);
  const frontendUrl = String(data.frontendUrl || '').trim();
  if (!frontendUrl) return fail('URL do aplicativo não configurada para redefinição.', 'FRONTEND_URL_REQUIRED');
  const resetLink = frontendUrl.replace(/\/$/, '') + '/?resetToken=' + encodeURIComponent(token) + '&email=' + encodeURIComponent(email);
  const subject = 'Redefinição de senha — Mapa de Riscos';
  const body = [
    'Olá ' + String(found.row[found.map.nome != null ? found.map.nome : 2] || 'usuário') + ',',
    '',
    'Recebemos uma solicitação para redefinir sua senha.',
    'Use o link abaixo. Ele é válido por 1 hora:',
    '',
    resetLink,
    '',
    'Se você não solicitou esta alteração, ignore esta mensagem.'
  ].join('\n');
  MailApp.sendEmail(email, subject, body);
  return ok({ message: 'Se este e-mail estiver cadastrado, você receberá um link de redefinição.' });
}

/** Valida o token de redefinição e grava uma nova senha. */
function authResetPassword(data) {
  const email = normalizeEmail(data.email);
  const token = String(data.token || '');
  const novaSenha = String(data.senha || '');
  if (!isValidEmail(email) || !token) return fail('Token inválido.', 'INVALID_RESET_TOKEN');
  if (novaSenha.length < 6) return fail('A senha deve ter pelo menos 6 caracteres.', 'WEAK_PASSWORD');
  const found = findUserByEmail(email);
  if (!found) return fail('Token inválido.', 'INVALID_RESET_TOKEN');
  const map = found.map;
  const storedToken = String(found.row[map.resetToken != null ? map.resetToken : 7] || '');
  const expires = String(found.row[map.resetExpira != null ? map.resetExpira : 8] || '');
  if (!storedToken || storedToken !== token) return fail('Token inválido.', 'INVALID_RESET_TOKEN');
  if (!expires || new Date(expires).getTime() < Date.now()) return fail('O link de redefinição expirou.', 'RESET_EXPIRED');
  const salt = generatePasswordSalt();
  const hash = hashPassword(novaSenha, salt);
  found.sheet.getRange(found.index, (map.senhaHash != null ? map.senhaHash : 5) + 1).setValue(hash);
  found.sheet.getRange(found.index, (map.senhaSalt != null ? map.senhaSalt : 6) + 1).setValue(salt);
  found.sheet.getRange(found.index, (map.resetToken != null ? map.resetToken : 7) + 1).setValue('');
  found.sheet.getRange(found.index, (map.resetExpira != null ? map.resetExpira : 8) + 1).setValue('');
  return ok({ message: 'Senha redefinida com sucesso.' });
}

/** Procura uma sala pelo código. */
function findRoomByCode(codigo) {
  const sheet = getSheet(SHEET_SALAS, SALAS_HEADERS);
  const map = headerMap(sheet);
  const codeIndex = map.codigo != null ? map.codigo : 0;
  const rows = readRows(sheet);
  for (let i = 0; i < rows.length; i++) if (String(rows[i][codeIndex] || '') === codigo) return { sheet: sheet, index: i + 2, row: rows[i], map: map };
  return null;
}

/** Converte uma linha de sala para o objeto de domínio. */
function roomFromRow(found) {
  const map = found.map;
  const row = found.row;
  const participantsRaw = row[map.participantes != null ? map.participantes : 6];
  const participantes = participantsRaw ? String(participantsRaw).split(',').map(function(v) { return v.trim(); }).filter(Boolean) : [];
  return {
    codigo: String(row[map.codigo != null ? map.codigo : 0] || ''),
    status: String(row[map.status != null ? map.status : 1] || ''),
    criadorId: String(row[map.criadorId != null ? map.criadorId : 2] || ''),
    criadaEm: String(row[map.criadaEm != null ? map.criadaEm : 3] || ''),
    projeto: row[map.projeto != null ? map.projeto : 4] || '',
    projetoDriveId: row[map.projetoDriveId != null ? map.projetoDriveId : 5] || '',
    participantes: participantes
  };
}

/** Cria uma sala para o professor autenticado e garante código único. */
function createRoom(data) {
  const user = ensureAuthenticated(data.sessionToken);
  if (user.papel !== 'professor') return fail('Apenas professores podem criar salas.', 'FORBIDDEN');
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const sheet = getSheet(SHEET_SALAS, SALAS_HEADERS);
    let codigo = '';
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = generateRoomCode();
      if (!findRoomByCode(candidate)) { codigo = candidate; break; }
    }
    if (!codigo) throw new Error('Não foi possível gerar um código de sala único.');
    const now = new Date().toISOString();
    sheet.appendRow([codigo, 'ativa', user.id, now, '', '', '']);
    return ok({ sala: { codigo: codigo, status: 'ativa', criadaEm: now, token: user.id, papel: 'professor', participantes: 0 } });
  } finally { lock.releaseLock(); }
}

/** Entra em uma sala ativa como professor criador ou estudante participante. */
function joinRoom(data) {
  const user = ensureAuthenticated(data.sessionToken);
  const codigo = String(data.codigo || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(codigo)) return fail('Código de sala inválido.', 'INVALID_CODE');
  const found = findRoomByCode(codigo);
  if (!found) return fail('Código não encontrado.', 'ROOM_NOT_FOUND');
  const room = roomFromRow(found);
  if (room.status !== 'ativa') return fail('A sala está encerrada.', 'ROOM_INACTIVE');
  if (room.criadorId !== user.id && room.participantes.indexOf(user.id) === -1) {
    room.participantes.push(user.id);
    found.sheet.getRange(found.index, (found.map.participantes != null ? found.map.participantes : 6) + 1).setValue(room.participantes.join(','));
  }
  return ok({ sala: Object.assign(room, { token: user.id, papel: room.criadorId === user.id ? 'professor' : 'estudante' }) });
}

/** Lista salas criadas ou participadas pelo usuário. */
function listUserRooms(data) {
  const user = ensureAuthenticated(data.sessionToken);
  const sheet = getSheet(SHEET_SALAS, SALAS_HEADERS);
  const map = headerMap(sheet);
  const rows = readRows(sheet);
  const salas = [];
  rows.forEach(function(row) {
    const criadorId = String(row[map.criadorId != null ? map.criadorId : 2] || '');
    const participantesRaw = String(row[map.participantes != null ? map.participantes : 6] || '');
    const participantes = participantesRaw ? participantesRaw.split(',').map(function(v) { return v.trim(); }).filter(Boolean) : [];
    if (criadorId === user.id || participantes.indexOf(user.id) >= 0) {
      salas.push({
        codigo: String(row[map.codigo != null ? map.codigo : 0] || ''),
        status: String(row[map.status != null ? map.status : 1] || ''),
        criadaEm: String(row[map.criadaEm != null ? map.criadaEm : 3] || ''),
        papel: criadorId === user.id ? 'professor' : 'estudante',
        participantes: participantes.length + (criadorId === user.id ? 1 : 0)
      });
    }
  });
  return ok({ salas: salas });
}

/** Retorna o status público de uma sala. */
function getRoomStatus(data) {
  const codigo = String(data.codigo || '').trim().toUpperCase();
  const found = findRoomByCode(codigo);
  if (!found) return fail('Código não encontrado.', 'ROOM_NOT_FOUND');
  const room = roomFromRow(found);
  return ok({ sala: { codigo: room.codigo, status: room.status, criadaEm: room.criadaEm, participantes: room.participantes.length } });
}

/** Salva o projeto da sala somente para o professor criador. */
function saveProject(data) {
  const user = ensureAuthenticated(data.sessionToken);
  if (user.papel !== 'professor') return fail('Somente o professor pode salvar a sala.', 'FORBIDDEN');
  const codigo = String(data.codigo || '').trim().toUpperCase();
  const found = findRoomByCode(codigo);
  if (!found) return fail('Sala não encontrada.', 'ROOM_NOT_FOUND');
  const room = roomFromRow(found);
  if (room.criadorId !== user.id) return fail('Você não é o professor desta sala.', 'FORBIDDEN');
  const projectText = typeof data.projeto === 'string' ? data.projeto : JSON.stringify(data.projeto || {});
  found.sheet.getRange(found.index, (found.map.projeto != null ? found.map.projeto : 4) + 1).setValue(projectText);
  return ok({ message: 'Projeto salvo.' });
}

/** Encerra a sala e impede novas entradas. */
function endRoom(data) {
  const user = ensureAuthenticated(data.sessionToken);
  const codigo = String(data.codigo || '').trim().toUpperCase();
  const found = findRoomByCode(codigo);
  if (!found) return fail('Sala não encontrada.', 'ROOM_NOT_FOUND');
  const room = roomFromRow(found);
  if (room.criadorId !== user.id) return fail('Somente o professor da sala pode encerrá-la.', 'FORBIDDEN');
  found.sheet.getRange(found.index, (found.map.status != null ? found.map.status : 1) + 1).setValue('inativa');
  return ok({ message: 'Sala encerrada.' });
}

/** Envia uma mensagem de sinalização para a planilha. */
function sendSignal(data) {
  const sender = ensureAuthenticated(data.sessionToken);
  const codigoSala = String(data.codigoSala || '').trim().toUpperCase();
  const found = findRoomByCode(codigoSala);
  if (!found) return fail('Sala não encontrada.', 'ROOM_NOT_FOUND');
  const room = roomFromRow(found);
  if (room.status !== 'ativa') return fail('Sala encerrada.', 'ROOM_INACTIVE');
  const destinatario = String(data.destinatario || '*');
  const allowedRecipient = destinatario === '*' || destinatario === sender.id || room.criadorId === destinatario || room.participantes.indexOf(destinatario) >= 0;
  if (!allowedRecipient) return fail('Destinatário não pertence à sala.', 'FORBIDDEN');
  const senderAllowed = room.criadorId === sender.id || room.participantes.indexOf(sender.id) >= 0;
  if (!senderAllowed) return fail('Usuário não pertence à sala.', 'FORBIDDEN');
  const type = String(data.tipo || '');
  if (!['offer', 'answer', 'ice-candidate'].includes(type)) return fail('Tipo de sinalização inválido.', 'INVALID_SIGNAL');
  const sheet = getSheet(SHEET_SINALIZACAO, SIGNAL_HEADERS);
  sheet.appendRow([codigoSala, sender.id, destinatario, type, String(data.payload || ''), new Date().toISOString()]);
  return ok({ message: 'Sinal enviado.' });
}

/** Recebe e remove sinais pendentes direcionados ao usuário. */
function getSignals(data) {
  const user = ensureAuthenticated(data.sessionToken);
  const sheet = getSheet(SHEET_SINALIZACAO, SIGNAL_HEADERS);
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return ok({ signals: [] });
  const signals = [];
  const deleteRows = [];
  for (let i = rows.length - 1; i >= 1; i--) {
    const row = rows[i];
    const destinatario = String(row[2] || '');
    if (destinatario === user.id) {
      signals.push({ codigoSala: String(row[0] || ''), remetente: String(row[1] || ''), destinatario: destinatario, tipo: String(row[3] || ''), payload: String(row[4] || ''), timestamp: String(row[5] || '') });
      deleteRows.push(i + 1);
    }
  }
  deleteRows.sort(function(a, b) { return b - a; }).forEach(function(rowNumber) { sheet.deleteRow(rowNumber); });
  return ok({ signals: signals.reverse() });
}

/** Salva uma cópia do projeto no Google Drive do dono da sessão. */
function saveProjectToDrive(data) {
  const user = ensureAuthenticated(data.sessionToken);
  if (user.papel !== 'professor') return fail('Somente professores podem salvar projetos no Drive.', 'FORBIDDEN');
  const projeto = data.projeto || {};
  const codigoSala = String(data.codigo || '').trim().toUpperCase() || 'SEM-SALA';
  const folder = getOrCreateFolder_('Mapa de Riscos');
  const file = folder.createFile('projeto_' + codigoSala + '_' + Date.now() + '.json', JSON.stringify(projeto), MimeType.JSON);
  return ok({ fileId: file.getId() });
}

/** Obtém ou cria uma pasta no Drive. */
function getOrCreateFolder_(name) {
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}

/** Lê um projeto JSON do Google Drive pelo ID. */
function getProjectFromDrive(data) {
  ensureAuthenticated(data.sessionToken);
  if (!data.fileId) return fail('Arquivo não informado.', 'FILE_REQUIRED');
  const file = DriveApp.getFileById(String(data.fileId));
  return ok({ projeto: JSON.parse(file.getBlob().getDataAsString()) });
}

/** Roteia as ações POST do frontend. */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}');
    switch (String(data.action || '')) {
      case 'authRegister': return authRegister(data);
      case 'authLogin': return authLogin(data);
      case 'authForgotPassword': return authForgotPassword(data);
      case 'authResetPassword': return authResetPassword(data);
      case 'authLogout': return authLogout(data);
      case 'criar': return createRoom(data);
      case 'entrar': return joinRoom(data);
      case 'status': return getRoomStatus(data);
      case 'listarSalas': return listUserRooms(data);
      case 'salvar': return saveProject(data);
      case 'encerrar': return endRoom(data);
      case 'enviarSinal': return sendSignal(data);
      case 'receberSinal': return getSignals(data);
      case 'salvarDrive': return saveProjectToDrive(data);
      case 'lerDrive': return getProjectFromDrive(data);
      case 'setup': return setupSheets();
      default: return fail('Ação inválida.', 'INVALID_ACTION');
    }
  } catch (err) {
    return fail(err.message || 'Erro interno do servidor.', 'SERVER_ERROR');
  }
}

/** Roteia consultas GET públicas/de diagnóstico e sinalização autenticada. */
function doGet(e) {
  try {
    const action = String(e.parameter && e.parameter.action || '');
    if (action === 'status') return getRoomStatus({ codigo: e.parameter.codigo });
    if (action === 'ping') return ok({ service: 'Mapa de Riscos GAS', status: 'online', timestamp: new Date().toISOString() });
    if (action === 'receberSinal') return getSignals({ sessionToken: e.parameter.sessionToken });
    return fail('Endpoint desconhecido.', 'UNKNOWN_ENDPOINT');
  } catch (err) {
    return fail(err.message || 'Erro interno do servidor.', 'SERVER_ERROR');
  }
}
