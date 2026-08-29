/**
 * Mapa de Riscos do Laboratório — Backend Google Apps Script.
 *
 * Responsabilidades:
 * - autenticar usuários com Google Identity Services (GIS);
 * - manter usuários, salas, projetos e sinalização no Google Sheets;
 * - gerar sessões temporárias com CacheService;
 * - opcionalmente persistir projetos cifrados no Google Drive;
 * - validar autorização de professor/estudante em cada operação protegida.
 *
 * Antes de publicar:
 * 1. configure SPREADSHEET_ID;
 * 2. configure GOOGLE_CLIENT_ID;
 * 3. publique o projeto como Web App.
 */

const SPREADSHEET_ID = 'SEU_ID_DA_PLANILHA';
const GOOGLE_CLIENT_ID = 'SEU_CLIENT_ID_GOOGLE';
const SHEET_USUARIOS = 'usuarios';
const SHEET_SALAS = 'salas';
const SHEET_SINALIZACAO = 'sinalizacao';
const SHEET_PROJETOS = 'projetos';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SESSION_TTL_SECONDS = 3600;

const USUARIOS_HEADERS = ['id', 'email', 'nome', 'foto', 'papel', 'criadoEm', 'ultimoAcesso'];
const SALAS_HEADERS = ['codigo', 'status', 'criadorId', 'criadaEm', 'projeto', 'projetoDriveId', 'participantes'];
const SIGNAL_HEADERS = ['codigoSala', 'remetente', 'destinatario', 'tipo', 'payload', 'timestamp'];
const PROJECT_HEADERS = ['codigoSala', 'versao', 'salvoEm', 'projeto'];

/** Cria uma resposta HTTP JSON padronizada. */
function jsonOutput(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
/** Cria uma resposta de sucesso. */
function ok(data) { return jsonOutput(Object.assign({ ok: true }, data || {})); }
/** Cria uma resposta de erro com código técnico. */
function fail(message, code) { return jsonOutput({ ok: false, error: message, code: code || 'ERROR' }); }
/** Obtém ou cria uma aba e inicializa seus cabeçalhos. */
function getSpreadsheetId() {
  const configured = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (configured) return configured;
  if (SPREADSHEET_ID && SPREADSHEET_ID !== 'SEU_ID_DA_PLANILHA') return SPREADSHEET_ID;
  throw new Error('Planilha mestra não configurada. Execute setupMasterSpreadsheet().');
}

/** Obtém ou cria uma aba e inicializa seus cabeçalhos. */
function getSheet(name, headers) {
  const ss = SpreadsheetApp.openById(getSpreadsheetId());
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0 && headers) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }
  return sheet;
}

/**
 * Cria a planilha mestra do sistema e todas as abas necessárias.
 *
 * Execute esta função uma vez manualmente no editor do Google Apps Script.
 * O ID da planilha criada é salvo nas Script Properties para que o restante
 * do backend possa acessá-la sem exigir que o ID fique exposto no código.
 */
function setupMasterSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty('SPREADSHEET_ID');

  if (existingId) {
    try {
      const existing = SpreadsheetApp.openById(existingId);
      setupSheetsInternal_(existing);
      return {
        ok: true,
        created: false,
        message: 'A planilha mestra já está configurada.',
        spreadsheetId: existing.getId(),
        spreadsheetName: existing.getName(),
        spreadsheetUrl: existing.getUrl()
      };
    } catch (err) {
      props.deleteProperty('SPREADSHEET_ID');
    }
  }

  if (SPREADSHEET_ID && SPREADSHEET_ID !== 'SEU_ID_DA_PLANILHA') {
    try {
      const configured = SpreadsheetApp.openById(SPREADSHEET_ID);
      props.setProperty('SPREADSHEET_ID', configured.getId());
      setupSheetsInternal_(configured);
      return {
        ok: true,
        created: false,
        message: 'A planilha configurada foi registrada como planilha mestra.',
        spreadsheetId: configured.getId(),
        spreadsheetName: configured.getName(),
        spreadsheetUrl: configured.getUrl()
      };
    } catch (err) {
      throw new Error('O SPREADSHEET_ID configurado é inválido ou inacessível.');
    }
  }

  const ss = SpreadsheetApp.create('Mapa de Riscos - Planilha Mestra');
  setupSheetsInternal_(ss);
  props.setProperty('SPREADSHEET_ID', ss.getId());

  return {
    ok: true,
    created: true,
    message: 'Planilha mestra criada e configurada com sucesso.',
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    spreadsheetUrl: ss.getUrl()
  };
}

/** Cria/configura todas as abas da planilha mestra. */
function setupSheetsInternal_(ss) {
  const configs = {
    usuarios: USUARIOS_HEADERS,
    salas: SALAS_HEADERS,
    sinalizacao: SIGNAL_HEADERS,
    projetos: PROJECT_HEADERS
  };

  const firstSheet = ss.getSheets()[0];
  if (firstSheet && firstSheet.getName() === 'Sheet1' && !ss.getSheetByName('usuarios')) {
    firstSheet.setName('usuarios');
  }

  Object.keys(configs).forEach(function(name) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    const headers = configs[name];
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else {
      const existing = sheet.getRange(1, 1, 1, Math.max(headers.length, sheet.getLastColumn() || 1)).getValues()[0];
      const hasHeader = headers.every(function(header, index) { return String(existing[index] || '') === header; });
      if (!hasHeader) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  });
}
/** Inicializa todas as abas esperadas pelo sistema. */
function setupSheets() {
  const ss = SpreadsheetApp.openById(getSpreadsheetId());
  setupSheetsInternal_(ss);
  return ok({ message: 'Abas inicializadas.', spreadsheetId: ss.getId(), spreadsheetUrl: ss.getUrl() });
}
/** Normaliza um código de sala. */
function normalizeCode(value) { return String(value || '').trim().toUpperCase(); }
/** Gera um identificador de sessão/usuário. */
function generateToken() { return Utilities.getUuid(); }
/** Gera um código aleatório de seis caracteres sem caracteres ambíguos. */
function generateRoomCode() {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length));
  return code;
}
/** Lê os registros de uma aba sem o cabeçalho. */
function readRows(sheet) {
  const values = sheet.getDataRange().getValues();
  return values.length > 1 ? values.slice(1) : [];
}
/** Retorna um mapa nome->índice para os cabeçalhos da aba. */
function headerMap(sheet) {
  const headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
  const map = {};
  headers.forEach((name, i) => { map[String(name || '').trim()] = i; });
  return map;
}
/** Procura uma sala pelo código, compatível com o esquema novo. */
function findRoom(sheet, codigo) {
  const map = headerMap(sheet);
  const codeIndex = map.codigo ?? 0;
  const rows = readRows(sheet);
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][codeIndex] || '') === codigo) return { index: i + 2, row: rows[i], map: map };
  }
  return null;
}
/** Converte uma linha da aba salas para um objeto de domínio. */
function roomFromRow(found) {
  const row = found.row;
  const map = found.map || {};
  const participantsRaw = row[map.participantes ?? 6];
  const participantes = participantsRaw ? String(participantsRaw).split(',').map(v => v.trim()).filter(Boolean) : [];
  return {
    codigo: String(row[map.codigo ?? 0] || ''),
    status: String(row[map.status ?? 1] || ''),
    criadorId: String(row[map.criadorId ?? 2] || row[map.criador ?? 2] || ''),
    criadaEm: String(row[map.criadaEm ?? 3] || ''),
    projeto: row[map.projeto ?? 4] || null,
    projetoDriveId: row[map.projetoDriveId ?? 5] || null,
    participantes: participantes
  };
}
/** Retorna somente os metadados públicos de uma sala. */
function publicRoom(room) {
  return { codigo: room.codigo, status: room.status, criadaEm: room.criadaEm, participantes: room.participantes.length };
}
/** Lê um usuário pelo ID no cadastro. */
function findUserById(userId) {
  const sheet = getSheet(SHEET_USUARIOS, USUARIOS_HEADERS);
  const rows = readRows(sheet);
  for (let i = 0; i < rows.length; i++) if (String(rows[i][0]) === String(userId)) return { sheet, index: i + 2, row: rows[i] };
  return null;
}
/** Valida um token ID do Google consultando o endpoint oficial de tokeninfo. */
function verifyIdToken(idToken) {
  if (!idToken) throw new Error('Token Google não fornecido.');
  const url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw new Error('Token Google inválido.');
  const payload = JSON.parse(response.getContentText());
  if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') throw new Error('Emissor Google inválido.');
  if (GOOGLE_CLIENT_ID !== 'SEU_CLIENT_ID_GOOGLE' && payload.aud !== GOOGLE_CLIENT_ID) throw new Error('Cliente Google não autorizado.');
  if (payload.exp && Number(payload.exp) * 1000 <= Date.now()) throw new Error('Token Google expirado.');
  if (String(payload.email_verified || '').toLowerCase() !== 'true') throw new Error('Conta Google não verificada.');
  return payload;
}
/** Cria ou atualiza o usuário autenticado e devolve seu perfil. */
function upsertUserFromGoogle(payload) {
  const sheet = getSheet(SHEET_USUARIOS, USUARIOS_HEADERS);
  const found = findUserById(payload.sub);
  const now = new Date().toISOString();
  const papelAtual = found ? String(found.row[4] || 'estudante') : 'estudante';
  if (!found) {
    sheet.appendRow([payload.sub, payload.email || '', payload.name || payload.email || 'Usuário', payload.picture || '', 'estudante', now, now]);
    return { id: payload.sub, email: payload.email || '', nome: payload.name || payload.email || 'Usuário', foto: payload.picture || '', papel: 'estudante' };
  }
  found.sheet.getRange(found.index, 2, 1, 3).setValues([[payload.email || found.row[1] || '', payload.name || found.row[2] || payload.email || 'Usuário', payload.picture || found.row[3] || '']]);
  found.sheet.getRange(found.index, 7).setValue(now);
  return { id: payload.sub, email: payload.email || found.row[1] || '', nome: payload.name || found.row[2] || 'Usuário', foto: payload.picture || found.row[3] || '', papel: papelAtual };
}
/** Cria uma sessão temporária vinculada ao usuário autenticado. */
function createSession(usuario) {
  const sessionToken = generateToken();
  CacheService.getScriptCache().put('session_' + sessionToken, JSON.stringify(usuario), SESSION_TTL_SECONDS);
  return sessionToken;
}
/** Autentica uma sessão e retorna o usuário correspondente. */
function ensureAuthenticated(sessionToken) {
  if (!sessionToken) throw new Error('Não autenticado.');
  const cached = CacheService.getScriptCache().get('session_' + String(sessionToken));
  if (!cached) throw new Error('Sessão expirada. Faça login novamente.');
  return JSON.parse(cached);
}
/** Invalida uma sessão temporária. */
function authLogout(data) {
  if (data && data.sessionToken) CacheService.getScriptCache().remove('session_' + String(data.sessionToken));
  return ok({ message: 'Sessão encerrada.' });
}
/** Realiza login via Google Identity Services. */
function authLogin(data) {
  const payload = verifyIdToken(data.idToken);
  const usuario = upsertUserFromGoogle(payload);
  const sessionToken = createSession(usuario);
  return ok({ usuario: usuario, sessionToken: sessionToken });
}
/** Lista salas criadas ou frequentadas pelo usuário autenticado. */
function listUserRooms(data) {
  const user = ensureAuthenticated(data.sessionToken);
  const sheet = getSheet(SHEET_SALAS, SALAS_HEADERS);
  const rows = readRows(sheet);
  const map = headerMap(sheet);
  const out = [];
  rows.forEach(row => {
    const room = roomFromRow({ row: row, map: map });
    if (room.criadorId === user.id || room.participantes.indexOf(user.id) >= 0) {
      out.push({ codigo: room.codigo, status: room.status, criadaEm: room.criadaEm, papel: room.criadorId === user.id ? 'professor' : 'estudante', participantes: room.participantes.length });
    }
  });
  return ok({ salas: out });
}
/** Roteia POSTs para os endpoints da aplicação. */
function doPost(e) {
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    switch (data.action) {
      case 'authLogin': return authLogin(data);
      case 'authLogout': return authLogout(data);
      case 'criar': return createRoom(data);
      case 'entrar': return joinRoom(data);
      case 'salvar': return saveProject(data);
      case 'encerrar': return endRoom(data);
      case 'enviarSinal': return sendSignal(data);
      case 'participantes': return listParticipants(data);
      case 'usuarioSalas': return listUserRooms(data);
      default: return fail('Ação inválida.');
    }
  } catch (err) {
    return fail(err && err.message ? err.message : 'Erro interno.');
  }
}
/** Roteia GETs públicos e de sinalização. */
function doGet(e) {
  try {
    const action = String(e && e.parameter && e.parameter.action || '');
    if (action === 'status') return getRoomStatus(e.parameter.codigo);
    if (action === 'receberSinal') return getSignals(e.parameter.sessionToken);
    return fail('Endpoint desconhecido.');
  } catch (err) {
    return fail(err && err.message ? err.message : 'Erro interno.');
  }
}
/** Cria uma sala apenas para usuário com papel professor. */
function createRoom(data) {
  const user = ensureAuthenticated(data.sessionToken);
  if (user.papel !== 'professor') return fail('Apenas professores podem criar salas.', 'FORBIDDEN');
  const sheet = getSheet(SHEET_SALAS, SALAS_HEADERS);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    let codigo = normalizeCode(data.codigo);
    if (codigo && !/^[A-Z0-9]{6}$/.test(codigo)) return fail('O código deve ter exatamente 6 caracteres alfanuméricos.', 'INVALID_CODE');
    for (let i = 0; i < 20; i++) {
      if (!codigo) codigo = generateRoomCode();
      if (!findRoom(sheet, codigo)) break;
      codigo = '';
    }
    if (!codigo) return fail('Não foi possível gerar um código disponível.', 'CODE_EXHAUSTED');
    const now = new Date().toISOString();
    sheet.appendRow([codigo, 'ativa', user.id, now, '', '', '']);
    return ok({ sala: { codigo: codigo, status: 'ativa', criadaEm: now, token: user.id, papel: 'professor', participantes: 0, projeto: null } });
  } finally { lock.releaseLock(); }
}
/** Valida um código e registra a entrada do usuário autenticado. */
function joinRoom(data) {
  const user = ensureAuthenticated(data.sessionToken);
  const codigo = normalizeCode(data.codigo);
  if (!/^[A-Z0-9]{6}$/.test(codigo)) return fail('Código inválido.', 'INVALID_CODE');
  const sheet = getSheet(SHEET_SALAS, SALAS_HEADERS);
  const found = findRoom(sheet, codigo);
  if (!found || String(found.row[found.map.status ?? 1]) !== 'ativa') return fail('Código não encontrado ou sala encerrada.', 'ROOM_NOT_FOUND');
  const room = roomFromRow(found);
  if (user.papel === 'professor') {
    if (room.criadorId !== user.id) return fail('Você não é o professor desta sala.', 'FORBIDDEN');
    let projeto = room.projeto || null;
    if (!projeto && room.projetoDriveId) { try { projeto = getProjectFromDrive(room.projetoDriveId); } catch (_) {} }
    return ok({ sala: { codigo, token: user.id, papel: 'professor', status: room.status, criadaEm: room.criadaEm, projeto: projeto, participantes: room.participantes.length } });
  }
  if (room.participantes.indexOf(user.id) < 0) {
    room.participantes.push(user.id);
    sheet.getRange(found.index, (found.map.participantes ?? 6) + 1).setValue(room.participantes.join(','));
  }
  let projeto = room.projeto || null;
  if (!projeto && room.projetoDriveId) { try { projeto = getProjectFromDrive(room.projetoDriveId); } catch (_) {} }
  return ok({ sala: { codigo, token: user.id, papel: 'estudante', status: room.status, criadaEm: room.criadaEm, projeto: projeto, participantes: room.participantes.length } });
}
/** Retorna status público de uma sala ativa. */
function getRoomStatus(codigo) {
  const normalized = normalizeCode(codigo);
  const sheet = getSheet(SHEET_SALAS, SALAS_HEADERS);
  const found = findRoom(sheet, normalized);
  if (!found || String(found.row[found.map.status ?? 1]) !== 'ativa') return fail('Código não encontrado.', 'ROOM_NOT_FOUND');
  return ok({ sala: publicRoom(roomFromRow(found)) });
}
/** Persiste o projeto cifrado da sala e uma cópia no Google Drive. */
function saveProject(data) {
  const user = ensureAuthenticated(data.sessionToken);
  if (user.papel !== 'professor') return fail('Apenas o professor pode salvar o projeto.', 'FORBIDDEN');
  const codigo = normalizeCode(data.codigo);
  const sheet = getSheet(SHEET_SALAS, SALAS_HEADERS);
  const found = findRoom(sheet, codigo);
  if (!found || String(found.row[found.map.status ?? 1]) !== 'ativa') return fail('Sala não encontrada ou encerrada.', 'ROOM_NOT_FOUND');
  const room = roomFromRow(found);
  if (room.criadorId !== user.id) return fail('Você não é o professor desta sala.', 'FORBIDDEN');
  if (!data.projeto || typeof data.projeto !== 'string') return fail('Projeto deve estar criptografado.', 'INVALID_PROJECT');
  const now = new Date().toISOString();
  sheet.getRange(found.index, (found.map.projeto ?? 4) + 1).setValue(data.projeto);
  let driveId = room.projetoDriveId || '';
  try { driveId = saveProjectToDrive(user.id, data.projeto, codigo, room.projetoDriveId); } catch (err) { console.warn('Drive indisponível: ' + err.message); }
  if (found.map.projetoDriveId !== undefined) sheet.getRange(found.index, found.map.projetoDriveId + 1).setValue(driveId || '');
  const projects = getSheet(SHEET_PROJETOS, PROJECT_HEADERS);
  projects.appendRow([codigo, 1, now, data.projeto]);
  return ok({ salvoEm: now, projetoDriveId: driveId || null });
}
/** Encerra uma sala e remove sua sinalização pendente. */
function endRoom(data) {
  const user = ensureAuthenticated(data.sessionToken);
  if (user.papel !== 'professor') return fail('Apenas professores podem encerrar salas.', 'FORBIDDEN');
  const codigo = normalizeCode(data.codigo);
  const sheet = getSheet(SHEET_SALAS, SALAS_HEADERS);
  const found = findRoom(sheet, codigo);
  if (!found) return fail('Sala não encontrada.', 'ROOM_NOT_FOUND');
  const room = roomFromRow(found);
  if (room.criadorId !== user.id) return fail('Você não é o professor desta sala.', 'FORBIDDEN');
  sheet.getRange(found.index, (found.map.status ?? 1) + 1).setValue('inativa');
  const signalSheet = getSheet(SHEET_SINALIZACAO, SIGNAL_HEADERS);
  const signalRows = readRows(signalSheet);
  for (let i = signalRows.length; i >= 1; i--) if (String(signalRows[i - 1][0]) === codigo) signalSheet.deleteRow(i + 1);
  return ok({ sala: { codigo, status: 'inativa' } });
}
/** Lista participantes da sala para o professor, por IDs Google. */
function listParticipants(data) {
  const user = ensureAuthenticated(data.sessionToken);
  if (user.papel !== 'professor') return fail('Apenas professores podem listar participantes.', 'FORBIDDEN');
  const codigo = normalizeCode(data.codigo);
  const sheet = getSheet(SHEET_SALAS, SALAS_HEADERS);
  const found = findRoom(sheet, codigo);
  if (!found) return fail('Sala não encontrada.', 'ROOM_NOT_FOUND');
  const room = roomFromRow(found);
  if (room.criadorId !== user.id) return fail('Você não é o professor desta sala.', 'FORBIDDEN');
  return ok({ participantes: room.participantes });
}
/** Verifica se um usuário pertence à sala. */
function findRoomParticipant(room, userId) { return !!room && !!userId && (room.criadorId === userId || room.participantes.indexOf(userId) >= 0); }
/** Persiste uma mensagem WebRTC direcionada a um usuário autenticado da mesma sala. */
function sendSignal(data) {
  const user = ensureAuthenticated(data.sessionToken);
  const codigo = normalizeCode(data.codigoSala);
  const sheet = getSheet(SHEET_SALAS, SALAS_HEADERS);
  const found = findRoom(sheet, codigo);
  if (!found || String(found.row[found.map.status ?? 1]) !== 'ativa') return fail('Sala não encontrada ou encerrada.', 'ROOM_NOT_FOUND');
  const room = roomFromRow(found);
  if (!findRoomParticipant(room, user.id)) return fail('Usuário não pertence à sala.', 'FORBIDDEN');
  const tipo = String(data.tipo || '');
  if (['offer', 'answer', 'ice-candidate'].indexOf(tipo) < 0) return fail('Tipo de sinalização inválido.', 'INVALID_SIGNAL');
  if (!data.destinatario || !data.payload) return fail('Destinatário e payload são obrigatórios.', 'INVALID_SIGNAL');
  if (!findRoomParticipant(room, String(data.destinatario))) return fail('Destinatário não pertence à sala.', 'INVALID_SIGNAL');
  const signals = getSheet(SHEET_SINALIZACAO, SIGNAL_HEADERS);
  signals.appendRow([codigo, user.id, String(data.destinatario), tipo, String(data.payload), new Date().toISOString()]);
  return ok({});
}
/** Entrega ao usuário suas mensagens de sinalização pendentes e as remove. */
function getSignals(sessionToken) {
  const user = ensureAuthenticated(sessionToken);
  const signalSheet = getSheet(SHEET_SINALIZACAO, SIGNAL_HEADERS);
  const rows = readRows(signalSheet);
  const matches = [];
  const deleteIndexes = [];
  const roomSheet = getSheet(SHEET_SALAS, SALAS_HEADERS);
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    const codigo = String(row[0] || '');
    const roomFound = findRoom(roomSheet, codigo);
    if (!roomFound) continue;
    const room = roomFromRow(roomFound);
    if (!findRoomParticipant(room, user.id)) continue;
    if (String(row[2] || '') !== String(user.id)) continue;
    matches.unshift({ remetente: String(row[1]), tipo: String(row[3]), payload: String(row[4]), timestamp: String(row[5]) });
    deleteIndexes.push(i + 2);
  }
  deleteIndexes.sort((a, b) => b - a).forEach(rowNumber => signalSheet.deleteRow(rowNumber));
  return ok({ signals: matches });
}
/** Cria/obtém a pasta raiz no Google Drive do usuário. */
function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
}
/** Salva o payload já cifrado em um arquivo JSON no Drive. */
function saveProjectToDrive(userId, projetoCriptografado, codigoSala, existingFileId) {
  const folder = getOrCreateFolder('Mapa de Riscos');
  if (existingFileId) {
    try {
      const oldFile = DriveApp.getFileById(existingFileId);
      oldFile.setContent(String(projetoCriptografado));
      return oldFile.getId();
    } catch (_) {}
  }
  const fileName = 'projeto_' + codigoSala + '_' + new Date().toISOString().replace(/[:.]/g, '-') + '_' + userId + '.json';
  return folder.createFile(fileName, String(projetoCriptografado), MimeType.JSON).getId();
}
/** Recupera um projeto cifrado de um arquivo do Drive. */
function getProjectFromDrive(fileId) {
  const file = DriveApp.getFileById(fileId);
  return JSON.parse(file.getBlob().getDataAsString());
}
