"use strict";


const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// ESTADO DA APLICAÇÃO
const state = {
  areas: [], areaAtiva: null, viewMode: "area",
  cam: { x: 6, y: 4, zoom: 70 }, overviewCam: { x: 6, y: 4, zoom: 50 },
  grid: true, snap: true, ruler: false, tool: "select",
  selected: null, selectedObjects: [], marquee: null, drag: null, overviewDrag: null,
  pan: false, last: null, history: [], future: [], pendingHistory: false, guides: [], panelTab: "layers", role: null, roomCode: null, roomToken: null, user: null
};
window.MAPA_RUNTIME = { get state() { return state; } };
/**
 * Cria uma nova área com ID, nome, tipo, dimensões, posição global e lista de objetos.
 */
function createArea(nome="Laboratório", tipo="laboratorio", w=12, h=8, x=0, y=0){
  return { id: crypto.randomUUID(), nome, tipo, dimensoes:{w,h}, posicaoGlobal:{x,y}, objetos:[], conexoes:[] };
}
state.areas.push(createArea()); state.areaAtiva=state.areas[0].id;
/**
 * Retorna a área atualmente selecionada ou a primeira área disponível como fallback.
 */
function activeArea(){ return state.areas.find(a=>a.id===state.areaAtiva) || state.areas[0]; }


/**
 * Cria uma cópia profunda das áreas de um modelo para evitar alterações no modelo original.
 */
function cloneModelAreas(modelAreas) {
  return JSON.parse(JSON.stringify(modelAreas || []));
}

/**
 * Converte e normaliza áreas importadas, recriando IDs e ajustando conexões entre áreas.
 */
function normalizeModelAreas(rawAreas) {
  const cloned = cloneModelAreas(rawAreas);
  const areas = cloned.map((a, i) => ({
    id: crypto.randomUUID(),
    nome: sanitizeNoEmoji(a.nome || `Área ${i + 1}`, `Área ${i + 1}`),
    tipo: a.tipo || "apoio",
    dimensoes: { w: Number(a.dimensoes?.w || a.room?.w || 12), h: Number(a.dimensoes?.h || a.room?.h || 8) },
    posicaoGlobal: { x: Number(a.posicaoGlobal?.x || i * 14), y: Number(a.posicaoGlobal?.y || 0) },
    objetos: Array.isArray(a.objetos) ? a.objetos : (Array.isArray(a.objects) ? a.objects : []),
    conexoes: []
  }));
  const sourceIdMap = new Map();
  const templateMap = new Map();
  cloned.forEach((a, i) => {
    if (a.id) sourceIdMap.set(a.id, areas[i].id);
    if (a.templateId) templateMap.set(a.templateId, areas[i].id);
  });
  areas.forEach((area, i) => {
    area.objetos.forEach(o => {
      if (o.connectionTemplateId && templateMap.has(o.connectionTemplateId)) {
        o.connectionAreaId = templateMap.get(o.connectionTemplateId);
      } else if (o.connectionAreaId && sourceIdMap.has(o.connectionAreaId)) {
        o.connectionAreaId = sourceIdMap.get(o.connectionAreaId);
      } else if (o.connectionAreaId && !sourceIdMap.has(o.connectionAreaId) && !areas.some(a => a.id === o.connectionAreaId)) {
        o.connectionAreaId = null;
      }
      delete o.connectionTemplateId;
      delete o.templateId;
      normalizeObject(o);
    });
  });
  return areas;
}

/**
 * Aplica um modelo selecionado ao projeto atual, substituindo suas áreas após a confirmação.
 */
function applyModel(model) {
  const nextAreas = normalizeModelAreas(model.areas);
  if (!nextAreas.length) throw new Error("Modelo sem áreas válidas");
  pushHistory();
  state.areas = nextAreas;
  state.areaAtiva = nextAreas[0].id;
  state.viewMode = "area";
  state.selected = null;
  state.selectedObjects = [];
  state.history = state.history; // preserva histórico já criado por pushHistory
  state.future = [];
  syncAreaConnections();
  updateAreaUI();
  enterEditor();
  showToast(`Modelo “${sanitizeNoEmoji(model.nome, "Modelo")}” aplicado`, "success");
}
Object.defineProperties(state,{
  room:{get(){return activeArea().dimensoes;},set(v){activeArea().dimensoes={w:Number(v.w),h:Number(v.h)};}},
  objects:{get(){return activeArea().objetos;},set(v){activeArea().objetos=Array.isArray(v)?v:[];}}
});
/**
 * Reconstrói as conexões entre áreas a partir das portas configuradas.
 */
function syncAreaConnections(){
  state.areas.forEach(a=>a.conexoes=[]);
  state.areas.forEach(source=>source.objetos.forEach(o=>{
    if(o.type!=='door'||!o.connectionAreaId) return;
    const target=state.areas.find(a=>a.id===o.connectionAreaId);
    if(!target || target.id===source.id) return;
    if(!source.conexoes.includes(target.id)) source.conexoes.push(target.id);
    // A conexão física é registrada nos dois ambientes, mesmo que apenas
    // a porta de origem esteja explicitamente vinculada ao destino.
    if(!target.conexoes.includes(source.id)) target.conexoes.push(source.id);
  }));
}

window.normalizeModelAreas = normalizeModelAreas;
window.syncAreaConnections = syncAreaConnections;
window.updateAreaUI = updateAreaUI;
window.fitRoom = fitRoom;
window.updateUI = updateUI;
window.requestDraw = requestDraw;

// SVG ICONS
const EYE_OPEN_SVG = `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_SLASH_SVG = `<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
const LOCK_LOCKED_SVG = `<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
const LOCK_UNLOCKED_SVG = `<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`;

const riskImages = {};
RISK_TYPES.forEach(type => {
  const img = new Image();
  img.src = `assets/svg/risk-${type}.svg`;
  img.onload = () => requestDraw();
  riskImages[type] = img;
});

const equipmentImages = {};
EQUIPMENT_TYPES.forEach(type => {
  const img = new Image();
  img.src = `assets/svg/equipment-${type}.svg`;
  img.onload = () => requestDraw();
  equipmentImages[type] = img;
});

const $ = id => document.getElementById(id);

/**
 * Registra um listener somente quando o elemento existe no DOM.
 * Evita falhas de inicialização quando partes opcionais da interface
 * não estão presentes em uma tela específica.
 */
function on(id, event, handler, options) {
  const el = $(id);
  if (el) el.addEventListener(event, handler, options);
  return el;
}
const ROOM_SESSION_KEY = "mapa_riscos_room_session";
const USER_KEY = "mapa_riscos_local_current_user_v1";
const canEdit = () => state.role !== "student";

/** Retorna se existe uma sessão local autenticada. */
function isAuthenticated() { return Boolean(state.user?.id); }
/** Atualiza a interface conforme o usuário autenticado e o modo da sala. */
function applyAuthUI() {
  const authenticated = isAuthenticated();
  const homeIdentity = $("homeUserIdentity");
  const identityText = authenticated ? `${state.user.nome || state.user.email} · ${state.user.papel}` : "Não autenticado";
  if (homeIdentity) homeIdentity.textContent = identityText;
  document.querySelectorAll("#createRoomBtn, #professorJoinForm input, #professorJoinForm button, #studentJoinForm input, #studentJoinForm button").forEach(el => { el.disabled = !authenticated || state.role === "student"; });
  const createBtn = $("createRoomBtn"); if (createBtn) createBtn.disabled = !authenticated || state.user.papel !== "professor";
}

/** Mantém a UI de login/cadastro coerente com o perfil selecionado. */
function syncAuthFormUI() {
  const professor = loginUiRole === "professor";
  const registering = loginUiMode === "register";
  $("authTitle")?.replaceChildren(document.createTextNode(`${registering ? "Criar conta" : "Entrar"} como ${professor ? "professor" : "estudante"}`));
  const subtitle = $("authSubtitle"); if (subtitle) subtitle.textContent = professor ? "Acesse sua conta para criar e gerenciar salas." : "Acesse sua conta para participar de uma sala.";
  $("registerNameField")?.classList.toggle("hidden", !registering);
  $("studentRoomField")?.classList.toggle("hidden", professor || registering);
  $("authSubmitHint")?.replaceChildren(document.createTextNode(registering ? "Salvar minha conta" : "Usar minha conta"));
  const submit = $("authSubmit"); if (submit) submit.querySelector("strong").textContent = registering ? "Criar conta" : "Entrar";
}

let loginUiRole = "professor";
let loginUiMode = "login";

/** Processa o login ou cadastro local conforme o modo atual. */
async function submitAuthForm(e) {
  e.preventDefault(); setLoginError(""); setLoginLoading(true, loginUiMode === "register" ? "Criando conta…" : "Entrando…");
  try {
    const nome = $("authName")?.value || ""; const email = $("authEmail")?.value || ""; const senha = $("authPassword")?.value || "";
    const user = loginUiMode === "register" ? await AuthAPI.registerUser(nome, email, senha, loginUiRole) : await AuthAPI.loginUser(email, senha, loginUiRole);
    state.user = user; applyAuthUI();
    console.log("Usuário autenticado:", state.user);
    if (loginUiRole === "estudante" && $("studentRoomCodeAuth")?.value) {
      await joinRoomFromLogin($("studentRoomCodeAuth").value, false);
      return;
    }
    showHomeScreen(); showToast(`Acesso realizado como ${user.nome}`, "success");
  } catch (err) { setLoginError(err.message || "Não foi possível autenticar."); }
  finally { setLoginLoading(false); }
}

/** Carrega as salas locais vinculadas ao usuário autenticado. */
async function loadUserRooms() {
  if (!isAuthenticated()) return [];
  const result = await apiRequest("/api/usuario/salas", { method: "POST", body: JSON.stringify({}) });
  const rooms = Array.isArray(result.salas) ? result.salas : []; const section = $("userRoomsSection"), list = $("userRoomsList");
  if (!section || !list) return rooms;
  section.hidden = false;
  list.innerHTML = rooms.length ? rooms.map(room => { const code = escapeHtml(room.codigo); return `<div class="room-list-item"><div><strong>Sala ${code}</strong><small>${room.papel === "professor" ? "Professor" : "Estudante"} · ${room.status === "ativa" ? "Ativa" : "Encerrada"} · ${room.participantes || 0} participante(s)</small></div><button type="button" class="room-enter-btn" data-room-code="${code}" ${room.status === "ativa" ? "" : "disabled"}>Entrar</button></div>`; }).join("") : '<span class="recent-empty">Nenhuma sala vinculada a esta conta.</span>';
  list.querySelectorAll(".room-enter-btn").forEach(btn => btn.addEventListener("click", () => enterListedRoom(btn.dataset.roomCode)));
  return rooms;
}

/** Entra em uma sala escolhida na Home. */
async function enterListedRoom(code) { if (!isAuthenticated()) return; setLoginLoading(true, "Entrando na sala…"); try { const data = await apiRequest("/api/sala/entrar", { method: "POST", body: JSON.stringify({codigo:code}) }); await enterRoomFromServer(data.sala, data.sala.papel); } catch (err) { showToast(err.message, "error"); } finally { setLoginLoading(false); } }

/** Encerra a sessão local. */
async function logoutUser() { state.user = null; clearRoomSession(); AuthAPI.logoutUser(); applySessionUI(); applyAuthUI(); showLoginScreen(); }

/**
 * Mostra ou oculta o estado de carregamento da tela de login.
 */
function setLoginLoading(show, message = "Verificando sala…") {
  const el = $("loginLoading"); if (!el) return;
  el.textContent = message; el.classList.toggle("hidden", !show);
}
/**
 * Atualiza a mensagem de erro exibida no formulário de acesso.
 */
function setLoginError(message = "") {
  const el = $("loginError"); if (!el) return;
  el.textContent = message; el.classList.toggle("hidden", !message);
}
/**
 * Alterna a interface de login entre professor e estudante.
 */
function setLoginRole(role) {
  const professor = role === "professor";
  $("loginRoleProfessor")?.classList.toggle("active", professor);
  $("loginRoleStudent")?.classList.toggle("active", !professor);
  $("loginRoleProfessor")?.setAttribute("aria-selected", String(professor));
  $("loginRoleStudent")?.setAttribute("aria-selected", String(!professor));
  $("loginProfessorPanel")?.classList.toggle("hidden", !professor);
  $("loginStudentPanel")?.classList.toggle("hidden", professor);
  setLoginError("");
  requestAnimationFrame(() => (professor ? $("authEmail") : $("authEmail"))?.focus());
}
/**
 * Wrapper do cliente que encaminha requisições para o módulo de comunicação com o backend.
 */
async function apiRequest(path, options = {}) {
  const gasUrl = window.APP_CONFIG?.GAS_URL || "";
  if (!gasUrl) throw new Error("Backend GAS não configurado.");
  const routeMap = {
    "/api/auth/login": "authLogin",
    "/api/auth/register": "authRegister",
    "/api/auth/logout": "authLogout",
    "/api/sala/criar": "criar",
    "/api/sala/entrar": "entrar",
    "/api/sala/salvar": "salvar",
    "/api/sala/encerrar": "encerrar",
    "/api/usuario/salas": "usuarioSalas",
    "/api/sala/participantes": "participantes",
    "/api/sinalizacao/enviar": "enviarSinal"
  };
  let action = routeMap[path];
  if (!action && path.startsWith("/api/sala/status/")) action = "status";
  if (!action) throw new Error(`Endpoint não suportado: ${path}`);
  const body = options.body ? JSON.parse(options.body) : {};
  body.action = action;
  if (action === "status") body.codigo = decodeURIComponent(path.slice("/api/sala/status/".length));
  const sessionToken = localStorage.getItem("mapa_riscos_remote_session_v1");
  if (sessionToken) body.sessionToken = sessionToken;
  const response = await fetch(gasUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Erro de comunicação com o backend (${response.status}).`);
  const data = await response.json();
  if (!data?.ok) throw new Error(data?.error || "Operação não concluída.");
  return data;
}
/**
 * Salva no armazenamento local os dados mínimos da sessão da sala.
 */
function persistRoomSession() {
  if (!state.roomCode || !state.roomToken || !state.role) return;
  sessionStorage.setItem(ROOM_SESSION_KEY, JSON.stringify({codigo:state.roomCode,papel:state.role}));
}
/**
 * Remove a sessão persistida da sala do armazenamento local.
 */
function clearRoomSession() {
  state.role = null; state.roomCode = null; state.roomToken = null;
  sessionStorage.removeItem(ROOM_SESSION_KEY);
  document.body.classList.remove("role-student", "has-room-session");
  const badge = $("roomCodeBadge"); if (badge) badge.hidden = true;
}
/**
 * Atualiza a interface conforme o papel do usuário na sala e desabilita ações não permitidas.
 */
function applySessionUI() {
  document.body.classList.toggle("role-student", state.role === "student");
  document.body.classList.toggle("has-room-session", Boolean(state.roomCode));
  const badge = $("roomCodeBadge"), codeText = $("roomCodeText");
  if (badge && codeText) { codeText.textContent = state.roomCode || "—"; badge.hidden = !state.roomCode; }
  const endBtn = $("endRoomBtn"); if (endBtn) endBtn.hidden = state.role !== "professor" || !state.roomCode;
  document.querySelectorAll("[data-professor-only]").forEach(el => { el.disabled = state.role !== "professor"; });
}
/**
 * Prepara o estado do projeto para ser enviado pela sincronização remota.
 */
function sanitizeProjectForSync() {
  return { version: 4, date: new Date().toISOString(), areas: state.areas, areaAtiva: state.areaAtiva };
}
let roomSyncTimer = null;
let roomSocket = null;
/**
 * Salva o projeto cifrado no backend e agenda o ciclo normal de sincronização.
 */
async function syncRoomProject() {
  if (state.role !== "professor" || !state.roomCode || !state.roomToken) return;
  try { await apiRequest("/api/sala/salvar", { method:"POST", body:JSON.stringify({codigo:state.roomCode, projeto:sanitizeProjectForSync()}) }); } catch (err) { console.warn("Não foi possível salvar a sala local", err); }
}
/**
 * Agenda uma nova sincronização evitando chamadas repetitivas a cada pequena alteração.
 */
function scheduleRoomSync() {
  if (state.role !== "professor" || !state.roomCode) return;
  clearTimeout(roomSyncTimer); roomSyncTimer = setTimeout(syncRoomProject, 700);
}
/**
 * Inicia o mecanismo de tempo real da sala quando a sessão está disponível.
 */
function connectRoomSocket() {
  // O modo de autenticação local não inicializa um canal remoto automaticamente.
}

/**
 * Aplica ao editor os dados retornados pelo servidor ao entrar ou retomar uma sala.
 */
async function enterRoomFromServer(sala, role) {
  state.role = role === "professor" ? "professor" : "student";
  state.roomCode = String(sala?.codigo || "").toUpperCase();
  state.roomToken = state.user?.id || sala?.token || "";
  console.log("3. Sessão da sala preparada:", { role: state.role, roomCode: state.roomCode, user: state.user });
  if (!state.roomCode) throw new Error("O servidor não retornou o código da sala.");
  if (!state.roomToken) throw new Error("Não foi possível identificar o usuário autenticado para a sala.");
  persistRoomSession(); applySessionUI();
  if (sala.projeto) {
    const data = typeof sala.projeto === "string" ? (() => { try { return JSON.parse(sala.projeto); } catch { return null; } })() : sala.projeto;
    if (data?.areas) { state.areas = normalizeModelAreas(data.areas); state.areaAtiva = state.areas.find(a => a.id === data.areaAtiva)?.id || state.areas[0]?.id; syncAreaConnections(); updateAreaUI(); }
  } else if (!state.areas.length) {
    const a = createArea(); state.areas=[a]; state.areaAtiva=a.id;
  }
  enterEditor();
  connectRoomSocket();
  if (state.role === "student") showToast("Sala carregada em modo visualização", "info");
}
/**
 * Cria uma nova sala a partir da tela de login e entra como professor.
 */
async function createRoomFromLogin() {
  if (!isAuthenticated()) { setLoginError("Faça login antes de criar uma sala."); return; }
  if (state.user.papel !== "professor") { setLoginError("Sua conta não está cadastrada como professor."); return; }
  setLoginError(""); setLoginLoading(true, "Criando sala…");
  try { const data = await apiRequest("/api/sala/criar", { method:"POST", body:JSON.stringify({}) }); if (!data?.sala?.codigo) throw new Error("Não foi possível criar a sala."); await enterRoomFromServer(data.sala, "professor"); showToast(`Sala criada. Código: ${data.sala.codigo}`, "success"); }
  catch (err) { console.error("ERRO na criação da sala:", err); setLoginError(err.message || "Não foi possível criar a sala."); }
  finally { setLoginLoading(false); }
}
/**
 * Valida o código informado e entra na sala com o papel solicitado.
 */
async function joinRoomFromLogin(code, professorAttempt=false) {
  if (!isAuthenticated()) { setLoginError("Faça login antes de entrar na sala."); return; }
  if (professorAttempt && state.user.papel !== "professor") { setLoginError("Apenas a conta de professor pode retomar uma sala como proprietária."); return; }
  const normalized = String(code || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(normalized)) { setLoginError("Digite um código de 6 caracteres."); return; }
  setLoginError(""); setLoginLoading(true, "Verificando sala…");
  try {
    const data = await apiRequest("/api/sala/entrar", { method:"POST", body:JSON.stringify({codigo:normalized}) });
    await enterRoomFromServer(data.sala, data.sala.papel);
    if (professorAttempt && data.sala.papel !== "professor") showToast("Sessão retomada como visualização. A chave do professor não está disponível neste navegador.", "info");
  } catch (err) { setLoginError(err.message === "Código não encontrado ou sala encerrada." ? "Código não encontrado" : err.message); }
  finally { setLoginLoading(false); }
}
/**
 * Exibe a tela de login e oculta as demais telas da aplicação.
 */
function showLoginScreen() {
  $("loginScreen")?.classList.remove("hidden"); $("homeScreen")?.classList.add("hidden"); $("app")?.classList.add("hidden");
  loginUiRole = "professor"; loginUiMode = "login"; setLoginRole("professor"); syncAuthFormUI(); setLoginLoading(false); setLoginError(""); applyAuthUI();
}
/**
 * Tenta restaurar uma sessão de sala existente na inicialização do aplicativo.
 */
async function bootstrapRoomSession() {
  if (!isAuthenticated()) return false;
  let session = null; try { session = JSON.parse(sessionStorage.getItem(ROOM_SESSION_KEY) || "null"); } catch {}
  if (!session?.codigo) return false;
  try {
    const data = await apiRequest(`/api/sala/status/${encodeURIComponent(session.codigo)}`);
    if (!data?.sala?.status) throw new Error("Sala indisponível");
    const join = await apiRequest("/api/sala/entrar", { method:"POST", body:JSON.stringify({codigo:session.codigo}) });
    await enterRoomFromServer(join.sala, join.sala.papel); return true;
  } catch { sessionStorage.removeItem(ROOM_SESSION_KEY); return false; }
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const snapVal = v => state.snap ? Math.round(v / 0.1) * 0.1 : v;
const num = v => Number.parseFloat(v);

// --- FUNÇÃO DE VALIDAÇÃO AVANÇADA ---
/**
 * Adapta a validação modular para o estado e a área atualmente ativos.
 */
function isObjectValid(o, objects = state.objects) { return validateObject(o, objects, state.room); }

// --- GERENCIADOR DE GUIAS DE ALINHAMENTO ---
/**
 * Calcula e atualiza guias de alinhamento para o objeto que está sendo manipulado.
 */
function updateGuides(activeObj) {
  state.guides = [];
  if (!activeObj || state.objects.length <= 1) return;

  const threshold = 0.12;
  const potentialGuides = [];
  const cx = activeObj.x + activeObj.w / 2;
  const cy = activeObj.y + activeObj.h / 2;

  if (Math.abs(cx - state.room.w / 2) < threshold) {
    potentialGuides.push({ orientation: "v", pos: state.room.w / 2, type: "center" });
  }
  if (Math.abs(cy - state.room.h / 2) < threshold) {
    potentialGuides.push({ orientation: "h", pos: state.room.h / 2, type: "center" });
  }

  for (const other of state.objects) {
    if (other.id === activeObj.id || other.hidden) continue;
    const ocx = other.x + other.w / 2;
    const ocy = other.y + other.h / 2;

    if (Math.abs(cx - ocx) < threshold) {
      potentialGuides.push({ orientation: "v", pos: ocx, type: "align" });
    }
    if (Math.abs(cy - ocy) < threshold) {
      potentialGuides.push({ orientation: "h", pos: ocy, type: "align" });
    }
  }

  state.guides = potentialGuides.slice(0, 4);
}

// --- SISTEMA DE TOASTS ---
/**
 * Exibe uma mensagem temporária de feedback visual ao usuário.
 */
function showToast(msg, type = "info") {
  const container = $("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s";
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// --- HISTÓRICO UNDO / REDO ---
/**
 * Cria uma representação serializada do estado atual para o histórico de undo/redo.
 */
function makeHistorySnapshot(){ return JSON.stringify({areas:state.areas,areaAtiva:state.areaAtiva,viewMode:state.viewMode}); }
/**
 * Adiciona um snapshot ao histórico, limita seu tamanho e agenda o autosave.
 */
function pushHistory(){ state.history.push(makeHistorySnapshot()); if(state.history.length>100) state.history.shift(); state.future.length=0; scheduleAutoSave(); }
/**
 * Restaura áreas, área ativa e modo de visualização a partir de um snapshot salvo.
 */
function restoreSnapshot(serialized){ const snap=JSON.parse(serialized); state.areas=sanitizeAreaNames(snap.areas||[]); state.areaAtiva=snap.areaAtiva||state.areas[0]?.id; state.viewMode=snap.viewMode||"area"; if(!state.areas.length){const a=createArea();state.areas=[a];state.areaAtiva=a.id;} syncAreaConnections(); state.selected=null; state.selectedObjects=[]; updateAreaUI(); }
/**
 * Desfaz a última alteração do projeto quando o usuário possui permissão de edição.
 */
function undo(){ if(!canEdit())return showToast("Ação disponível apenas para o professor","info"); if(!state.history.length)return; state.future.push(makeHistorySnapshot()); restoreSnapshot(state.history.pop()); fitRoom(); updateUI(); requestDraw(); showToast("Ação desfeita","info"); }
/**
 * Refaz uma alteração previamente desfeita quando o usuário possui permissão de edição.
 */
function redo(){ if(!canEdit())return showToast("Ação disponível apenas para o professor","info"); if(!state.future.length)return; state.history.push(makeHistorySnapshot()); restoreSnapshot(state.future.pop()); fitRoom(); updateUI(); requestDraw(); showToast("Ação refeita","info"); }

// --- PERSISTÊNCIA AUTOMÁTICA ---
let autoSaveTimer = null;
/**
 * Agenda a gravação automática do projeto depois de alterações.
 */
function scheduleAutoSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    const data = { version: 4, date: new Date().toISOString(), areas: state.areas, areaAtiva: state.areaAtiva };
    localStorage.setItem("mapa_riscos_autosave", JSON.stringify(data));
    scheduleRoomSync();
  }, 800);
}

// --- RENDERIZADOR OTIMIZADO ---
let animFrameId = null;
/**
 * Solicita um novo ciclo de renderização do Canvas via requestAnimationFrame.
 */
function requestDraw() {
  if (!animFrameId) {
    animFrameId = requestAnimationFrame(() => {
      animFrameId = null;
      draw();
    });
  }
}

/**
 * Ajusta o tamanho físico do Canvas ao tamanho disponível na interface.
 */
function resizeCanvas() {
  const r = canvas.getBoundingClientRect(), d = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(r.width * d));
  canvas.height = Math.max(1, Math.floor(r.height * d));
  ctx.setTransform(d, 0, 0, d, 0, 0);
  requestDraw();
}

/**
 * Enquadra a área ativa na viewport e recalcula o zoom.
 */
function fitRoom(){ const cw=canvas.clientWidth,ch=canvas.clientHeight; if(!cw||!ch)return; if(state.viewMode==='overview'){fitOverview();return;} const margin=80; state.cam.x=state.room.w/2; state.cam.y=state.room.h/2; state.cam.zoom=Math.max(10,Math.min((cw-margin)/state.room.w,(ch-margin)/state.room.h)); updateZoomText(); requestDraw(); }
/**
 * Calcula o enquadramento necessário para mostrar todas as áreas na visão geral.
 */
function fitOverview(){ const cw=canvas.clientWidth,ch=canvas.clientHeight; if(!cw||!ch||!state.areas.length)return; let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity; state.areas.forEach(a=>{minX=Math.min(minX,a.posicaoGlobal.x);minY=Math.min(minY,a.posicaoGlobal.y);maxX=Math.max(maxX,a.posicaoGlobal.x+a.dimensoes.w);maxY=Math.max(maxY,a.posicaoGlobal.y+a.dimensoes.h);}); const bw=Math.max(1,maxX-minX),bh=Math.max(1,maxY-minY),margin=120; state.overviewCam.x=(minX+maxX)/2;state.overviewCam.y=(minY+maxY)/2;state.overviewCam.zoom=Math.max(18,Math.min((cw-margin)/bw,(ch-margin)/bh)); updateZoomText(); requestDraw(); }

/**
 * Atualiza o percentual de zoom exibido na interface.
 */
function updateZoomText() { $("zoomText").textContent = Math.round(state.cam.zoom / 70 * 100) + "%"; }

/**
 * Converte coordenadas do mundo para coordenadas de tela na área ativa.
 */
function worldToScreen(x, y) {
  return { x: (x - state.cam.x) * state.cam.zoom + canvas.clientWidth / 2, y: (y - state.cam.y) * state.cam.zoom + canvas.clientHeight / 2 };
}
/**
 * Converte coordenadas de tela para coordenadas do mundo na área ativa.
 */
function screenToWorld(x, y) {
  return { x: (x - canvas.clientWidth / 2) / state.cam.zoom + state.cam.x, y: (y - canvas.clientHeight / 2) / state.cam.zoom + state.cam.y };
}
/**
 * Converte coordenadas globais das áreas para coordenadas de tela.
 */
function globalToScreen(x,y){return{x:(x-state.overviewCam.x)*state.overviewCam.zoom+canvas.clientWidth/2,y:(y-state.overviewCam.y)*state.overviewCam.zoom+canvas.clientHeight/2};}
/**
 * Converte coordenadas de tela para coordenadas globais do projeto.
 */
function screenToGlobal(x,y){return{x:(x-canvas.clientWidth/2)/state.overviewCam.zoom+state.overviewCam.x,y:(y-canvas.clientHeight/2)/state.overviewCam.zoom+state.overviewCam.y};}

/**
 * Normaliza um objeto garantindo propriedades e valores esperados pelo editor.
 */
function normalizeObject(o) {
  o.w = Math.max(0.1, num(o.w));
  o.h = Math.max(0.1, num(o.h));
  o.rot = ((num(o.rot) || 0) % 360 + 360) % 360;
  if (o.hidden === undefined) o.hidden = false;
  if (o.locked === undefined) o.locked = false;
  if (o.connectionAreaId === undefined) o.connectionAreaId = null;
}

/**
 * Cria e adiciona um novo objeto à área ativa, posicionando-o no local solicitado.
 */
function addObject(type, x, y) {
  if (!canEdit()) { showToast("Estudantes estão em modo de visualização", "info"); return; }
  if (!TYPES[type]) return;
  pushHistory();
  const [label, w0, h0] = TYPES[type];
  let w = w0, h = h0;
  if (type === "wall" || type === "door" || type === "window") { w = Math.min(w, state.room.w); }
  const o = { id: crypto.randomUUID(), type, x: x - w / 2, y: y - h / 2, w, h, rot: 0, locked: false, hidden: false, groupId: null, connectionAreaId: null };
  normalizeObject(o);
  state.objects.push(o);
  state.selected = o;
  state.selectedObjects = [o];
  updateUI(); requestDraw();
  showToast(`${label} adicionado ao mapa`, "success");
}

/**
 * Atualiza a seleção respeitando grupos e seleção múltipla.
 */
function selectWithGroupSupport(obj, isMultiSelectToggle = false) {
  if (!obj) {
    state.selectedObjects = [];
    state.selected = null;
    return;
  }

  let targets = [obj];
  if (obj.groupId) {
    targets = state.objects.filter(o => o.groupId === obj.groupId);
  }

  if (isMultiSelectToggle) {
    const allAlreadySelected = targets.every(t => state.selectedObjects.includes(t));
    if (allAlreadySelected) {
      state.selectedObjects = state.selectedObjects.filter(o => !targets.includes(o));
    } else {
      targets.forEach(t => {
        if (!state.selectedObjects.includes(t)) state.selectedObjects.push(t);
      });
    }
  } else {
    if (!state.selectedObjects.includes(obj)) {
      state.selectedObjects = [...targets];
    }
  }

  state.selected = state.selectedObjects.length > 0 
    ? state.selectedObjects[state.selectedObjects.length - 1] 
    : null;
}

/**
 * Agrupa os objetos selecionados em um único grupo lógico.
 */
function groupObjects() {
  if (!canEdit()) return showToast("Ação disponível apenas para o professor", "info");
  if (state.selectedObjects.length < 2) {
    showToast("Selecione pelo menos 2 objetos para agrupar", "info");
    return;
  }
  pushHistory();
  const groupId = crypto.randomUUID();
  state.selectedObjects.forEach(obj => {
    obj.groupId = groupId;
  });
  updateUI(); requestDraw();
  showToast("Objetos agrupados com sucesso", "success");
}

/**
 * Remove a associação de grupo dos objetos selecionados.
 */
function ungroupObjects() {
  if (!canEdit()) return showToast("Ação disponível apenas para o professor", "info");
  if (!state.selectedObjects.length) return;
  pushHistory();
  const groupIdsToRemove = new Set(
    state.selectedObjects.map(o => o.groupId).filter(Boolean)
  );

  if (groupIdsToRemove.size === 0) return;

  state.objects.forEach(obj => {
    if (groupIdsToRemove.has(obj.groupId)) {
      delete obj.groupId;
    }
  });

  updateUI(); requestDraw();
  showToast("Grupo desagrupado", "success");
}

/**
 * Alterna a visibilidade de um objeto.
 */
function toggleObjectHidden(o) {
  pushHistory();
  if (state.selectedObjects.includes(o) && state.selectedObjects.length > 1) {
    const targetState = !o.hidden;
    state.selectedObjects.forEach(item => item.hidden = targetState);
  } else {
    o.hidden = !o.hidden;
  }
  updateUI(); requestDraw();
}

/**
 * Alterna o bloqueio de edição de um objeto.
 */
function toggleObjectLocked(o) {
  pushHistory();
  if (state.selectedObjects.includes(o) && state.selectedObjects.length > 1) {
    const targetState = !o.locked;
    state.selectedObjects.forEach(item => item.locked = targetState);
  } else {
    o.locked = !o.locked;
  }
  updateUI(); requestDraw();
}

/**
 * Alterna a visibilidade de todos os objetos de um grupo.
 */
function toggleGroupHidden(groupObjs) {
  pushHistory();
  const nextHidden = !groupObjs.every(o => o.hidden);
  groupObjs.forEach(o => o.hidden = nextHidden);
  updateUI(); requestDraw();
}

/**
 * Alterna o bloqueio de todos os objetos de um grupo.
 */
function toggleGroupLocked(groupObjs) {
  pushHistory();
  const nextLocked = !groupObjs.every(o => o.locked);
  groupObjs.forEach(o => o.locked = nextLocked);
  updateUI(); requestDraw();
}

/**
 * Calcula as alças de manipulação de um objeto para redimensionamento/rotação.
 */
function getObjectHandles(o) {
  const p = worldToScreen(o.x + o.w / 2, o.y + o.h / 2);
  const w = o.w * state.cam.zoom, h = o.h * state.cam.zoom;
  const rot = (o.rot || 0) * Math.PI / 180;
  
  const localHandles = {
    nw: { x: -w / 2, y: -h / 2 },
    ne: { x: w / 2, y: -h / 2 },
    se: { x: w / 2, y: h / 2 },
    sw: { x: -w / 2, y: h / 2 },
    n:  { x: 0, y: -h / 2 },
    e:  { x: w / 2, y: 0 },
    s:  { x: 0, y: h / 2 },
    w:  { x: -w / 2, y: 0 },
    rot: { x: 0, y: -h / 2 - 25 }
  };

  const worldHandles = {};
  Object.keys(localHandles).forEach(k => {
    const lh = localHandles[k];
    const rx = lh.x * Math.cos(rot) - lh.y * Math.sin(rot);
    const ry = lh.x * Math.sin(rot) + lh.y * Math.cos(rot);
    worldHandles[k] = { x: p.x + rx, y: p.y + ry };
  });

  return worldHandles;
}

/**
 * Identifica se o ponto informado está sobre alguma alça de manipulação do objeto.
 */
function hitTestHandle(sx, sy, o) {
  if (!o || o.locked || o.hidden) return null;
  const handles = getObjectHandles(o);
  const radius = 10;
  for (let k in handles) {
    const h = handles[k];
    if (Math.hypot(sx - h.x, sy - h.y) <= radius) return k;
  }
  return null;
}

/**
 * Identifica qual objeto do Canvas está sob uma coordenada de tela.
 */
function hitTest(sx, sy) {
  const p = screenToWorld(sx, sy);
  for (let i = state.objects.length - 1; i >= 0; i--) {
    const o = state.objects[i];
    if (o.hidden || o.locked) continue;
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    const a = -(o.rot || 0) * Math.PI / 180;
    const dx = p.x - cx, dy = p.y - cy;
    const rx = dx * Math.cos(a) - dy * Math.sin(a);
    const ry = dx * Math.sin(a) + dy * Math.cos(a);
    if (Math.abs(rx) <= o.w / 2 && Math.abs(ry) <= o.h / 2) return o;
  }
  return null;
}

// --- DESENHO PRINCIPAL NO CANVAS ---
/**
 * Renderiza a área ativa, grade, objetos, seleção, guias e elementos auxiliares no Canvas.
 */
function draw() {
  const W = canvas.clientWidth, H = canvas.clientHeight;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#0a0f13"; ctx.fillRect(0, 0, W, H);
  if(state.viewMode==="overview"){ drawOverview(); return; }

  const tl = worldToScreen(0, 0), rw = state.room.w * state.cam.zoom, rh = state.room.h * state.cam.zoom;
  ctx.fillStyle = "#c6ccd0"; ctx.fillRect(tl.x, tl.y, rw, rh);

  if (state.grid) {
    ctx.save(); ctx.beginPath(); ctx.rect(tl.x, tl.y, rw, rh); ctx.clip();
    const step = Math.max(5, state.cam.zoom * 0.1);
    ctx.strokeStyle = "#78858b30"; ctx.lineWidth = 1;
    for (let x = tl.x; x <= tl.x + rw; x += step) { ctx.beginPath(); ctx.moveTo(x, tl.y); ctx.lineTo(x, tl.y + rh); ctx.stroke(); }
    for (let y = tl.y; y <= tl.y + rh; y += step) { ctx.beginPath(); ctx.moveTo(tl.x, y); ctx.lineTo(tl.x + rw, y); ctx.stroke(); }
    ctx.restore();
  }

  ctx.strokeStyle = "#f1f3f4"; ctx.lineWidth = Math.max(4, state.cam.zoom * 0.12); ctx.strokeRect(tl.x, tl.y, rw, rh);

  if (state.guides && state.guides.length > 0) {
    state.guides.forEach(g => {
      ctx.save();
      ctx.strokeStyle = g.type === "center" ? "#f59e0b" : "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      if (g.orientation === "v") {
        const p1 = worldToScreen(g.pos, 0);
        const p2 = worldToScreen(g.pos, state.room.h);
        ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
      } else {
        const p1 = worldToScreen(0, g.pos);
        const p2 = worldToScreen(state.room.w, g.pos);
        ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
      }
      ctx.stroke();
      ctx.restore();
    });
  }

  state.objects.forEach(drawObject);

  if (state.selectedObjects.length > 0) {
    state.selectedObjects.forEach(o => {
      if (!o.hidden) {
        drawSelection(o, state.selectedObjects.length === 1);
      }
    });
    if (state.selectedObjects.length === 1 && !state.selectedObjects[0].hidden) {
      drawDimensionTooltip(state.selectedObjects[0]);
    }
  }

  drawMarquee();
}

/**
 * Renderiza a visão geral com todas as áreas e suas conexões.
 */
function drawOverview(){
  syncAreaConnections();
  const H=canvas.clientHeight;
  state.areas.forEach(a=>{const p=globalToScreen(a.posicaoGlobal.x,a.posicaoGlobal.y),w=a.dimensoes.w*state.overviewCam.zoom,h=a.dimensoes.h*state.overviewCam.zoom,active=a.id===state.areaAtiva;ctx.fillStyle=active?"#e0f2fe":"#edf2f5";ctx.strokeStyle=active?"#38bdf8":"#64748b";ctx.lineWidth=active?3:1.5;ctx.fillRect(p.x,p.y,w,h);ctx.strokeRect(p.x,p.y,w,h);ctx.fillStyle="#0f172a";ctx.font="600 14px sans-serif";ctx.fillText(a.nome,p.x+10,p.y+21);ctx.fillStyle="#64748b";ctx.font="11px sans-serif";ctx.fillText(`${a.tipo} · ${a.dimensoes.w.toFixed(1)} × ${a.dimensoes.h.toFixed(1)} m`,p.x+10,p.y+38);});
  const drawn=new Set();
  state.areas.forEach(source=>source.objetos.filter(o=>o.type==="door"&&o.connectionAreaId).forEach(d=>{
    const target=state.areas.find(x=>x.id===d.connectionAreaId); if(!target)return;
    const key=[source.id,target.id].sort().join("|"); if(drawn.has(key))return; drawn.add(key);
    const p1=globalToScreen(source.posicaoGlobal.x+d.x+d.w/2,source.posicaoGlobal.y+d.y+d.h/2);
    const p2=globalToScreen(target.posicaoGlobal.x+target.dimensoes.w/2,target.posicaoGlobal.y+target.dimensoes.h/2);
    const ang=Math.atan2(p2.y-p1.y,p2.x-p1.x);
    ctx.save();ctx.strokeStyle="#38bdf8";ctx.lineWidth=2;ctx.setLineDash([7,5]);ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle="#38bdf8";
    for(const sign of [1,-1]){const px=sign===1?p2.x:p1.x,py=sign===1?p2.y:p1.y,a=sign===1?ang:ang+Math.PI;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px-10*Math.cos(a-.45),py-10*Math.sin(a-.45));ctx.lineTo(px-10*Math.cos(a+.45),py-10*Math.sin(a+.45));ctx.closePath();ctx.fill();}
    ctx.restore();
  }));
  ctx.fillStyle="#cbd5e1";ctx.font="600 13px sans-serif";ctx.fillText("Visão geral do projeto · Ctrl/Alt + clique para editar",18,H-20);
}

/**
 * Determina qual área global está sob o ponto clicado na visão geral.
 */
function hitTestOverview(sx,sy){const p=screenToGlobal(sx,sy);for(let i=state.areas.length-1;i>=0;i--){const a=state.areas[i];if(p.x>=a.posicaoGlobal.x&&p.x<=a.posicaoGlobal.x+a.dimensoes.w&&p.y>=a.posicaoGlobal.y&&p.y<=a.posicaoGlobal.y+a.dimensoes.h)return a;}return null;}

/**
 * Renderiza um objeto conforme seu tipo usando as funções de desenho específicas.
 */
function drawObject(o) {
  if (o.hidden) return;

  const p = worldToScreen(o.x + o.w / 2, o.y + o.h / 2);
  const w = o.w * state.cam.zoom;
  const h = o.h * state.cam.zoom;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate((o.rot || 0) * Math.PI / 180);
  ctx.translate(-w / 2, -h / 2);

  const val = isObjectValid(o, state.objects);

  switch (o.type) {
    case "wall": drawWall(w, h); break;
    case "door": drawDoor(o, w, h); break;
    case "window": drawWindow(w, h); break;
    case "bench": drawBench(w, h); break;
    case "benchL": drawBenchL(w, h); break;
    case "sink": drawSink(w, h); break;
    case "hood": drawHood(w, h); break;
    case "cabinet": drawCabinet(w, h); break;
    case "shelf": drawShelf(w, h); break;
    case "equipment": drawEquipment(w, h); break;
    case "zone": drawZone(w, h); break;
    case "chemical":
    case "biological":
    case "physical":
    case "fire":
    case "electrical":
    case "ergonomic":
    case "radiation":
    case "slip": drawRisk(o.type, w, h); break;
    case "shower": drawShower(w, h); break;
    case "eyewash": drawEyewash(w, h); break;
    case "extinguisher": drawExtinguisher(w, h); break;
    case "exit": drawExit(w, h); break;
    default: drawGeneric(w, h); break;
  }
  if (o.type === "door" && o.connectionAreaId) {
    const targetArea = state.areas.find(a => a.id === o.connectionAreaId);
    if (targetArea) {
      ctx.save(); ctx.fillStyle = "#1e3a5f"; ctx.font = "600 11px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      ctx.fillText(`→ ${targetArea.nome}`, w / 2, -6); ctx.restore();
    }
  }

  if (!val.valid) {
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = Math.max(2, Math.min(3, state.cam.zoom * 0.05));
    ctx.strokeRect(-2, -2, w + 4, h + 4);
  }

  if (o.locked) {
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(0, 0, w, h);
    ctx.setLineDash([]);
  }

  if (!val.valid) drawWarningIcon(w, h);
  ctx.restore();
}

/**
 * Desenha um retângulo com preenchimento, borda e opção de cantos arredondados.
 */
function drawRectWithBorder(w, h, fill, stroke = "#1e293b", lineWidth = 1.5, radius = 0) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  if (radius > 0) {
    const r = Math.min(radius, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.roundRect(0, 0, w, h, r);
  } else {
    ctx.rect(0, 0, w, h);
  }
  ctx.fill();
  ctx.stroke();
}

/**
 * Desenha uma parede com textura visual de alvenaria.
 */
function drawWall(w, h) {
  drawRectWithBorder(w, h, "#e2e8f0", "#64748b", 1.5);
  ctx.save();
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1;
  const step = Math.max(6, Math.min(14, h / 4));
  for (let y = step; y < h; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  ctx.restore();
}

/**
 * Calcula centro, raio, direção e ângulos usados para representar a abertura externa de uma porta.
 */
function getDoorArcData(o, w, h) {
  // A orientação é definida no espaço do objeto: portas largas são horizontais,
  // portas altas são verticais. A posição no mundo determina qual lado é externo.
  const cx = o.x + o.w / 2;
  const cy = o.y + o.h / 2;
  const roomCenterX = state.room.w / 2;
  const roomCenterY = state.room.h / 2;

  const horizontal = o.w >= o.h;
  const direction = horizontal
    ? (cy < roomCenterY ? "up" : "down")
    : (cx < roomCenterX ? "left" : "right");

  const radius = horizontal ? w : h;
  const arcs = {
    up:    { centerX: 0, centerY: h, start: 0, end: -Math.PI / 2, anticlockwise: true },
    down:  { centerX: 0, centerY: 0, start: 0, end: Math.PI / 2, anticlockwise: false },
    left:  { centerX: w, centerY: 0, start: Math.PI / 2, end: Math.PI, anticlockwise: false },
    right: { centerX: 0, centerY: 0, start: Math.PI / 2, end: 0, anticlockwise: true }
  };

  return { direction, radius, ...arcs[direction] };
}

/**
 * Calcula o ângulo central de um arco respeitando seu sentido de percurso.
 */
function getDoorArcMidAngle(startAngle, endAngle, anticlockwise = false) {
  // Interpola no sentido real do arco para colocar a seta exatamente no meio.
  const delta = anticlockwise
    ? -Math.abs(endAngle - startAngle)
    : Math.abs(endAngle - startAngle);
  return startAngle + delta / 2;
}

/**
 * Desenha a porta, o arco de abertura externa e a seta indicadora.
 */
function drawDoor(o, w, h) {
  if (w < 20) {
    ctx.fillStyle = "#1e3a5f";
    ctx.fillRect(0, 0, w, h);
    return;
  }

  drawRectWithBorder(w, h, "#1e3a5f", "#0f2740", 1.5);

  // A posição determina qual é o lado externo da sala.
  // A geometria é calculada no sistema local e a rotação do objeto é aplicada
  // pelo contexto do Canvas, mantendo o arco e a seta solidários à porta.
  // Calcula toda a geometria antes de qualquer acesso aos seus campos.
  // Isso evita interromper o desenho quando a porta é renderizada.
  const arcData = getDoorArcData(o, w, h);

  ctx.save();
  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);

  // O raio corresponde ao comprimento da folha e o centro fica na dobradiça.
  const radius = arcData.radius;
  const arrowSize = Math.max(6, Math.min(10, radius * 0.09));

  const drawArrow = (x, y, angle) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = "#64748b";
    ctx.beginPath();
    ctx.moveTo(arrowSize, 0);
    ctx.lineTo(-arrowSize * 0.8, -arrowSize * 0.65);
    ctx.lineTo(-arrowSize * 0.8, arrowSize * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  // 50–60% do raio: exatamente no ponto médio angular do arco.
  const midAngle = getDoorArcMidAngle(arcData.start, arcData.end, arcData.anticlockwise);
  const arrowRadius = radius * 0.58;
  const ax = arcData.centerX + Math.cos(midAngle) * arrowRadius;
  const ay = arcData.centerY + Math.sin(midAngle) * arrowRadius;
  drawArrow(ax, ay, midAngle);

  ctx.beginPath();
  ctx.arc(
    arcData.centerX,
    arcData.centerY,
    radius,
    arcData.start,
    arcData.end,
    arcData.anticlockwise
  );
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.restore();
}
/**
 * Desenha uma janela com moldura dupla e representação translúcida do vidro.
 */
function drawWindow(w, h) {
  drawRectWithBorder(w, h, "rgba(56,189,248,0.3)", "#38bdf8", 1.5);
  ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 1;
  ctx.strokeRect(4, 4, Math.max(0, w - 8), Math.max(0, h - 8));
  ctx.beginPath(); ctx.moveTo(w / 2, 4); ctx.lineTo(w / 2, h - 4); ctx.stroke();
}

/**
 * Desenha uma bancada retangular com corpo e superfície de trabalho.
 */
function drawBench(w, h) {
  if (w < 20) { ctx.fillStyle = "#64748b"; ctx.fillRect(0, 0, w, h); return; }
  drawRectWithBorder(w, h, "#64748b", "#475569", 1.5, 2);
  ctx.fillStyle = "#94a3b8"; ctx.fillRect(0, 0, w, Math.max(4, h * 0.2));
  ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, Math.max(5, h * 0.28)); ctx.lineTo(w, Math.max(5, h * 0.28)); ctx.stroke();
}

/**
 * Desenha uma bancada em L respeitando os dois braços da superfície.
 */
function drawBenchL(w, h) {
  if (w < 20) { ctx.fillStyle = "#64748b"; ctx.fillRect(0, 0, w, h); return; }
  const t = Math.max(6, Math.min(w, h) * 0.24);
  ctx.fillStyle = "#64748b"; ctx.strokeStyle = "#475569"; ctx.lineWidth = 1.5;
  ctx.fillRect(0, 0, w, t); ctx.strokeRect(0, 0, w, t);
  ctx.fillRect(0, 0, t, h); ctx.strokeRect(0, 0, t, h);
  ctx.fillStyle = "#94a3b8"; ctx.fillRect(0, 0, w, Math.max(4, t * 0.45)); ctx.fillRect(0, 0, Math.max(4, t * 0.45), h);
}

/**
 * Desenha uma pia com bacia interna e torneira.
 */
function drawSink(w, h) {
  if (w < 20) { ctx.fillStyle = "#94a3b8"; ctx.fillRect(0, 0, w, h); return; }
  drawRectWithBorder(w, h, "#94a3b8", "#64748b", 1.5, 3);
  ctx.fillStyle = "#cbd5e1"; ctx.strokeStyle = "#64748b"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(w * 0.15, h * 0.22, w * 0.7, h * 0.52, Math.min(5, w * 0.08)); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "#475569"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(w * 0.67, h * 0.17, Math.max(4, Math.min(w, h) * 0.09), Math.PI, Math.PI * 1.8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * 0.67, h * 0.17); ctx.lineTo(w * 0.67, h * 0.26); ctx.stroke();
}

/**
 * Desenha uma capela com indicação visual do fluxo de exaustão.
 */
function drawHood(w, h) {
  if (w < 20) { ctx.fillStyle = "#fbbf24"; ctx.fillRect(0, 0, w, h); return; }
  drawRectWithBorder(w, h, "#fbbf24", "#d97706", 1.5, 2);
  ctx.fillStyle = "#7c2d12"; ctx.fillRect(0, h * 0.72, w, h * 0.28);
  ctx.strokeStyle = "#7c2d12"; ctx.fillStyle = "#7c2d12"; ctx.lineWidth = 1.5;
  [0.25, 0.5, 0.75].forEach(x => {
    ctx.beginPath(); ctx.moveTo(w * x, h * 0.66); ctx.lineTo(w * x, h * 0.24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w * x, h * 0.24); ctx.lineTo(w * x - 4, h * 0.31); ctx.moveTo(w * x, h * 0.24); ctx.lineTo(w * x + 4, h * 0.31); ctx.stroke();
  });
}

/**
 * Desenha um armário com divisão central e puxadores.
 */
function drawCabinet(w, h) {
  if (w < 20) { ctx.fillStyle = "#8b5e3c"; ctx.fillRect(0, 0, w, h); return; }
  drawRectWithBorder(w, h, "#8b5e3c", "#3e2723", 1.5, 2);
  ctx.strokeStyle = "#3e2723"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
  ctx.fillStyle = "#3e2723"; ctx.beginPath(); ctx.arc(w * 0.43, h / 2, 2, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(w * 0.57, h / 2, 2, 0, Math.PI * 2); ctx.fill();
}

/**
 * Desenha uma estante com prateleiras e itens armazenados.
 */
function drawShelf(w, h) {
  if (w < 20) { ctx.fillStyle = "#d4a574"; ctx.fillRect(0, 0, w, h); return; }
  drawRectWithBorder(w, h, "#d4a574", "#78350f", 1.2, 2);
  const rows = 4, rowH = h / rows;
  ctx.strokeStyle = "#78350f"; ctx.lineWidth = 1.5;
  for (let i = 1; i < rows; i++) { ctx.beginPath(); ctx.moveTo(0, i * rowH); ctx.lineTo(w, i * rowH); ctx.stroke(); }
  const bookColors = ["#7c3aed", "#0ea5e9", "#16a34a", "#f59e0b"];
  for (let r = 0; r < rows; r++) {
    const y = r * rowH + 2;
    for (let b = 0; b < 3; b++) { ctx.fillStyle = bookColors[(r + b) % bookColors.length]; ctx.fillRect(4 + b * Math.max(8, w * 0.11), y, Math.max(5, w * 0.07), Math.max(5, rowH - 4)); }
  }
}

/**
 * Desenha um equipamento com painel, controles e indicadores.
 */
function drawEquipment(w, h) {
  if (w < 20) { ctx.fillStyle = "#6b7280"; ctx.fillRect(0, 0, w, h); return; }
  drawRectWithBorder(w, h, "#6b7280", "#374151", 1.5, 2);
  ctx.fillStyle = "#1f2937"; ctx.fillRect(w * 0.12, h * 0.16, w * 0.76, h * 0.36);
  [[0.28,0.74,"#22c55e"],[0.50,0.74,"#f59e0b"],[0.72,0.74,"#ef4444"]].forEach(([x,y,c]) => { ctx.fillStyle=c; ctx.beginPath(); ctx.arc(w*x,h*y,Math.max(2,Math.min(w,h)*0.05),0,Math.PI*2); ctx.fill(); });
  ctx.strokeStyle="#111827"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(w*0.18,h*0.63); ctx.lineTo(w*0.82,h*0.63); ctx.stroke();
}

/**
 * Desenha uma área de circulação com setas de fluxo tracejadas.
 */
function drawZone(w, h) {
  if (w < 20) { ctx.fillStyle = "rgba(56,189,248,0.3)"; ctx.fillRect(0, 0, w, h); return; }
  ctx.fillStyle = "rgba(56,189,248,0.15)"; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 1; ctx.setLineDash([5,4]); ctx.strokeRect(0,0,w,h); ctx.setLineDash([]);
  ctx.strokeStyle="#38bdf8"; ctx.lineWidth=1.2;
  const y=h/2; ctx.beginPath(); ctx.moveTo(w*0.15,y); ctx.lineTo(w*0.82,y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w*0.82,y); ctx.lineTo(w*0.74,y-4); ctx.moveTo(w*0.82,y); ctx.lineTo(w*0.74,y+4); ctx.stroke();
}

/**
 * Desenha um chuveiro de emergência com cabeça, cano e jatos.
 */
function drawShower(w, h) {
  if (w < 20) { ctx.fillStyle = "#0ea5e9"; ctx.fillRect(0, 0, w, h); return; }
  const r=Math.min(w,h)*0.18, cx=w/2, cy=h*0.33;
  ctx.strokeStyle="#0284c7"; ctx.lineWidth=Math.max(1.5,Math.min(w,h)*0.05);
  ctx.beginPath(); ctx.moveTo(cx, h*0.05); ctx.lineTo(cx, cy); ctx.lineTo(w*0.76, cy); ctx.stroke();
  ctx.fillStyle="#0ea5e9"; ctx.beginPath(); ctx.arc(w*0.76, cy, r, 0, Math.PI*2); ctx.fill();
  for(let a=0;a<Math.PI*2;a+=Math.PI/4){ ctx.beginPath(); ctx.moveTo(w*0.76+Math.cos(a)*r*1.4,cy+Math.sin(a)*r*1.4); ctx.lineTo(w*0.76+Math.cos(a)*r*2,cy+Math.sin(a)*r*2); ctx.stroke(); }
}

/**
 * Desenha um lava-olhos com os dois jatos e suas setas.
 */
function drawEyewash(w, h) {
  if (w < 20) { ctx.fillStyle = "#0ea5e9"; ctx.fillRect(0, 0, w, h); return; }
  ctx.strokeStyle="#0284c7"; ctx.lineWidth=Math.max(1.5,Math.min(w,h)*0.05);
  ctx.beginPath(); ctx.moveTo(w*0.2,h*0.72); ctx.lineTo(w*0.5,h*0.5); ctx.lineTo(w*0.8,h*0.72); ctx.stroke();
  [0.35,0.65].forEach(x=>{ctx.fillStyle="#0ea5e9";ctx.beginPath();ctx.arc(w*x,h*0.42,Math.max(3,Math.min(w,h)*0.1),0,Math.PI*2);ctx.fill();});
  ctx.fillStyle="#38bdf8"; ctx.strokeStyle="#38bdf8"; ctx.lineWidth=1.5;
  [0.35,0.65].forEach(x=>{ctx.beginPath();ctx.moveTo(w*x,h*0.18);ctx.lineTo(w*0.5,h*0.35);ctx.stroke();});
}

/**
 * Desenha um extintor com corpo, bico e mangueira.
 */
function drawExtinguisher(w, h) {
  if (w < 20) { ctx.fillStyle = "#ef4444"; ctx.fillRect(0, 0, w, h); return; }
  drawRectWithBorder(w*0.58, h*0.75, "#ef4444", "#b91c1c", 1.4, Math.min(4,w*0.1));
  ctx.fillStyle="#b91c1c"; ctx.fillRect(w*0.28,h*0.09,w*0.22,h*0.1);
  ctx.strokeStyle="#b91c1c"; ctx.lineWidth=Math.max(1.5,Math.min(w,h)*0.04);
  ctx.beginPath(); ctx.moveTo(w*0.48,h*0.14); ctx.quadraticCurveTo(w*0.82,h*0.02,w*0.84,h*0.28); ctx.stroke();
  ctx.fillStyle="#fff"; ctx.font=`bold ${Math.max(8,Math.min(16,h*0.2))}px sans-serif`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("F",w*0.57,h*0.47);
}

/**
 * Desenha uma saída com cor de sinalização e seta.
 */
function drawExit(w, h) {
  if (w < 20) { ctx.fillStyle = "#22c55e"; ctx.fillRect(0, 0, w, h); return; }
  drawRectWithBorder(w, h, "#22c55e", "#14532d", 1.5, 2);
  ctx.strokeStyle="#14532d"; ctx.fillStyle="#14532d"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(w*0.18,h/2); ctx.lineTo(w*0.68,h/2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w*0.68,h/2); ctx.lineTo(w*0.56,h*0.33); ctx.moveTo(w*0.68,h/2); ctx.lineTo(w*0.56,h*0.67); ctx.stroke();
  ctx.font=`bold ${Math.max(7,Math.min(14,h*0.38))}px sans-serif`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("SAÍDA",w*0.32,h/2);
}

/**
 * Desenha um objeto genérico quando não existe renderer específico.
 */
function drawGeneric(w, h) {
  drawRectWithBorder(w, h, "#475569", "#cbd5e1", 1);
}

/**
 * Desenha o indicador visual de alerta de validação.
 */
function drawWarningIcon(w, h) {
  ctx.save();
  ctx.translate(w + 4, -4);
  ctx.fillStyle = "#ef4444";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -12); ctx.lineTo(9, 5); ctx.lineTo(-9, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 9px sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("!", 0, -1);
  ctx.restore();
}

/**
 * Desenha um risco com a cor e o símbolo correspondente ao tipo.
 */
function drawRisk(type, w, h) {
  if (w < 20) { ctx.fillStyle = RISK_COLORS[type] || "#aebbc2"; ctx.fillRect(0, 0, w, h); return; }
  const img = riskImages[type];
  if (img && img.complete && img.naturalHeight !== 0) {
    ctx.drawImage(img, 0, 0, w, h);
    return;
  }
  const c = RISK_COLORS[type] || "#aebbc2";
  ctx.fillStyle = c + "33"; ctx.strokeStyle = c; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.38, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c; ctx.font = `bold ${Math.max(10, Math.min(18, Math.min(w,h)*0.22))}px sans-serif`; ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.fillText((TYPES[type]?.[0] || type).replace(/^Risco /i,'').slice(0,2).toUpperCase(), w/2, h/2);
}

/**
 * Desenha a caixa de seleção, alças e elementos auxiliares do objeto selecionado.
 */
function drawSelection(o, showHandles = true) {
  const p = worldToScreen(o.x + o.w / 2, o.y + o.h / 2);
  const w = o.w * state.cam.zoom, h = o.h * state.cam.zoom;
  const rot = (o.rot || 0) * Math.PI / 180;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(rot);

  ctx.strokeStyle = o.locked ? "#64748b" : "#d4a45b";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6);
  ctx.setLineDash([]);

  if (showHandles && !o.locked) {
    ctx.strokeStyle = "#d4a45b";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -h / 2 - 3);
    ctx.lineTo(0, -h / 2 - 22);
    ctx.stroke();
  }
  ctx.restore();

  if (showHandles && !o.locked) {
    const handles = getObjectHandles(o);
    ctx.save();
    Object.keys(handles).forEach(k => {
      const hPos = handles[k];
      ctx.beginPath();
      if (k === "rot") {
        ctx.arc(hPos.x, hPos.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = "#d4a45b";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.fill(); ctx.stroke();
      } else {
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#d4a45b";
        ctx.lineWidth = 2;
        ctx.rect(hPos.x - 4, hPos.y - 4, 8, 8);
        ctx.fill(); ctx.stroke();
      }
    });
    ctx.restore();
  }
}

/**
 * Desenha o retângulo de seleção por arraste.
 */
function drawMarquee() {
  if (!state.marquee) return;
  const m = state.marquee;
  const x = Math.min(m.screenStartX, m.screenCurrentX);
  const y = Math.min(m.screenStartY, m.screenCurrentY);
  const w = Math.abs(m.screenCurrentX - m.screenStartX);
  const h = Math.abs(m.screenCurrentY - m.screenStartY);

  ctx.save();
  ctx.fillStyle = "rgba(157, 196, 223, 0.15)";
  ctx.strokeStyle = "#9dc4df";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

/**
 * Desenha o tooltip persistente com as dimensões do objeto.
 */
function drawDimensionTooltip(o) {
  if (!state.drag && !state.ruler) return;
  const p = worldToScreen(o.x + o.w / 2, o.y);
  const text = `${o.w.toFixed(2)} × ${o.h.toFixed(2)} m (${Math.round(o.rot || 0)}°)`;

  ctx.save();
  ctx.font = "11px system-ui, -apple-system, sans-serif";
  const tw = ctx.measureText(text).width + 16;
  const th = 22;

  let ty = p.y - 35;
  if (ty < 15) {
    ty = p.y + (o.h * state.cam.zoom) + 15;
  }

  const tx = clamp(p.x - tw / 2, 10, canvas.clientWidth - tw - 10) + tw / 2;

  ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1;

  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(tx - tw / 2, ty, tw, th, 4);
  else ctx.rect(tx - tw / 2, ty, tw, th);
  ctx.fill(); ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, tx, ty + th / 2);
  ctx.restore();
}

// --- EVENTOS DE PONTEIRO E SELEÇÃO ---
canvas.addEventListener("pointerdown", e => {
  const p = { x: e.offsetX, y: e.offsetY };
  if(state.viewMode==="overview"){ if(e.button===1||state.tool==="pan"){state.pan=true;state.last=p;return;} const area=hitTestOverview(p.x,p.y); if(area){if(e.ctrlKey||e.altKey){switchArea(area.id);return;}state.areaAtiva=area.id;const g=screenToGlobal(p.x,p.y);state.overviewDrag={areaId:area.id,start:g,origin:{...area.posicaoGlobal},moved:false};updateAreaUI();requestDraw();} return; }

  if (state.tool === "pan" || e.button === 1) {
    state.pan = true; state.last = p;
    return;
  }

  if (state.selectedObjects.length === 1 && !state.selectedObjects[0].locked) {
    const singleObj = state.selectedObjects[0];
    const handle = hitTestHandle(p.x, p.y, singleObj);
    if (handle) {
      state.pendingHistory = true;
      const worldP = screenToWorld(p.x, p.y);
      state.drag = {
        type: handle === "rot" ? "rotate" : "resize",
        handle,
        o: singleObj,
        startScreenP: p,
        startP: worldP,
        origW: singleObj.w, origH: singleObj.h,
        origX: singleObj.x, origY: singleObj.y,
        origRot: singleObj.rot || 0
      };
      return;
    }
  }

  const hit = hitTest(p.x, p.y);
  const isCtrl = e.ctrlKey || e.metaKey;

  if (hit) {
    if (e.altKey) {
      pushHistory();
      const clone = { ...hit, id: crypto.randomUUID(), x: hit.x + 0.2, y: hit.y + 0.2 };
      normalizeObject(clone);
      state.objects.push(clone);
      state.selectedObjects = [clone];
      state.selected = clone;
      showToast("Objeto duplicado", "success");
      updateUI(); requestDraw();
      return;
    }

    if (isCtrl) {
      selectWithGroupSupport(hit, true);
    } else {
      if (!state.selectedObjects.includes(hit)) {
        selectWithGroupSupport(hit, false);
      }
    }

    const movableObjects = state.selectedObjects.filter(o => !o.locked);
    if (movableObjects.length > 0) {
      state.pendingHistory = true;
      const q = screenToWorld(p.x, p.y);
      state.drag = {
        type: "moveGroup",
        startScreenP: p,
        objects: movableObjects.map(o => ({
          o,
          startWorldX: o.x,
          startWorldY: o.y
        })),
        startWorldP: q
      };
    }
  } else {
    if (!isCtrl) {
      state.selectedObjects = [];
      state.selected = null;
    }
    const worldP = screenToWorld(p.x, p.y);
    state.marquee = {
      startX: worldP.x, startY: worldP.y,
      currentX: worldP.x, currentY: worldP.y,
      screenStartX: p.x, screenStartY: p.y,
      screenCurrentX: p.x, screenCurrentY: p.y
    };
  }

  updateUI(); requestDraw();
});

canvas.addEventListener("pointermove", e => {
  const p = { x: e.offsetX, y: e.offsetY };
  if(state.viewMode==="overview"&&state.overviewDrag){const a=state.areas.find(a=>a.id===state.overviewDrag.areaId);if(a){const g=screenToGlobal(p.x,p.y);if(!state.overviewDrag.moved){pushHistory();}a.posicaoGlobal.x=snapVal(state.overviewDrag.origin.x+g.x-state.overviewDrag.start.x);a.posicaoGlobal.y=snapVal(state.overviewDrag.origin.y+g.y-state.overviewDrag.start.y);state.overviewDrag.moved=true;requestDraw();}return;}

  if (state.pan) {
    state.cam.x -= (p.x - state.last.x) / state.cam.zoom;
    state.cam.y -= (p.y - state.last.y) / state.cam.zoom;
    state.last = p; requestDraw();
    return;
  }

  if (state.marquee) {
    const worldP = screenToWorld(p.x, p.y);
    state.marquee.currentX = worldP.x;
    state.marquee.currentY = worldP.y;
    state.marquee.screenCurrentX = p.x;
    state.marquee.screenCurrentY = p.y;
    requestDraw();
    return;
  }

  if (state.drag) {
    if (state.pendingHistory) {
      const dxScreen = p.x - state.drag.startScreenP.x;
      const dyScreen = p.y - state.drag.startScreenP.y;
      if (Math.hypot(dxScreen, dyScreen) > 1) {
        pushHistory();
        state.pendingHistory = false;
      }
    }

    const q = screenToWorld(p.x, p.y);

    if (state.drag.type === "moveGroup") {
      const dx = q.x - state.drag.startWorldP.x;
      const dy = q.y - state.drag.startWorldP.y;

      state.drag.objects.forEach(item => {
        item.o.x = snapVal(item.startWorldX + dx);
        item.o.y = snapVal(item.startWorldY + dy);
      });

      if (state.drag.objects.length > 0) {
        updateGuides(state.drag.objects[0].o);
      }
    } else if (state.drag.type === "rotate") {
      const o = state.drag.o;
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      const rad = Math.atan2(q.y - cy, q.x - cx);
      let deg = Math.round((rad * 180 / Math.PI + 90) % 360);
      if (deg < 0) deg += 360;
      o.rot = state.snap ? Math.round(deg / 15) * 15 : deg;
    } else if (state.drag.type === "resize") {
      const o = state.drag.o;
      const h = state.drag.handle;
      const dw = q.x - state.drag.startP.x;
      const dh = q.y - state.drag.startP.y;

      if (h.includes("e")) o.w = Math.max(0.1, snapVal(state.drag.origW + dw));
      if (h.includes("s")) o.h = Math.max(0.1, snapVal(state.drag.origH + dh));
      if (h.includes("w")) {
        const nw = Math.max(0.1, snapVal(state.drag.origW - dw));
        o.x = state.drag.origX + (state.drag.origW - nw);
        o.w = nw;
      }
      if (h.includes("n")) {
        const nh = Math.max(0.1, snapVal(state.drag.origH - dh));
        o.y = state.drag.origY + (state.drag.origH - nh);
        o.h = nh;
      }
      updateGuides(o);
    }

    updateUIInputsOnly();
    requestDraw();
  }
});

canvas.addEventListener("pointerup", e => {
  if(state.viewMode==="overview"&&state.overviewDrag){if(state.overviewDrag.moved){updateUI();scheduleAutoSave();}state.overviewDrag=null;}
  state.pan = false;
  state.guides = [];

  if (state.marquee) {
    const minX = Math.min(state.marquee.startX, state.marquee.currentX);
    const maxX = Math.max(state.marquee.startX, state.marquee.currentX);
    const minY = Math.min(state.marquee.startY, state.marquee.currentY);
    const maxY = Math.max(state.marquee.startY, state.marquee.currentY);

    const selectedInBox = state.objects.filter(o => {
      if (o.hidden || o.locked) return false;
      return !(o.x + o.w < minX || o.x > maxX || o.y + o.h < minY || o.y > maxY);
    });

    if (selectedInBox.length > 0) {
      const expanded = new Set();
      selectedInBox.forEach(obj => {
        if (obj.groupId) {
          state.objects.filter(o => o.groupId === obj.groupId && !o.hidden && !o.locked).forEach(g => expanded.add(g));
        } else {
          expanded.add(obj);
        }
      });

      if (e.ctrlKey || e.metaKey) {
        expanded.forEach(o => {
          if (!state.selectedObjects.includes(o)) state.selectedObjects.push(o);
        });
      } else {
        state.selectedObjects = Array.from(expanded);
      }
      state.selected = state.selectedObjects[state.selectedObjects.length - 1];
    } else if (!e.ctrlKey && !e.metaKey) {
      state.selectedObjects = [];
      state.selected = null;
    }

    state.marquee = null;
    updateUI();
  }

  if (state.drag) {
    state.drag = null;
    state.pendingHistory = false;
    updateUI();
    scheduleAutoSave();
  } else {
    state.pendingHistory = false;
  }
  requestDraw();
});

canvas.addEventListener("wheel", e => {
  e.preventDefault();
  const before = screenToWorld(e.offsetX, e.offsetY);
  state.cam.zoom = clamp(state.cam.zoom * (e.deltaY < 0 ? 1.1 : 0.9), 15, 220);
  const after = screenToWorld(e.offsetX, e.offsetY);
  state.cam.x += before.x - after.x;
  state.cam.y += before.y - after.y;
  updateZoomText(); requestDraw();
}, { passive: false });

/**
 * Remove caracteres de emoji de textos inseridos ou importados pelo usuário.
 */
function sanitizeNoEmoji(value, fallback="") {
  const input = String(value ?? "");
  const withoutEmoji = input
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "")
    .replace(/[\u{1F3FB}-\u{1F3FF}]/gu, "")
    .replace(/\uFE0F/gu, "")
    .replace(/\u200D/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return withoutEmoji || fallback;
}
/**
 * Escapa caracteres HTML especiais antes de inserir texto no DOM.
 */
function escapeHtml(v){return String(v).replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[ch]));}
/**
 * Sanitiza os nomes das áreas importadas ou restauradas.
 */
function sanitizeAreaNames(areas){
  if(!Array.isArray(areas)) return areas;
  areas.forEach((a,i)=>{ if(a && typeof a === "object") a.nome=sanitizeNoEmoji(a.nome || `Área ${i+1}`, `Área ${i+1}`); });
  return areas;
}
/**
 * Atualiza o nome mostrado na barra superior com base na área ativa.
 */
function updateProjectName(){
  const el=$("projectName");
  const a=activeArea();
  if(el) el.textContent=sanitizeNoEmoji(a?.nome || "Projeto", "Projeto");
}

/**
 * Troca a aba ativa do painel direito e atualiza sua visibilidade.
 */
function switchPanelTab(tab){
  const valid=["layers","properties","report"];
  const next=valid.includes(tab)?tab:"layers";
  if(next==="properties" && state.selectedObjects.length===0) state.panelTab="layers";
  else state.panelTab=next;
  document.querySelectorAll(".panel-tab").forEach(btn=>{
    const active=btn.dataset.panelTab===state.panelTab;
    btn.setAttribute("aria-selected",active?"true":"false");
  });
  document.querySelectorAll(".panel-tab-content").forEach(panel=>{ panel.hidden=panel.dataset.panelContent!==state.panelTab; });
}

/**
 * Sincroniza a aba do painel direito com a seleção e o estado atual.
 */
function syncPanelTab(){
  if(state.panelTab==="properties" && state.selectedObjects.length===0) state.panelTab="layers";
  switchPanelTab(state.panelTab);
}

/**
 * Atualiza o seletor, informações e controles relacionados às áreas do projeto.
 */
function updateAreaUI(){
  const a=activeArea(),sel=$("areaSelect");
  if(!a)return;
  updateProjectName();
  if(sel){sel.innerHTML=state.areas.map(x=>`<option value="${x.id}">${escapeHtml(sanitizeNoEmoji(x.nome, "Área"))}</option>`).join("");sel.value=state.areaAtiva;}
  if($("areaName"))$("areaName").value=a.nome;
  if($("areaType"))$("areaType").value=a.tipo||"apoio";
  if($("roomW"))$("roomW").value=a.dimensoes.w;
  if($("roomH"))$("roomH").value=a.dimensoes.h;
  if($("roomFeedback"))$("roomFeedback").textContent=`${a.nome}: ${a.dimensoes.w.toFixed(1).replace(".",",")} × ${a.dimensoes.h.toFixed(1).replace(".",",")} m`;
  if($("toggleOverview"))$("toggleOverview").textContent=state.viewMode==="overview"?"Editar área ativa":"Ver todas as áreas";
  if($("areaMeta")){
    const names=a.conexoes.map(id=>state.areas.find(x=>x.id===id)?.nome).filter(Boolean);
    $("areaMeta").textContent=`${a.objetos.length} item(ns) · ${a.conexoes.length} conexão(ões)`+(names.length?` · Conectada a: ${names.join(", ")}`:"");
  }
}
// MODAL DE CONFIRMAÇÃO CUSTOMIZADO
const confirmModal = $("confirmModal");
const confirmTitle = $("confirmTitle");
const confirmMessage = $("confirmMessage");
const closeConfirm = $("closeConfirm");
const cancelConfirm = $("cancelConfirm");
const confirmAction = $("confirmAction");
let confirmModalState = null;
let confirmReturnFocus = null;
let confirmCloseTimer = null;

/**
 * Retorna os elementos focalizáveis disponíveis em um modal.
 */
function getModalFocusableElements() {
  if (!confirmModal) return [];
  return [...confirmModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter(el => !el.disabled && el.offsetParent !== null);
}

/**
 * Finaliza o ciclo do modal de confirmação, resolve a ação e devolve o foco.
 */
function finishConfirmModal(result) {
  if (!confirmModal || !confirmModalState) return;
  const { resolve } = confirmModalState;
  confirmModalState = null;
  confirmModal.classList.add("closing");
  clearTimeout(confirmCloseTimer);
  confirmCloseTimer = setTimeout(() => {
    confirmModal.classList.add("hidden");
    confirmModal.classList.remove("closing");
    confirmReturnFocus?.focus?.();
    confirmReturnFocus = null;
  }, 120);
  resolve(result);
}

/**
 * Abre o modal de confirmação customizado e registra a ação a executar.
 */
function showConfirmModal(message, onConfirm, options = {}) {
  if (!confirmModal || !confirmMessage || !confirmAction) {
    onConfirm?.();
    return Promise.resolve(true);
  }
  if (confirmModalState) finishConfirmModal(false);
  confirmReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  confirmTitle.textContent = options.title || "Confirmar ação";
  confirmMessage.textContent = message;
  confirmAction.textContent = options.confirmLabel || "Confirmar";
  cancelConfirm.textContent = options.cancelLabel || "Cancelar";

  const promise = new Promise(resolve => {
    confirmModalState = { resolve, onConfirm, onCancel: options.onCancel };
  });

  confirmModal.classList.remove("hidden", "closing");
  requestAnimationFrame(() => cancelConfirm?.focus());
  return promise;
}

/**
 * Fecha o modal de confirmação como cancelamento do usuário.
 */
function closeConfirmModalByCancel() {
  if (!confirmModalState) return;
  const { onCancel } = confirmModalState;
  finishConfirmModal(false);
  onCancel?.();
}

closeConfirm?.addEventListener("click", closeConfirmModalByCancel);
cancelConfirm?.addEventListener("click", closeConfirmModalByCancel);
confirmAction?.addEventListener("click", () => {
  if (!confirmModalState) return;
  const { onConfirm } = confirmModalState;
  finishConfirmModal(true);
  onConfirm?.();
});
confirmModal?.addEventListener("click", e => {
  if (e.target === confirmModal) closeConfirmModalByCancel();
});

document.addEventListener("keydown", e => {
  if (!confirmModal || confirmModal.classList.contains("hidden")) return;
  if (e.key === "Escape") {
    e.preventDefault();
    closeConfirmModalByCancel();
    return;
  }
  if (e.key !== "Tab") return;
  const focusables = getModalFocusableElements();
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault(); last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault(); first.focus();
  }
});

/**
 * Solicita confirmação e remove a área ativa, reparando conexões e seleção.
 */
function deleteActiveArea(){if(!canEdit())return showToast("Ação disponível apenas para o professor","info");
  if(state.areas.length<=1){showToast("O projeto precisa manter pelo menos uma área.","error");return;}
  const area=activeArea();
  if(!area)return;
  showConfirmModal(
    `Excluir a área “${area.nome}”? Todos os objetos desta área serão removidos e conexões que apontam para ela serão desfeitas.`,
    () => {
      pushHistory();
      const deletedId=area.id;
      state.areas=state.areas.filter(a=>a.id!==deletedId);
      state.areas.forEach(a=>a.objetos.forEach(o=>{if(o.connectionAreaId===deletedId)o.connectionAreaId=null;}));
      state.areaAtiva=state.areas[0].id;
      state.viewMode="area";state.selected=null;state.selectedObjects=[];
      syncAreaConnections();updateAreaUI();fitRoom();updateUI();requestDraw();
      showToast("Área excluída com sucesso","success");
    },
    {title:"Excluir Área",confirmLabel:"Excluir",cancelLabel:"Cancelar"}
  );
}
/**
 * Troca a área ativa e atualiza câmera, UI e renderização.
 */
function switchArea(id){if(!state.areas.some(a=>a.id===id))return;state.areaAtiva=id;state.viewMode="area";state.selected=null;state.selectedObjects=[];updateAreaUI();fitRoom();updateUI();requestDraw();}
/**
 * Cria uma nova área e a torna imediatamente ativa.
 */
function createNewArea(){if(!canEdit())return showToast("Ação disponível apenas para o professor","info");pushHistory();const n=state.areas.length+1,prev=state.areas[state.areas.length-1],a=createArea(`Área ${n}`,"apoio",10,7,prev?prev.posicaoGlobal.x+prev.dimensoes.w+2:0,0);state.areas.push(a);state.areaAtiva=a.id;updateAreaUI();fitRoom();updateUI();requestDraw();showToast("Nova área criada","success");}
/**
 * Atualiza o nome da área ativa depois de sanitizar o texto.
 */
function renameActiveArea(){if(!canEdit())return showToast("Ação disponível apenas para o professor","info");const v=sanitizeNoEmoji($("areaName")?.value, "");if(!v||v===activeArea().nome)return;pushHistory();activeArea().nome=v;updateAreaUI();updateUI();requestDraw();}
/**
 * Alterna entre edição da área e visão geral do projeto.
 */
function toggleOverview(){if(state.viewMode==="overview"){state.viewMode="area";fitRoom();}else{syncAreaConnections();state.viewMode="overview";fitOverview();}updateAreaUI();updateUI();requestDraw();}
/**
 * Monta o seletor de área de destino disponível para uma porta.
 */
function buildDoorConnectionField(o){const field=$("doorConnectionField"),sel=$("doorConnection");if(!field||!sel)return;field.classList.toggle("hidden",o.type!=="door");if(o.type!=="door")return;sel.innerHTML=`<option value="">Nenhuma conexão</option>`+state.areas.filter(a=>a.id!==state.areaAtiva).map(a=>`<option value="${a.id}">${escapeHtml(a.nome)}</option>`).join("");sel.value=o.connectionAreaId||"";}

/**
 * Atualiza somente os campos de propriedades sem reconstruir toda a interface.
 */
function updateUIInputsOnly() {
  if (state.selectedObjects.length === 1) {
    const o = state.selectedObjects[0];
    $("x").value = o.x.toFixed(2);
    $("y").value = o.y.toFixed(2);
    $("w").value = o.w.toFixed(2);
    $("h").value = o.h.toFixed(2);
    $("rot").value = Math.round(o.rot || 0);
    $("rotVal").textContent = Math.round(o.rot || 0) + "°";
  }
}

// --- ATUALIZAÇÃO COMPLETA DA INTERFACE ---
/**
 * Calcula e atualiza os estados visualmente concluído/ativo/pendente do stepper.
 */
function updateStepper() {
  const activeObjects = state.objects.filter(o => !o.hidden);
  const hasStructural = activeObjects.some(o => ["wall", "door", "window"].includes(o.type));
  const hasRisk = activeObjects.some(o => RISK_TYPES.includes(o.type));
  const complianceBadge = $("compliance-badge");
  const allChecksOk = complianceBadge?.textContent.trim() === "10/10" || document.querySelectorAll(".check.ok").length === 10;

  const step1 = $("step-1");
  const step2 = $("step-2");
  const step3 = $("step-3");
  if (!step1 || !step2 || !step3) return;

  const setStepState = (el, stateName) => {
    el.classList.remove("pending", "active", "done");
    el.classList.add(stateName);
    el.removeAttribute("aria-current");
    if (stateName === "active") el.setAttribute("aria-current", "step");
  };

  setStepState(step1, hasStructural ? "done" : "active");
  setStepState(step2, !hasStructural ? "pending" : (hasRisk ? "done" : "active"));
  setStepState(step3, !hasStructural || !hasRisk ? "pending" : (allChecksOk ? "done" : "active"));

  if (!hasStructural && !hasRisk && !allChecksOk) {
    setStepState(step1, "active");
  }
}

/**
 * Atualiza os diferentes painéis e indicadores com base no estado atual do editor.
 */
function updateUI() {
  updateAreaUI();
  const contextualTB = $("contextualToolbar");
  const emptyProps = $("emptyProps");
  const propsPanel = $("props");
  const title = $("title");
  const sub = $("sub");
  const alertBox = $("validationAlert");

  const count = state.selectedObjects.length;

  if (count > 0) {
    contextualTB.classList.remove("hidden");
    const hasGroups = state.selectedObjects.some(o => o.groupId);
    if (hasGroups) {
      $("ctxUngroup").classList.remove("hidden");
    } else {
      $("ctxUngroup").classList.add("hidden");
    }
  } else {
    contextualTB.classList.add("hidden");
  }

  if (count === 0) {
    emptyProps.classList.remove("hidden");
    propsPanel.classList.add("hidden");
    title.textContent = "Nenhum elemento";
    sub.textContent = "Selecione um objeto no mapa para editar.";
    const epiField = $("epiField");
    const epiInput = $("epi");
    if (epiField && epiInput) {
      epiField.classList.add("hidden");
      epiInput.value = "";
      epiInput.disabled = true;
    }
    if (alertBox) alertBox.classList.add("hidden");
    $("doorConnectionField")?.classList.add("hidden");
    updateTree();
  } else if (count === 1) {
    emptyProps.classList.add("hidden");
    propsPanel.classList.remove("hidden");
    const o = state.selectedObjects[0];
    state.selected = o;

    title.textContent = TYPES[o.type] ? TYPES[o.type][0] : "Elemento";
    sub.textContent = o.groupId ? `Pertence ao grupo #${o.groupId.slice(0, 6)}` : "Edite as propriedades abaixo.";

    $("x").value = o.x.toFixed(2);
    $("y").value = o.y.toFixed(2);
    $("w").value = o.w.toFixed(2);
    $("h").value = o.h.toFixed(2);
    $("rot").value = Math.round(o.rot || 0);
    $("rotVal").textContent = Math.round(o.rot || 0) + "°";

    const epiField = $("epiField");
    const epiInput = $("epi");
    const isRisk = RISK_TYPES.includes(o.type);
    buildDoorConnectionField(o);
    if (epiField && epiInput) {
      epiField.classList.toggle("hidden", !isRisk);
      epiInput.value = isRisk ? (o.epi || "") : "";
      epiInput.disabled = !isRisk || o.locked;
      epiInput.placeholder = isRisk ? (DEFAULT_EPI_BY_RISK[o.type] || "Informe o EPI recomendado") : "";
    }

    const isLocked = o.locked;
    $("x").disabled = isLocked;
    $("y").disabled = isLocked;
    $("w").disabled = isLocked;
    $("h").disabled = isLocked;
    $("rot").disabled = isLocked;
    $("applyProps").disabled = isLocked;
    $("rotate").disabled = isLocked;

    const val = isObjectValid(o, state.objects);
    if (alertBox) {
      if (!val.valid) {
        alertBox.classList.remove("hidden");
        alertBox.innerHTML = `
          <div class="validation-title"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:-1px; margin-right:4px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 3-3.42 0zM12 9v4M12 17h.01"/></svg>Irregularidade Encontrada</div>
          <ul class="validation-list">
            ${val.problems.map(p => `<li>${p}</li>`).join("")}
          </ul>
        `;
      } else {
        alertBox.classList.add("hidden");
      }
    }
    updateTree();
  } else {
    emptyProps.classList.add("hidden");
    propsPanel.classList.remove("hidden");

    title.textContent = `${count} elementos selecionados`;
    sub.textContent = "Seleção Múltipla. Edite em lote ou agrupe.";

    const first = state.selectedObjects[0];
    $("x").value = state.selectedObjects.every(o => o.x === first.x) ? first.x.toFixed(2) : "";
    $("y").value = state.selectedObjects.every(o => o.y === first.y) ? first.y.toFixed(2) : "";
    $("w").value = state.selectedObjects.every(o => o.w === first.w) ? first.w.toFixed(2) : "";
    $("h").value = state.selectedObjects.every(o => o.h === first.h) ? first.h.toFixed(2) : "";
    $("rot").value = 0;
    $("rotVal").textContent = "Var.";
    const epiField = $("epiField");
    const epiInput = $("epi");
    if (epiField && epiInput) {
      epiField.classList.add("hidden");
      epiInput.value = "";
      epiInput.disabled = true;
    }
    $("doorConnectionField")?.classList.add("hidden");

    const anyLocked = state.selectedObjects.some(o => o.locked);
    $("x").disabled = anyLocked;
    $("y").disabled = anyLocked;
    $("w").disabled = anyLocked;
    $("h").disabled = anyLocked;
    $("rot").disabled = anyLocked;
    $("applyProps").disabled = anyLocked;
    $("rotate").disabled = anyLocked;

    const allProblems = [];
    state.selectedObjects.forEach(o => {
      const val = isObjectValid(o, state.objects);
      if (!val.valid) {
        allProblems.push(...val.problems);
      }
    });

    if (alertBox) {
      if (allProblems.length > 0) {
        const uniqueProbs = Array.from(new Set(allProblems));
        alertBox.classList.remove("hidden");
        alertBox.innerHTML = `
          <div class="validation-title"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:-1px; margin-right:4px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 3-3.42 0zM12 9v4M12 17h.01"/></svg>Irregularidades na Seleção</div>
          <ul class="validation-list">
            ${uniqueProbs.map(p => `<li>${p}</li>`).join("")}
          </ul>
        `;
      } else {
        alertBox.classList.add("hidden");
      }
    }
    updateTree();
  }

  updateRiskSummary();
  updateComplianceCheck();
  const layersBadge=$("layersBadge"); if(layersBadge) layersBadge.textContent=String(state.objects.length);
  const reportBadge=$("reportBadge"), complianceBadge=$("compliance-badge"); if(reportBadge) reportBadge.textContent=complianceBadge?.textContent?.trim() || "0/10";
  syncPanelTab();
  updateStepper();
  scheduleRoomSync();
}

// --- ATUALIZAÇÃO DA ÁRVORE DE CAMADAS ---
/**
 * Reconstrói a árvore de objetos e atualiza o contador de itens.
 */
function updateTree() {
  const treeContainer = $("objectsTree");
  if (!treeContainer) return;
  treeContainer.innerHTML = "";

  const totalObjectsBadge = $("totalObjectsBadge");
  if (totalObjectsBadge) totalObjectsBadge.textContent = `${state.objects.length} itens`;

  if (state.objects.length === 0) {
    treeContainer.innerHTML = `<div class="empty-tree-msg">Nenhum objeto adicionado.</div>`;
    return;
  }

  const groupsMap = new Map();
  const standalone = [];

  state.objects.forEach(o => {
    if (o.groupId) {
      if (!groupsMap.has(o.groupId)) groupsMap.set(o.groupId, []);
      groupsMap.get(o.groupId).push(o);
    } else {
      standalone.push(o);
    }
  });

  groupsMap.forEach((groupObjs, gId) => {
    const groupEl = document.createElement("div");
    groupEl.className = "tree-group-item";
    const isGroupSelected = groupObjs.every(o => state.selectedObjects.includes(o));
    const allGroupHidden = groupObjs.every(o => o.hidden);
    const allGroupLocked = groupObjs.every(o => o.locked);

    const groupHeader = document.createElement("div");
    groupHeader.className = `tree-item ${isGroupSelected ? 'active' : ''} ${allGroupHidden ? 'is-hidden' : ''} ${allGroupLocked ? 'is-locked' : ''}`;
    groupHeader.style.fontWeight = "bold";
    groupHeader.style.background = "rgba(157, 196, 223, 0.1)";
    groupHeader.tabIndex = 0;
    groupHeader.setAttribute("role", "option");
    groupHeader.setAttribute("aria-selected", isGroupSelected ? "true" : "false");

    groupHeader.innerHTML = `
      <div class="tree-item-info">
        <span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"/></svg> Grupo (#${gId.slice(0, 4)})</span>
        <span class="tree-item-coords">${groupObjs.length} itens</span>
      </div>
      <div class="tree-actions">
        <button class="tree-action-btn ${allGroupHidden ? '' : 'active'}" aria-label="${allGroupHidden ? 'Mostrar Grupo' : 'Ocultar Grupo'}" title="${allGroupHidden ? 'Mostrar Grupo' : 'Ocultar Grupo'}">
          ${allGroupHidden ? EYE_SLASH_SVG : EYE_OPEN_SVG}
        </button>
        <button class="tree-action-btn ${allGroupLocked ? 'active-lock' : ''}" aria-label="${allGroupLocked ? 'Desbloquear Grupo' : 'Bloquear Grupo'}" title="${allGroupLocked ? 'Desbloquear Grupo' : 'Bloquear Grupo'}">
          ${allGroupLocked ? LOCK_LOCKED_SVG : LOCK_UNLOCKED_SVG}
        </button>
      </div>
    `;

    const actionBtns = groupHeader.querySelectorAll(".tree-action-btn");
    actionBtns[0]?.addEventListener("click", (e) => { e.stopPropagation(); toggleGroupHidden(groupObjs); });
    actionBtns[1]?.addEventListener("click", (e) => { e.stopPropagation(); toggleGroupLocked(groupObjs); });

    groupHeader.addEventListener("click", (e) => {
      e.stopPropagation();
      if (e.ctrlKey || e.metaKey) {
        groupObjs.forEach(o => {
          if (!state.selectedObjects.includes(o)) state.selectedObjects.push(o);
        });
      } else {
        state.selectedObjects = [...groupObjs];
      }
      state.selected = state.selectedObjects[state.selectedObjects.length - 1];
      updateUI(); requestDraw();
    });

    groupHeader.addEventListener("keydown", (e) => handleTreeKeyDown(e, null, true, groupObjs));

    groupEl.appendChild(groupHeader);

    const childrenContainer = document.createElement("div");
    childrenContainer.className = "group-children";
    childrenContainer.style.paddingLeft = "10px";
    childrenContainer.style.marginTop = "4px";
    childrenContainer.style.display = "flex";
    childrenContainer.style.flexDirection = "column";
    childrenContainer.style.gap = "2px";

    groupObjs.forEach(o => {
      const item = renderTreeItem(o);
      childrenContainer.appendChild(item);
    });

    groupEl.appendChild(childrenContainer);
    treeContainer.appendChild(groupEl);
  });

  if (standalone.length > 0) {
    const list = document.createElement("div");
    list.className = "tree-category-items";
    standalone.forEach(o => {
      const item = renderTreeItem(o);
      list.appendChild(item);
    });
    treeContainer.appendChild(list);
  }
}

/**
 * Cria a representação visual de um objeto na árvore de camadas.
 */
function renderTreeItem(o) {
  const isSel = state.selectedObjects.includes(o);
  const val = isObjectValid(o, state.objects);
  const item = document.createElement("div");
  item.className = `tree-item ${isSel ? 'active' : ''} ${o.hidden ? 'is-hidden' : ''} ${o.locked ? 'is-locked' : ''} ${!val.valid ? 'has-error' : ''}`;
  item.tabIndex = 0;
  item.setAttribute("role", "option");
  item.setAttribute("aria-selected", isSel ? "true" : "false");

  const label = TYPES[o.type] ? TYPES[o.type][0] : o.type;

  item.innerHTML = `
    <div class="tree-item-info">
      <span>${!val.valid ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 3-3.42 0zM12 9v4M12 17h.01"/></svg>' : ''}${label}</span>
      <span class="tree-item-coords">(${o.x.toFixed(1)}, ${o.y.toFixed(1)})m</span>
    </div>
    <div class="tree-actions">
      <button class="tree-action-btn ${o.hidden ? '' : 'active'}" aria-label="${o.hidden ? 'Mostrar elemento ' + label : 'Ocultar elemento ' + label}" title="${o.hidden ? 'Mostrar elemento' : 'Ocultar elemento'}">
        ${o.hidden ? EYE_SLASH_SVG : EYE_OPEN_SVG}
      </button>
      <button class="tree-action-btn ${o.locked ? 'active-lock' : ''}" aria-label="${o.locked ? 'Desbloquear elemento ' + label : 'Bloquear elemento ' + label}" title="${o.locked ? 'Desbloquear elemento ' + label : 'Bloquear elemento'}">
        ${o.locked ? LOCK_LOCKED_SVG : LOCK_UNLOCKED_SVG}
      </button>
    </div>
  `;

  const btns = item.querySelectorAll(".tree-action-btn");
  btns[0]?.addEventListener("click", (e) => { e.stopPropagation(); toggleObjectHidden(o); });
  btns[1]?.addEventListener("click", (e) => { e.stopPropagation(); toggleObjectLocked(o); });

  item.addEventListener("click", (e) => {
    e.stopPropagation();
    selectWithGroupSupport(o, e.ctrlKey || e.metaKey);
    updateUI(); requestDraw();
  });

  item.addEventListener("keydown", (e) => handleTreeKeyDown(e, o, false, null));

  return item;
}

/**
 * Processa a navegação e seleção por teclado dentro da árvore de objetos.
 */
function handleTreeKeyDown(e, obj, isGroup = false, groupObjs = null) {
  const treeItems = Array.from(document.querySelectorAll("#objectsTree .tree-item"));
  const currentIndex = treeItems.indexOf(document.activeElement);

  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (currentIndex < treeItems.length - 1) {
      treeItems[currentIndex + 1].focus();
    }
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (currentIndex > 0) {
      treeItems[currentIndex - 1].focus();
    }
  } else if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    if (isGroup && groupObjs) {
      if (e.shiftKey) {
        groupObjs.forEach(o => {
          if (!state.selectedObjects.includes(o)) state.selectedObjects.push(o);
        });
      } else {
        state.selectedObjects = [...groupObjs];
      }
      state.selected = state.selectedObjects[state.selectedObjects.length - 1];
    } else if (obj) {
      selectWithGroupSupport(obj, e.shiftKey);
    }
    updateUI(); requestDraw();
  }
}

/**
 * Recalcula o resumo dos riscos existentes na área ativa.
 */
function updateRiskSummary() {
  const riskListContainer = $("riskList");
  if (!riskListContainer) return;
  riskListContainer.innerHTML = "";

  const activeObjects = state.objects.filter(o => !o.hidden);
  const counts = {};
  RISK_TYPES.forEach(type => counts[type] = 0);

  activeObjects.forEach(o => {
    if (RISK_TYPES.includes(o.type)) {
      counts[o.type] = (counts[o.type] || 0) + 1;
    }
  });

  let hasRisks = false;
  RISK_TYPES.forEach(type => {
    if (counts[type] > 0) {
      hasRisks = true;
      const row = document.createElement("div");
      row.className = "risk-row";
      const label = TYPES[type] ? TYPES[type][0] : type;
      const color = RISK_COLORS[type] || "#94a3b8";
      row.innerHTML = `
        <div><span class="risk-dot" style="background-color: ${color}"></span>${label}</div>
        <b>${counts[type]}</b>
      `;
      riskListContainer.appendChild(row);
    }
  });

  if (!hasRisks) {
    riskListContainer.innerHTML = `<div style="font-size: 10px; color: var(--muted); text-align: center; padding: 4px 0;">Nenhum risco visível.</div>`;
  }
}

/**
 * Calcula os dez critérios de conformidade para uma área específica.
 */
function calculateCompliance(area){
  if(!area)return {okCount:0,total:10,checks:{}};
  const prev=state.areaAtiva;
  state.areaAtiva=area.id;
  try{
    const activeObjects=area.objetos.filter(o=>!o.hidden);
    const hasDim=area.dimensoes.w>=3&&area.dimensoes.h>=3;
    const doorsAndExits=activeObjects.filter(o=>EXITS.includes(o.type));
    let isExitValid=doorsAndExits.length>0;
    for(const e of doorsAndExits){if(!isObjectValid(e,activeObjects)){isExitValid=false;break;}}
    const checks={
      "check-dim":hasDim,
      "check-exit":isExitValid,
      "check-safety":activeObjects.some(o=>o.type==="shower"||o.type==="eyewash"),
      "check-fire":activeObjects.some(o=>o.type==="extinguisher"||o.type==="fire"),
      "check-electrical":activeObjects.some(o=>o.type==="electrical"||o.type==="equipment"),
      "check-chemical-bio":activeObjects.some(o=>o.type==="chemical"||o.type==="biological"),
      "check-ventilation":activeObjects.some(o=>o.type==="hood"||o.type==="window"),
      "check-ergonomic":activeObjects.some(o=>["bench","benchL","sink"].includes(o.type)),
      "check-signaling":activeObjects.some(o=>["cabinet","shelf","zone"].includes(o.type))&&activeObjects.some(o=>RISK_TYPES.includes(o.type)),
      "check-epi":activeObjects.some(o=>RISK_TYPES.includes(o.type)&&typeof o.epi==="string"&&o.epi.trim().length>0)
    };
    return {okCount:Object.values(checks).filter(Boolean).length,total:10,checks};
  }finally{state.areaAtiva=prev;}
}
/**
 * Atualiza visualmente os dez checks normativos e o badge de pontuação.
 */
function updateComplianceCheck(){
  const result=calculateCompliance(activeArea());
  Object.entries(result.checks).forEach(([id,ok])=>{const el=$(id);if(el){el.classList.toggle("ok",ok);}});
  const badge=$("compliance-badge");
  if(badge){badge.textContent=`${result.okCount}/10`;badge.classList.toggle("complete",result.okCount===10);}
}

/**
 * Abre o relatório consolidado de conformidade do projeto.
 */
function openComplianceReport(){
  const modal=$("complianceReportModal"); if(!modal)return;
  const rows=state.areas.map(area=>({area,score:calculateCompliance(area)}));
  const compliant=rows.filter(r=>r.score.okCount===10).length;
  const pending=rows.length-compliant;
  $("reportSummary").innerHTML=`<div class="report-stat"><b>${rows.length}</b><span>Áreas</span></div><div class="report-stat"><b>${compliant}</b><span>Conformes (10/10)</span></div><div class="report-stat"><b>${pending}</b><span>Com pendências</span></div>`;
  $("reportList").innerHTML=rows.map(({area,score})=>`<div class="report-row"><div><strong>${escapeHtml(area.nome)}</strong><small>${escapeHtml(area.tipo||"apoio")} · ${area.conexoes.length} conexão(ões)</small></div><span class="report-score ${score.okCount===10?"ok":"pending"}">${score.okCount}/10</span></div>`).join("");
  modal.classList.remove("hidden"); $("btnCloseComplianceReport")?.focus();
}
/**
 * Fecha o modal do relatório consolidado.
 */
function closeComplianceReport(){ $("complianceReportModal")?.classList.add("hidden"); }

let stepHighlightTimer=null;
/**
 * Foca a seção correspondente a uma etapa do stepper, abrindo details quando necessário.
 */
function focusStepTarget(stepId) {
  const targets = {
    "step-1": document.getElementById("environmentSection"),
    "step-2": document.getElementById("palette"),
    "step-3": document.getElementById("complianceSection")
  };
  const target = targets[stepId];
  if (!target) return;

  // Garante que a seção/aba correspondente esteja visível antes de rolar.
  const detail = target.closest("details");
  if (detail) detail.open = true;
  if (stepId === "step-3" && typeof switchPanelTab === "function") {
    switchPanelTab("report");
  }

  const panel = target.closest(".left-panel, .right-panel");
  if (panel) panel.focus({ preventScroll: true });
  target.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
  target.classList.remove("highlight");
  void target.offsetWidth;
  target.classList.add("highlight");
  clearTimeout(stepHighlightTimer);
  stepHighlightTimer=setTimeout(()=>target.classList.remove("highlight"),1800);
  if (stepId === "step-1") {
    const roomW = $("roomW");
    if (roomW) roomW.focus({ preventScroll: true });
  }
}

document.querySelectorAll(".step").forEach(step => {
  step.addEventListener("click", () => focusStepTarget(step.id));
});
$("openComplianceReport")?.addEventListener("click", openComplianceReport);
$("btnCloseComplianceReport")?.addEventListener("click", closeComplianceReport);
$("complianceReportModal")?.addEventListener("click", e => { if(e.target.id==="complianceReportModal") closeComplianceReport(); });

// BINDINGS DE EVENTOS

document.querySelectorAll(".palette button[data-type]").forEach(b => b.addEventListener("click", () => {
  const type = b.dataset.type;
  if (!type || !TYPES[type] || !canEdit()) return;
  addObject(type, state.room.w / 2, state.room.h / 2);
  canvas?.focus();
}));

// O botão Cotas alterna a exibição persistente das dimensões do objeto selecionado.
on("ruler", "click", () => {
  state.ruler = !state.ruler;
  $("ruler")?.classList.toggle("active", state.ruler);
  $("ruler")?.setAttribute("aria-pressed", String(state.ruler));
  requestDraw();
});

on("selectMode", "click", () => {
  state.tool = "select";
  $("selectMode")?.classList.add("active");
  $("panMode")?.classList.remove("active");
});
on("panMode", "click", () => {
  state.tool = "pan";
  $("panMode")?.classList.add("active");
  $("selectMode")?.classList.remove("active");
});
on("grid", "click", () => {
  state.grid = !state.grid;
  $("grid")?.classList.toggle("active", state.grid);
  requestDraw();
});
on("snap", "click", () => {
  state.snap = !state.snap;
  $("snap")?.classList.toggle("active", state.snap);
  showToast(`Snap ${state.snap ? "ativado" : "desativado"}`, "info");
});
on("zoomIn", "click", () => {
  state.cam.zoom = clamp(state.cam.zoom * 1.15, 15, 220);
  updateZoomText();
  requestDraw();
});
on("zoomOut", "click", () => {
  state.cam.zoom = clamp(state.cam.zoom * 0.87, 15, 220);
  updateZoomText();
  requestDraw();
});
on("fitRoom", "click", fitRoom);
on("undo", "click", undo);
on("redo", "click", redo);
on("ctxGroup", "click", groupObjects);
on("ctxUngroup", "click", ungroupObjects);

const ctxLockBtn = $("ctxLock");
ctxLockBtn?.addEventListener("click", () => {
  if (!state.selectedObjects.length || !canEdit()) return;
  pushHistory();
  const targetState = !state.selectedObjects.every(o => o.locked);
  state.selectedObjects.forEach(o => { o.locked = targetState; });
  updateUI(); requestDraw();
  showToast(targetState ? "Elementos bloqueados" : "Elementos desbloqueados", "info");
});

const ctxHideBtn = $("ctxHide");
ctxHideBtn?.addEventListener("click", () => {
  if (!state.selectedObjects.length || !canEdit()) return;
  pushHistory();
  const targetState = !state.selectedObjects.every(o => o.hidden);
  state.selectedObjects.forEach(o => { o.hidden = targetState; });
  updateUI(); requestDraw();
  showToast(targetState ? "Elementos ocultados" : "Elementos visíveis", "info");
});

on("ctxDuplicate", "click", () => {
  if (!canEdit()) return showToast("Ação disponível apenas para o professor", "info");
  if (!state.selectedObjects.length) return;
  pushHistory();
  const clones = state.selectedObjects.map(o => {
    const clone = { ...o, id: crypto.randomUUID(), x: o.x + 0.2, y: o.y + 0.2 };
    normalizeObject(clone);
    state.objects.push(clone);
    return clone;
  });
  state.selectedObjects = clones;
  state.selected = clones[clones.length - 1];
  updateUI(); requestDraw();
  showToast("Elementos duplicados", "success");
});

on("ctxRotate", "click", () => {
  if (!canEdit()) return showToast("Ação disponível apenas para o professor", "info");
  if (!state.selectedObjects.length) return;
  const unblocked = state.selectedObjects.filter(o => !o.locked);
  if (!unblocked.length) return showToast("Elementos bloqueados não podem ser girados", "info");
  pushHistory();
  unblocked.forEach(o => { o.rot = (o.rot + 90) % 360; });
  updateUI(); requestDraw();
});

on("ctxDelete", "click", () => {
  if (!canEdit()) return showToast("Ação disponível apenas para o professor", "info");
  if (!state.selectedObjects.length) return;
  pushHistory();
  state.objects = state.objects.filter(o => !state.selectedObjects.includes(o));
  state.selectedObjects = [];
  state.selected = null;
  updateUI(); requestDraw();
  showToast("Elementos removidos", "info");
});

// EDIÇÃO DIRETA DE PROPRIEDADES
on("applyProps", "click", () => {
  if (!canEdit()) return showToast("Ação disponível apenas para o professor", "info");
  if (!state.selectedObjects.length) return;
  pushHistory();
  const nx = num($("x")?.value), ny = num($("y")?.value);
  const nw = num($("w")?.value), nh = num($("h")?.value);
  const nrot = num($("rot")?.value);
  const epiValue = ($("epi")?.value || "").trim();

  state.selectedObjects.forEach(o => {
    if (!o.locked) {
      if (!Number.isNaN(nx)) o.x = nx;
      if (!Number.isNaN(ny)) o.y = ny;
      if (!Number.isNaN(nw)) o.w = Math.max(0.1, nw);
      if (!Number.isNaN(nh)) o.h = Math.max(0.1, nh);
      if (!Number.isNaN(nrot)) o.rot = (nrot % 360 + 360) % 360;
      if (RISK_TYPES.includes(o.type)) o.epi = epiValue;
    }
  });

  if (state.selectedObjects.length === 1 && state.selectedObjects[0].type === "door") {
    state.selectedObjects[0].connectionAreaId = $("doorConnection")?.value || null;
    syncAreaConnections();
  }
  updateUI(); requestDraw();
  showToast("Propriedades atualizadas", "info");
});

on("rotate", "click", () => $("ctxRotate")?.click());

on("applyRoom", "click", () => {
  if (!canEdit()) return showToast("Ação disponível apenas para o professor", "info");
  const w = num($("roomW")?.value);
  const h = num($("roomH")?.value);
  if (w >= 2 && h >= 2) {
    pushHistory();
    state.room.w = w;
    state.room.h = h;
    const feedback = $("roomFeedback");
    if (feedback) feedback.textContent = `Sala atual: ${w.toFixed(1).replace(".", ",")} × ${h.toFixed(1).replace(".", ",")} m`;
    fitRoom();
    updateUI();
    showToast("Dimensões da sala atualizadas", "success");
  } else {
    showToast("Dimensões mínimas da sala: 2 x 2 metros", "error");
  }
});

on("rot", "input", e => {
  const val = e.target.value;
  const rotVal = $("rotVal");
  if (rotVal) rotVal.textContent = val + "°";
  if (state.selectedObjects.length) {
    state.selectedObjects.forEach(o => { if (!o.locked) o.rot = num(val); });
    requestDraw();
  }
});

// TELA INICIAL (HUB)
let homeLastFocus = null;
/**
 * Verifica se existe um autosave válido no armazenamento local.
 */
function hasAutosave() {
  return Boolean(localStorage.getItem("mapa_riscos_autosave"));
}

/**
 * Exibe a Home e atualiza as informações de projetos recentes.
 */
function showHomeScreen() {
  const home = $("homeScreen");
  const app = $("app");
  if (!home || !app) return;
  home.classList.remove("hidden");
  app.classList.add("hidden");
  updateHomeRecent();
  loadUserRooms().catch(() => {});
  requestAnimationFrame(() => $("homeNewProject")?.focus());
}

/**
 * Oculta a Home/login e entra no editor, ajustando câmera e interface.
 */
function enterEditor() {
  const home = $("homeScreen");
  const app = $("app");
  if (!app) return;
  home?.classList.add("hidden");
  app.classList.remove("hidden");
  resizeCanvas();
  fitRoom();
  updateUI();
  requestDraw();
}

/**
 * Cria um projeto novo e vazio com uma área Laboratório padrão.
 */
function resetToNewProject() {
  const a = createArea("Laboratório", "laboratorio", 12, 8, 0, 0);
  state.areas = [a];
  state.areaAtiva = a.id;
  state.viewMode = "area";
  state.selected = null;
  state.selectedObjects = [];
  state.history = [];
  state.future = [];
  state.pendingHistory = false;
  state.overviewCam = { x: 6, y: 4, zoom: 50 };
  state.cam = { x: 6, y: 4, zoom: 70 };
  updateAreaUI();
  enterEditor();
  showToast("Novo projeto criado", "success");
}

/**
 * Lê o autosave e restaura o projeto para o estado atual do editor.
 */
function loadAutosaveIntoState() {
  const saved = localStorage.getItem("mapa_riscos_autosave");
  if (!saved) return false;
  try {
    const data = JSON.parse(saved);
    if (data.areas) {
      state.areas = normalizeModelAreas(data.areas);
      const target = data.areaAtiva;
      state.areaAtiva = state.areas.find(a => a.id === target)?.id || state.areas[0]?.id;
    } else if (data.room && data.objects) {
      const a = createArea("Laboratório", "laboratorio", data.room.w, data.room.h, 0, 0);
      a.objetos = Array.isArray(data.objects) ? data.objects : [];
      a.objetos.forEach(normalizeObject);
      state.areas = [a];
      state.areaAtiva = a.id;
    } else return false;
    state.areas.forEach((a, i) => { a.id ||= crypto.randomUUID(); a.nome = sanitizeNoEmoji(a.nome || `Área ${i + 1}`, `Área ${i + 1}`); a.tipo ||= "apoio"; a.dimensoes ||= { w: 12, h: 8 }; a.posicaoGlobal ||= { x: i * 14, y: 0 }; a.objetos ||= []; a.objetos.forEach(normalizeObject); });
    state.areaAtiva ||= state.areas[0]?.id;
    state.selected = null;
    state.selectedObjects = [];
    state.history = [];
    state.future = [];
    syncAreaConnections();
    updateAreaUI();
    enterEditor();
    showToast("Último projeto restaurado", "success");
    return true;
  } catch (err) {
    console.error("Erro ao restaurar autosave", err);
    showToast("Não foi possível restaurar o último projeto", "error");
    return false;
  }
}

/**
 * Atualiza a apresentação dos projetos/autosave recentes na Home.
 */
function updateHomeRecent() {
  const recent = $("recentProjects");
  const list = $("recentList");
  if (!recent || !list) return;
  const saved = localStorage.getItem("mapa_riscos_autosave");
  if (!saved) {
    recent.hidden = true;
    return;
  }
  try {
    const data = JSON.parse(saved);
    const areas = Array.isArray(data.areas) ? data.areas : (data.room ? [{ nome: "Laboratório", dimensoes: data.room }] : []);
    const date = data.date ? new Date(data.date) : null;
    const dateText = date && !Number.isNaN(date.getTime()) ? date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "Autosave disponível";
    recent.hidden = false;
    list.innerHTML = `<span class="recent-chip">${areas.length} área(s)</span><span class="recent-chip">Última edição: ${escapeHtml(dateText)}</span>`;
  } catch {
    recent.hidden = true;
  }
}

/**
 * Gera uma miniatura SVG simplificada de um modelo de projeto.
 */
function buildModelPreviewSvg(model) {
  const areas = Array.isArray(model?.areas) ? model.areas : [];
  const innerW = 108, innerH = 54;
  const xs = areas.map(a => Number(a.posicaoGlobal?.x) || 0);
  const ys = areas.map(a => Number(a.posicaoGlobal?.y) || 0);
  const minX = Math.min(0, ...xs);
  const minY = Math.min(0, ...ys);
  const maxX = Math.max(1, ...areas.map(a => (Number(a.posicaoGlobal?.x) || 0) + Number(a.dimensoes?.w || 1)));
  const maxY = Math.max(1, ...areas.map(a => (Number(a.posicaoGlobal?.y) || 0) + Number(a.dimensoes?.h || 1)));
  const scale = Math.min(innerW / Math.max(1, maxX - minX), innerH / Math.max(1, maxY - minY));
  const width = (maxX - minX) * scale;
  const height = (maxY - minY) * scale;
  const ox = (120 - width) / 2 - minX * scale;
  const oy = (68 - height) / 2 - minY * scale;
  const areaRects = areas.map(area => {
    const x = (Number(area.posicaoGlobal?.x) || 0) * scale + ox;
    const y = (Number(area.posicaoGlobal?.y) || 0) * scale + oy;
    const w = Number(area.dimensoes?.w || 1) * scale;
    const h = Number(area.dimensoes?.h || 1) * scale;
    const fill = area.tipo === "almoxarifado" ? "rgba(167,139,250,.16)" : "rgba(56,189,248,.12)";
    const inner = (area.objetos || []).filter(o => ["bench","benchL","hood","shelf","cabinet"].includes(o.type)).slice(0, 6).map(o => {
      const bx = (Number(area.posicaoGlobal?.x || 0) + Number(o.x || 0)) * scale + ox;
      const by = (Number(area.posicaoGlobal?.y || 0) + Number(o.y || 0)) * scale + oy;
      const bw = Math.max(1.2, Number(o.w || 0.5) * scale);
      const bh = Math.max(1.2, Number(o.h || 0.5) * scale);
      return `<rect x="${bx.toFixed(2)}" y="${by.toFixed(2)}" width="${bw.toFixed(2)}" height="${bh.toFixed(2)}" rx="1" fill="currentColor" opacity=".22"/>`;
    }).join("");
    return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="2" fill="${fill}" stroke="currentColor" stroke-width="1.4"/>${inner}`;
  }).join("");
  const connectionLines = [];
  areas.forEach(area => {
    (area.objetos || []).filter(o => o.type === "door" && o.connectionTemplateId).forEach(o => {
      const target = areas.find(a => a.templateId === o.connectionTemplateId);
      if (!target) return;
      const x1 = (Number(area.posicaoGlobal?.x || 0) + Number(o.x || 0) + Number(o.w || 0) / 2) * scale + ox;
      const y1 = (Number(area.posicaoGlobal?.y || 0) + Number(o.y || 0) + Number(o.h || 0) / 2) * scale + oy;
      const x2 = (Number(target.posicaoGlobal?.x || 0) + Number(target.dimensoes?.w || 0) / 2) * scale + ox;
      const y2 = (Number(target.posicaoGlobal?.y || 0) + Number(target.dimensoes?.h || 0) / 2) * scale + oy;
      connectionLines.push(`<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2" opacity=".65"/>`);
    });
  });
  return `<svg viewBox="0 0 120 68" aria-hidden="true"><rect x="1" y="1" width="118" height="66" rx="6" fill="rgba(255,255,255,.015)" stroke="rgba(148,163,184,.18)"/>${connectionLines.join("")}${areaRects}</svg>`;
}

/**
 * Abre o seletor de projeto a partir da Home.
 */
function openProjectFileFromHome() {
  $("load")?.click();
}

/**
 * Abre o modal de seleção de modelos a partir da Home.
 */
function openModelPickerFromHome() {
  homeLastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  openModelsModal();
}

/**
 * Abre o fluxo de importação de modelo JSON na Home.
 */
function importModelFromHome() {
  homeLastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  openModelsModal();
  requestAnimationFrame(() => importModelFile());
}

// MODAL DE MODELOS
const modelsModal = $("modelsModal");
const modelsGrid = $("modelsGrid");
const closeModels = $("closeModels");
const importModelBtn = $("importModel");
const modelFileInput = $("modelFileInput");
let modelsReturnFocus = null;

/**
 * Obtém os elementos focalizáveis do modal de modelos.
 */
function getModelFocusableElements() {
  if (!modelsModal) return [];
  return [...modelsModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter(el => !el.disabled && el.offsetParent !== null);
}
/**
 * Fecha o modal de seleção de modelos e restaura o foco anterior.
 */
function closeModelsModal() {
  if (!modelsModal) return;
  modelsModal.classList.add("hidden");
  modelsReturnFocus?.focus?.();
  modelsReturnFocus = null;
}
/**
 * Renderiza os cartões de modelos disponíveis no modal.
 */
function renderModelCards() {
  if (!modelsGrid) return;
  modelsGrid.innerHTML = MODELOS.map(model => `
    <button type="button" class="model-card" data-model-id="${model.id}" aria-label="Aplicar modelo ${escapeHtml(model.nome)}">
      <span class="model-thumb" aria-hidden="true">
        <svg viewBox="0 0 64 48"><rect x="7" y="6" width="50" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14 15h18v7H14zM38 12h12v24H38zM14 29h18v7H14z" fill="currentColor" opacity=".22"/><path d="M14 15h18M14 29h18M38 12v24" stroke="currentColor" stroke-width="1.5"/><path d="M28 42h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </span>
      <strong>${escapeHtml(model.nome)}</strong>
      <small>${escapeHtml(model.descricao)}</small>
      <span class="model-card-action">Usar modelo</span>
    </button>
  `).join("");
  modelsGrid.querySelectorAll("[data-model-id]").forEach(card => {
    card.addEventListener("click", () => {
      const model = MODELOS.find(m => m.id === card.dataset.modelId);
      if (!model) return;
      showConfirmModal(
        `Aplicar o modelo “${model.nome}”? O projeto atual será substituído pelo layout do modelo.`,
        () => {
          try { applyModel(model); closeModelsModal(); }
          catch (err) { console.error(err); showToast("Não foi possível aplicar o modelo", "error"); }
        },
        {title:"Aplicar Modelo", confirmLabel:"Aplicar", cancelLabel:"Cancelar"}
      );
    });
  });
}
/**
 * Abre o modal de modelos e atualiza seus cartões.
 */
function openModelsModal() {
  if (!modelsModal) return;
  modelsReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  renderModelCards();
  modelsModal.classList.remove("hidden");
  requestAnimationFrame(() => getModelFocusableElements()[0]?.focus());
}
/**
 * Lê um arquivo JSON de modelo e entrega os dados ao fluxo de aplicação.
 */
function importModelFile() {
  modelFileInput?.click();
}
modelsReturnFocus = null;
$("openModels")?.addEventListener("click", openModelsModal);
closeModels?.addEventListener("click", closeModelsModal);
$("closeModelsFooter")?.addEventListener("click", closeModelsModal);
modelsModal?.addEventListener("click", e => { if (e.target === modelsModal) closeModelsModal(); });
importModelBtn?.addEventListener("click", importModelFile);
modelFileInput?.addEventListener("change", e => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      let areas = Array.isArray(data.areas) ? data.areas : null;
      if (!areas && data.room && data.objects) {
        areas = [{nome:"Laboratório", tipo:"laboratorio", dimensoes:data.room, posicaoGlobal:{x:0,y:0}, objetos:data.objects}];
      }
      if (!Array.isArray(areas) || !areas.length) throw new Error("Formato inválido");
      const model = { nome: file.name.replace(/\.json$/i, "") || "Modelo importado", areas };
      showConfirmModal(
        `Importar “${file.name}”? O projeto atual será substituído pelo conteúdo do arquivo.`,
        () => {
          try { applyModel(model); closeModelsModal(); }
          catch (err) { console.error(err); showToast("Não foi possível importar o modelo", "error"); }
        },
        {title:"Importar Modelo", confirmLabel:"Importar", cancelLabel:"Cancelar"}
      );
    } catch (err) {
      console.error(err);
      showToast("Arquivo JSON de modelo inválido", "error");
    }
  };
  reader.readAsText(file);
});

document.addEventListener("keydown", e => {
  if (!modelsModal || modelsModal.classList.contains("hidden") || ($("confirmModal") && !$("confirmModal").classList.contains("hidden"))) return;
  if (e.key === "Escape") { e.preventDefault(); closeModelsModal(); return; }
  if (e.key !== "Tab") return;
  const focusables = getModelFocusableElements(); if (!focusables.length) return;
  const first = focusables[0], last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

// PERSISTÊNCIA JSON / EXPORTAÇÃO SVG
on("save", "click", () => {
  if (!canEdit()) return showToast("Estudantes não podem salvar alterações", "info");
  const data = JSON.stringify({ version: 4, date: new Date().toISOString(), areas: state.areas, areaAtiva: state.areaAtiva }, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `mapa_riscos_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  scheduleRoomSync();
  showToast("Arquivo JSON salvo com sucesso", "success");
});

on("load", "click", () => {
  if (!canEdit()) return showToast("Estudantes não podem carregar projetos", "info");
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        pushHistory();
        if(data.areas){ state.areas=sanitizeAreaNames(data.areas.map((a,i)=>({id:a.id||crypto.randomUUID(),nome:a.nome||`Área ${i+1}`,tipo:a.tipo||"apoio",dimensoes:a.dimensoes||{w:a.room?.w||12,h:a.room?.h||8},posicaoGlobal:a.posicaoGlobal||{x:i*14,y:0},objetos:a.objetos||a.objects||[],conexoes:a.conexoes||[]}))); state.areaAtiva=data.areaAtiva||state.areas[0]?.id; }
        else if(data.room&&data.objects){ const a=createArea("Laboratório","laboratorio",data.room.w,data.room.h,0,0);a.objetos=data.objects;state.areas=[a];state.areaAtiva=a.id; }
        syncAreaConnections(); updateAreaUI(); enterEditor(); showToast("Mapa carregado com sucesso","success");
      } catch (err) {
        showToast("Erro ao carregar o arquivo JSON", "error");
      }
    };
    reader.readAsText(file);
  });
  input.click();
});

/**
 * Escapa texto para uso seguro dentro de atributos e nós SVG.
 */
function svgEscape(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Retorna o template SVG de um tipo de risco.
 */
function svgRisk(type, w, h) {
  const c = RISK_COLORS[type] || "#aebbc2";
  const label = svgEscape((TYPES[type]?.[0] || type).replace(/^Risco /i, "").slice(0, 2).toUpperCase());
  const r = Math.min(w, h) * 0.38;
  return `<circle cx="${w/2}" cy="${h/2}" r="${r}" fill="${c}33" stroke="${c}" stroke-width="2"/><text x="${w/2}" y="${h/2+4}" font-family="sans-serif" font-size="${Math.max(10, Math.min(22, r*0.7))}" font-weight="700" fill="${c}" text-anchor="middle">${label}</text>`;
}

/**
 * Gera o desenho SVG da porta com arco e seta coerentes com o Canvas.
 */
function svgDoor(o, w, h) {
  const base = `<rect x="0" y="0" width="${w}" height="${h}" fill="#1e3a5f" stroke="#0f2740" stroke-width="2"/>`;
  const arcData = getDoorArcData(o, w, h);
  const radius = arcData.radius;
  const aw = Math.max(6, Math.min(10, radius * 0.09));
  const midAngle = getDoorArcMidAngle(arcData.start, arcData.end, arcData.anticlockwise);
  const arrowRadius = radius * 0.58;
  const x = arcData.centerX + Math.cos(midAngle) * arrowRadius;
  const y = arcData.centerY + Math.sin(midAngle) * arrowRadius;

  const arrowTipX = x + Math.cos(midAngle) * aw;
  const arrowTipY = y + Math.sin(midAngle) * aw;
  const backAngle = midAngle + Math.PI;
  const leftX = x + Math.cos(backAngle - 0.65) * aw * 0.8;
  const leftY = y + Math.sin(backAngle - 0.65) * aw * 0.8;
  const rightX = x + Math.cos(backAngle + 0.65) * aw * 0.8;
  const rightY = y + Math.sin(backAngle + 0.65) * aw * 0.8;
  const arrow = `<path d="M ${arrowTipX} ${arrowTipY} L ${leftX} ${leftY} L ${rightX} ${rightY} Z" fill="#64748b"/>`;

  const x1 = arcData.centerX + Math.cos(arcData.start) * radius;
  const y1 = arcData.centerY + Math.sin(arcData.start) * radius;
  const x2 = arcData.centerX + Math.cos(arcData.end) * radius;
  const y2 = arcData.centerY + Math.sin(arcData.end) * radius;
  const sweep = arcData.anticlockwise ? 0 : 1;
  const path = `<path d="M ${x1} ${y1} A ${radius} ${radius} 0 0 ${sweep} ${x2} ${y2}" fill="none" stroke="#64748b" stroke-width="1.5" stroke-dasharray="5 4"/>`;

  return base + path + arrow;
}
/**
 * Seleciona o template SVG adequado para o tipo de objeto.
 */
function svgTemplateForType(type, w, h) {
  const stroke = (fill, border="#1e293b") => `<rect x="0" y="0" width="${w}" height="${h}" fill="${fill}" stroke="${border}" stroke-width="2"/>`;
  switch (type) {
    case "wall": {
      let x = stroke("#e2e8f0", "#64748b");
      const step = Math.max(6, h/4);
      for (let y=step; y<h; y+=step) x += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="#94a3b8" stroke-width="1"/>`;
      return x;
    }
    case "door": return svgDoor({x:0,y:0,w,h,rot:0}, w, h);
    case "window": return stroke("rgba(56,189,248,0.3)", "#38bdf8") + `<rect x="4" y="4" width="${Math.max(0,w-8)}" height="${Math.max(0,h-8)}" fill="none" stroke="#38bdf8"/><line x1="${w/2}" y1="4" x2="${w/2}" y2="${h-4}" stroke="#38bdf8"/>`;
    case "bench": return stroke("#64748b", "#475569") + `<rect x="0" y="0" width="${w}" height="${Math.max(4,h*.2)}" fill="#94a3b8"/><line x1="0" y1="${Math.max(5,h*.28)}" x2="${w}" y2="${Math.max(5,h*.28)}" stroke="#cbd5e1"/>`;
    case "benchL": { const t=Math.max(6,Math.min(w,h)*.24); return `<rect x="0" y="0" width="${w}" height="${t}" fill="#64748b" stroke="#475569"/><rect x="0" y="0" width="${t}" height="${h}" fill="#64748b" stroke="#475569"/><rect x="0" y="0" width="${w}" height="${Math.max(4,t*.45)}" fill="#94a3b8"/><rect x="0" y="0" width="${Math.max(4,t*.45)}" height="${h}" fill="#94a3b8"/>`; }
    case "sink": return stroke("#94a3b8", "#64748b") + `<rect x="${w*.15}" y="${h*.22}" width="${w*.7}" height="${h*.52}" rx="4" fill="#cbd5e1" stroke="#64748b"/><path d="M${w*.67} ${h*.17} a5 5 0 0 1 5 0 v${h*.09}" fill="none" stroke="#475569" stroke-width="2"/>`;
    case "hood": return stroke("#fbbf24", "#d97706") + `<rect y="${h*.72}" width="${w}" height="${h*.28}" fill="#7c2d12"/>${[.25,.5,.75].map(x=>`<path d="M${w*x} ${h*.66} V${h*.24} m0 0 l-4 7 m4-7 l4 7" fill="none" stroke="#7c2d12" stroke-width="2"/>`).join('')}`;
    case "cabinet": return stroke("#8b5e3c", "#3e2723") + `<line x1="${w/2}" y1="0" x2="${w/2}" y2="${h}" stroke="#3e2723" stroke-width="2"/><circle cx="${w*.43}" cy="${h/2}" r="2" fill="#3e2723"/><circle cx="${w*.57}" cy="${h/2}" r="2" fill="#3e2723"/>`;
    case "shelf": { const rows=4, rh=h/rows; let z=stroke("#d4a574", "#78350f"); for(let i=1;i<rows;i++) z+=`<line x1="0" y1="${i*rh}" x2="${w}" y2="${i*rh}" stroke="#78350f" stroke-width="2"/>`; const cs=['#7c3aed','#0ea5e9','#16a34a','#f59e0b']; for(let r=0;r<rows;r++) for(let b=0;b<3;b++) z+=`<rect x="${4+b*Math.max(8,w*.11)}" y="${r*rh+2}" width="${Math.max(5,w*.07)}" height="${Math.max(5,rh-4)}" fill="${cs[(r+b)%cs.length]}"/>`; return z; }
    case "equipment": return stroke("#6b7280", "#374151") + `<rect x="${w*.12}" y="${h*.16}" width="${w*.76}" height="${h*.36}" fill="#1f2937"/>${[[.28,'#22c55e'],[.5,'#f59e0b'],[.72,'#ef4444']].map(([x,c])=>`<circle cx="${w*x}" cy="${h*.74}" r="${Math.max(2,Math.min(w,h)*.05)}" fill="${c}"/>`).join('')}<line x1="${w*.18}" y1="${h*.63}" x2="${w*.82}" y2="${h*.63}" stroke="#111827" stroke-width="2"/>`;
    case "zone": return `<rect x="0" y="0" width="${w}" height="${h}" fill="rgba(56,189,248,0.15)" stroke="#38bdf8" stroke-width="1" stroke-dasharray="5 4"/><path d="M${w*.15} ${h/2} H${w*.82} l-8 -4 m8 4 l-8 4" fill="none" stroke="#38bdf8"/>`;
    case "shower": return `<path d="M${w/2} ${h*.05} V${h*.33} H${w*.76}" fill="none" stroke="#0284c7" stroke-width="2"/><circle cx="${w*.76}" cy="${h*.33}" r="${Math.min(w,h)*.18}" fill="#0ea5e9"/>`;
    case "eyewash": return `<path d="M${w*.2} ${h*.72} L${w*.5} ${h*.5} L${w*.8} ${h*.72}" fill="none" stroke="#0284c7" stroke-width="2"/><circle cx="${w*.35}" cy="${h*.42}" r="${Math.max(3,Math.min(w,h)*.1)}" fill="#0ea5e9"/><circle cx="${w*.65}" cy="${h*.42}" r="${Math.max(3,Math.min(w,h)*.1)}" fill="#0ea5e9"/><path d="M${w*.35} ${h*.18} L${w*.5} ${h*.35} M${w*.65} ${h*.18} L${w*.5} ${h*.35}" stroke="#38bdf8" stroke-width="2"/>`;
    case "extinguisher": return `<rect x="${w*.21}" y="${h*.18}" width="${w*.58}" height="${h*.65}" rx="4" fill="#ef4444" stroke="#b91c1c" stroke-width="2"/><rect x="${w*.28}" y="${h*.09}" width="${w*.22}" height="${h*.1}" fill="#b91c1c"/><path d="M${w*.48} ${h*.14} Q${w*.82} ${h*.02} ${w*.84} ${h*.28}" fill="none" stroke="#b91c1c" stroke-width="2"/><text x="${w*.5}" y="${h*.52}" font-family="sans-serif" font-size="${Math.max(8,h*.2)}" font-weight="700" fill="#fff" text-anchor="middle">F</text>`;
    case "exit": return stroke("#22c55e", "#14532d") + `<path d="M${w*.18} ${h/2} H${w*.68} m0 0 l-12 -8 m12 8 l-12 8" fill="none" stroke="#14532d" stroke-width="2"/><text x="${w*.32}" y="${h/2+4}" font-family="sans-serif" font-size="${Math.max(7,h*.38)}" font-weight="700" fill="#14532d" text-anchor="middle">SAÍDA</text>`;
    case "chemical": case "biological": case "physical": case "fire": case "electrical": case "ergonomic": case "radiation": case "slip": return svgRisk(type,w,h);
    default: return stroke("#475569", "#cbd5e1");
  }
}

/**
 * Executa a validação de um objeto em uma área diferente da área ativa.
 */
function isObjectValidInArea(o, area){ const prev=state.areaAtiva; state.areaAtiva=area.id; const result=isObjectValid(o, area.objetos); state.areaAtiva=prev; return result; }

/**
 * Exporta a área ativa ou todas as áreas para um arquivo SVG.
 */
function exportSvgFile(exportAll) {
  syncAreaConnections();
  const areas = exportAll ? state.areas : [activeArea()];
  let minX=0,minY=0,maxX=0,maxY=0;
  if(exportAll){ minX=Math.min(...areas.map(a=>a.posicaoGlobal.x)); minY=Math.min(...areas.map(a=>a.posicaoGlobal.y)); maxX=Math.max(...areas.map(a=>a.posicaoGlobal.x+a.dimensoes.w)); maxY=Math.max(...areas.map(a=>a.posicaoGlobal.y+a.dimensoes.h)); } else { maxX=areas[0].dimensoes.w; maxY=areas[0].dimensoes.h; }
  const scale=100, pad=exportAll?80:0, rw=(maxX-minX)*scale+pad*2, rh=(maxY-minY)*scale+pad*2;
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${rw} ${rh}" width="${rw}" height="${rh}">`;
  svg+=`<rect width="100%" height="100%" fill="#ffffff"/>`;
  areas.forEach(area=>{
    const ox=(exportAll?area.posicaoGlobal.x-minX:0)*scale+pad, oy=(exportAll?area.posicaoGlobal.y-minY:0)*scale+pad, aw=area.dimensoes.w*scale, ah=area.dimensoes.h*scale;
    svg+=`<g transform="translate(${ox} ${oy})"><rect width="${aw}" height="${ah}" fill="#c6ccd0" stroke="#334155" stroke-width="3"/>`;
    svg+=`<text x="10" y="22" font-family="sans-serif" font-size="14" font-weight="700" fill="#0f172a">${svgEscape(area.nome)}</text>`;
    area.objetos.forEach(o=>{ if(o.hidden)return; const x=o.x*scale,y=o.y*scale,w=o.w*scale,h=o.h*scale,rot=o.rot||0; const body=o.type==="door"?svgDoor(o,w,h):svgTemplateForType(o.type,w,h); const val=isObjectValidInArea(o,area); svg+=`<g transform="translate(${x} ${y}) rotate(${rot} ${w/2} ${h/2})">${body}`; if(!val.valid)svg+=`<rect x="-2" y="-2" width="${w+4}" height="${h+4}" fill="none" stroke="#ef4444" stroke-width="3"/>`; svg+=`</g>`; });
    svg+=`</g>`;
  });
  if(exportAll){ areas.forEach(area=>area.objetos.filter(o=>o.type==="door"&&o.connectionAreaId).forEach(o=>{const target=areas.find(a=>a.id===o.connectionAreaId);if(!target)return;const x1=(area.posicaoGlobal.x+o.x+o.w/2-minX)*scale+pad,y1=(area.posicaoGlobal.y+o.y+o.h/2-minY)*scale+pad,x2=(target.posicaoGlobal.x+target.dimensoes.w/2-minX)*scale+pad,y2=(target.posicaoGlobal.y+target.dimensoes.h/2-minY)*scale+pad;svg+=`<path d="M${x1} ${y1} L${x2} ${y2}" stroke="#38bdf8" stroke-width="3" stroke-dasharray="10 7" fill="none" marker-end="url(#arrow)"/>`; })); }
  svg=svg.replace('>','><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#38bdf8"/></marker></defs>');
  svg+='</svg>';
  const blob=new Blob([svg],{type:"image/svg+xml"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`mapa_riscos_${exportAll?"projeto":"area"}_${new Date().toISOString().slice(0,10)}.svg`; a.click();
  showToast(exportAll?"Projeto exportado em SVG":"Área ativa exportada em SVG","success");
}

on("exportSvg", "click", () => {
  if (state.areas.length <= 1) {
    exportSvgFile(false);
    return;
  }
  showConfirmModal(
    "Exportar todas as áreas em uma única imagem?",
    () => exportSvgFile(true),
    {title:"Exportar SVG",confirmLabel:"Todas as áreas",cancelLabel:"Somente área ativa",onCancel:()=>exportSvgFile(false)}
  );
});

// NAVEGAÇÃO DA INTERFACE
$("homeBtn")?.addEventListener("click", () => showHomeScreen());
document.querySelectorAll(".panel-tab").forEach(btn=>btn.addEventListener("click",()=>switchPanelTab(btn.dataset.panelTab)));

// GERENCIAMENTO DE ÁREAS
$("areaSelect")?.addEventListener("change", e => switchArea(e.target.value));
$("newArea")?.addEventListener("click", createNewArea);
$("deleteArea")?.addEventListener("click", deleteActiveArea);
$("renameArea")?.addEventListener("click", renameActiveArea);
$("areaName")?.addEventListener("keydown", e => { if(e.key === "Enter"){ e.preventDefault(); renameActiveArea(); } });
$("areaType")?.addEventListener("change", e => { pushHistory(); activeArea().tipo=e.target.value; updateAreaUI(); updateUI(); requestDraw(); });
$("toggleOverview")?.addEventListener("click", toggleOverview);
$("doorConnection")?.addEventListener("change", e => { if(state.selectedObjects.length===1 && state.selectedObjects[0].type==="door"){ pushHistory(); state.selectedObjects[0].connectionAreaId=e.target.value||null; syncAreaConnections(); updateAreaUI(); updateUI(); requestDraw(); } });

// MODAL DE ATALHOS DE TECLADO
const shortcutsModal = $("shortcutsModal");
const btnShortcuts = $("btnShortcuts");
const btnCloseShortcuts = $("btnCloseShortcuts");

if (btnShortcuts && shortcutsModal) {
  btnShortcuts.addEventListener("click", () => {
    shortcutsModal.classList.remove("hidden");
    btnCloseShortcuts?.focus();
  });
}

if (btnCloseShortcuts && shortcutsModal) {
  btnCloseShortcuts.addEventListener("click", () => { shortcutsModal.classList.add("hidden"); });
}

if (shortcutsModal) {
  shortcutsModal.addEventListener("click", (e) => {
    if (e.target === shortcutsModal) {
      shortcutsModal.classList.add("hidden");
    }
  });
}

// CONTROLES E ATALHOS DE TECLADO
window.addEventListener("keydown", e => {
  const active = document.activeElement;
  const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName);
  const isCtrl = e.ctrlKey || e.metaKey;

  if (isCtrl && e.key.toLowerCase() === "l") {
    e.preventDefault();
    switchPanelTab("layers");
    const tree = $("objectsTree");
    const firstItem = tree.querySelector(".tree-item");
    if (firstItem) firstItem.focus();
    else tree.focus();
    showToast("Foco na lista de camadas", "info");
    return;
  }

  if (isCtrl && e.key.toLowerCase() === "p") {
    e.preventDefault();
    switchPanelTab("properties");
    if (state.selectedObjects.length === 0 && state.objects.length > 0) {
      selectWithGroupSupport(state.objects[0], false);
      updateUI(); requestDraw();
    }
    const xInput = $("x");
    if (xInput && !xInput.disabled) {
      xInput.focus();
      xInput.select();
    } else {
      $("props")?.focus();
    }
    showToast("Foco nas propriedades", "info");
    return;
  }

  if (e.key === "f" || e.key === "F") {
    if (!isInput) { e.preventDefault(); fitRoom(); return; }
  }

  if (isInput) return;
  if (!canEdit() && !isCtrl && !["Escape","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) return;

  if (!canEdit() && ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Delete","Backspace","r","R","+","=","-","_"].includes(e.key)) { e.preventDefault(); return; }

  if (isCtrl && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
  else if (isCtrl && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
  else if (isCtrl && e.key.toLowerCase() === "d") { e.preventDefault(); $("ctxDuplicate").click(); }
  else if (e.key.toLowerCase() === "g" && !e.shiftKey) { e.preventDefault(); groupObjects(); }
  else if (e.key.toLowerCase() === "g" && e.shiftKey) { e.preventDefault(); ungroupObjects(); }
  else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); $("ctxDelete").click(); }
  else if (e.key === "Escape") {
    e.preventDefault();
    if (shortcutsModal && !shortcutsModal.classList.contains("hidden")) {
      shortcutsModal.classList.add("hidden");
    } else {
      state.selectedObjects = []; state.selected = null; updateUI(); requestDraw();
    }
  }

  if (state.selectedObjects.length > 0) {
    const step = e.shiftKey ? 0.5 : 0.1;
    const unblocked = state.selectedObjects.filter(o => !o.locked);

    if (e.key === "ArrowUp") {
      e.preventDefault();
      pushHistory();
      unblocked.forEach(o => o.y = snapVal(o.y - step));
      updateUI(); requestDraw();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      pushHistory();
      unblocked.forEach(o => o.y = snapVal(o.y + step));
      updateUI(); requestDraw();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      pushHistory();
      unblocked.forEach(o => o.x = snapVal(o.x - step));
      updateUI(); requestDraw();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      pushHistory();
      unblocked.forEach(o => o.x = snapVal(o.x + step));
      updateUI(); requestDraw();
    } else if (e.key.toLowerCase() === "r") {
      e.preventDefault();
      pushHistory();
      const rotStep = e.shiftKey ? 90 : 15;
      unblocked.forEach(o => o.rot = (o.rot + rotStep) % 360);
      updateUI(); requestDraw();
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      pushHistory();
      unblocked.forEach(o => { o.w = snapVal(o.w + 0.1); o.h = snapVal(o.h + 0.1); });
      updateUI(); requestDraw();
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      pushHistory();
      unblocked.forEach(o => { o.w = Math.max(0.1, snapVal(o.w - 0.1)); o.h = Math.max(0.1, snapVal(o.h - 0.1)); });
      updateUI(); requestDraw();
    }
  }
});

/** Restaura a sessão local salva no navegador. */
async function bootstrapLocalSession() {
  const user = AuthAPI.getCurrentUser();
  const token = localStorage.getItem("mapa_riscos_remote_session_v1");
  if (!user || !token) return false;
  state.user = user; applyAuthUI();
  return true;
}

// RESTAURAÇÃO DE AUTOSAVE NO CARREGAMENTO
/**
 * Tenta restaurar automaticamente uma sessão salva anteriormente.
 */
function tryRestoreAutoSave() {
  const saved = localStorage.getItem("mapa_riscos_autosave");
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if(data.areas){state.areas=sanitizeAreaNames(data.areas);state.areaAtiva=data.areaAtiva||data.areas[0]?.id;}else if(data.room&&data.objects){const a=createArea("Laboratório","laboratorio",data.room.w,data.room.h,0,0);a.objetos=data.objects;state.areas=[a];state.areaAtiva=a.id;}
      state.areas.forEach((a,i)=>{a.id ||= crypto.randomUUID();a.nome ||= `Área ${i+1}`;a.tipo ||= "apoio";a.dimensoes ||= {w:12,h:8};a.posicaoGlobal ||= {x:i*14,y:0};a.objetos ||= [];});
      state.areaAtiva ||= state.areas[0].id; syncAreaConnections(); updateAreaUI();
    } catch(err) { console.error("Erro ao carregar autosave", err); }
  }
}

$("homeNewProject")?.addEventListener("click", () => { if (state.user?.papel !== "professor") return showToast("Ação disponível apenas para o professor", "info"); resetToNewProject(); });
$("homeOpenProject")?.addEventListener("click", () => openProjectFileFromHome());
$("homeUseModel")?.addEventListener("click", () => { if (state.user?.papel !== "professor") return showToast("Ação disponível apenas para o professor", "info"); openModelPickerFromHome(); });
$("homeImportModel")?.addEventListener("click", () => { if (state.user?.papel !== "professor") return showToast("Ação disponível apenas para o professor", "info"); importModelFromHome(); });
$("homeContinue")?.addEventListener("click", () => loadAutosaveIntoState());
$("homeCreateRoomBtn")?.addEventListener("click", createRoomFromLogin);

window.addEventListener("resize", resizeCanvas);
window.addEventListener("DOMContentLoaded", async () => {
  state.areas.forEach(a => a.objetos.forEach(normalizeObject));
  syncAreaConnections(); updateAreaUI(); updateHomeRecent(); applySessionUI(); applyAuthUI();
  const authenticated = await bootstrapLocalSession();
  if (authenticated) {
    const restored = await bootstrapRoomSession();
    if (!restored) showHomeScreen();
  } else { showLoginScreen(); }
});



// LOGIN E SESSÕES DE SALA
$("loginRoleProfessor")?.addEventListener("click", () => { loginUiRole = "professor"; loginUiMode = "login"; setLoginRole("professor"); syncAuthFormUI(); });
$("loginRoleStudent")?.addEventListener("click", () => { loginUiRole = "estudante"; loginUiMode = "login"; setLoginRole("student"); syncAuthFormUI(); });
$("authForm")?.addEventListener("submit", submitAuthForm);
$("toggleRegister")?.addEventListener("click", () => { loginUiMode = loginUiMode === "register" ? "login" : "register"; syncAuthFormUI(); setLoginError(""); });
$("createRoomBtn")?.addEventListener("click", createRoomFromLogin);
$("homeLogoutBtn")?.addEventListener("click", logoutUser);
$("refreshUserRooms")?.addEventListener("click", () => loadUserRooms().catch(err => showToast(err.message, "error")));
$("professorJoinForm")?.addEventListener("submit", e => { e.preventDefault(); joinRoomFromLogin($("professorRoomCode")?.value, true); });
$("studentJoinForm")?.addEventListener("submit", e => { e.preventDefault(); joinRoomFromLogin($("studentRoomCode")?.value, false); });
["professorRoomCode","studentRoomCode"].forEach(id => $(id)?.addEventListener("input", e => { e.target.value = e.target.value.replace(/[^a-z0-9]/gi, "").slice(0,6).toUpperCase(); setLoginError(""); }));
$("roomCodeBadge")?.addEventListener("click", async () => { if (!state.roomCode) return; try { await navigator.clipboard?.writeText(state.roomCode); showToast("Código da sala copiado", "success"); } catch { showToast(`Código da sala: ${state.roomCode}`, "info"); } });
$("endRoomBtn")?.addEventListener("click", () => {
  if (state.role !== "professor" || !state.roomCode) return;
  showConfirmModal(`Encerrar a sala "${state.roomCode}"? Novos acessos serão bloqueados.`, async () => {
    try { await apiRequest("/api/sala/encerrar", { method:"POST", body:JSON.stringify({codigo:state.roomCode}) }); clearRoomSession(); showLoginScreen(); showToast("Sala encerrada", "success"); }
    catch (err) { showToast(err.message, "error"); }
  }, {title:"Encerrar sala",confirmLabel:"Encerrar",cancelLabel:"Cancelar"});
});

// FRENTE 25 — controles responsivos dos painéis laterais
/**
 * Inicializa os controles de painéis responsivos, backdrop e comportamento de toque/teclado.
 */
(function initResponsivePanels() {
  const leftPanel = $("leftPanel");
  const rightPanel = $("rightPanel");
  const backdrop = $("mobilePanelBackdrop");
  const toggleTools = $("btnToggleTools");
  const toggleProps = $("btnToggleProps");
  const closeTools = $("closeToolsPanel");
  const closeProps = $("closePropsPanel");

  if (!leftPanel || !rightPanel || !backdrop) return;

  const isMobile = () => window.matchMedia("(max-width: 768px)").matches;

  /**
   * Fecha os painéis laterais responsivos e atualiza o estado ARIA.
   */
  function closePanels() {
    leftPanel.classList.remove("mobile-open");
    rightPanel.classList.remove("mobile-open");
    backdrop.hidden = true;
    toggleTools?.setAttribute("aria-expanded", "false");
    toggleProps?.setAttribute("aria-expanded", "false");
    document.body.classList.remove("mobile-panel-active");
  }

  /**
   * Abre um painel lateral responsivo específico.
   */
  function openPanel(panel) {
    if (!isMobile()) return;
    leftPanel.classList.toggle("mobile-open", panel === "left");
    rightPanel.classList.toggle("mobile-open", panel === "right");
    backdrop.hidden = false;
    backdrop.setAttribute("aria-hidden", "false");
    toggleTools?.setAttribute("aria-expanded", panel === "left" ? "true" : "false");
    toggleProps?.setAttribute("aria-expanded", panel === "right" ? "true" : "false");
    document.body.classList.add("mobile-panel-active");
    (panel === "left" ? closeTools : closeProps)?.focus({ preventScroll: true });
  }

  toggleTools?.setAttribute("aria-expanded", "false");
  toggleProps?.setAttribute("aria-expanded", "false");
  toggleTools?.addEventListener("click", () => {
    const open = leftPanel.classList.contains("mobile-open");
    open ? closePanels() : openPanel("left");
  });
  toggleProps?.addEventListener("click", () => {
    const open = rightPanel.classList.contains("mobile-open");
    open ? closePanels() : openPanel("right");
  });
  closeTools?.addEventListener("click", closePanels);
  closeProps?.addEventListener("click", closePanels);
  backdrop.addEventListener("click", closePanels);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isMobile() && !backdrop.hidden) closePanels();
  });

  window.addEventListener("resize", () => {
    if (!isMobile()) closePanels();
  });

  document.querySelectorAll(".panel-section > summary").forEach(summary => {
    summary.addEventListener("click", () => {
      requestAnimationFrame(() => {
        const detail = summary.parentElement;
        if (!detail) return;
        detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    });
  });
})();
