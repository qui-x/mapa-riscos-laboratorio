(function () {
  'use strict';

  const config = window.APP_CONFIG || {};
  const GAS_URL = String(config.GAS_URL || '').trim();
  let signalTimer = null;
  let participantTimer = null;
  let stopped = false;
  const peers = new Map();

  /**
   * Obtém o estado atual do editor exposto em MAPA_RUNTIME.
   */
  function getState() { return window.MAPA_RUNTIME?.state || null; }
  /**
   * Retorna a URL configurada do Web App do Google Apps Script.
   */
  function apiUrl() {
    if (!GAS_URL || GAS_URL.includes('COLE_AQUI')) {
      throw new Error('Configure a URL do Web App do Google Apps Script em js/config.js.');
    }
    return GAS_URL;
  }

  /**
   * Envia uma ação para o backend GAS e normaliza a resposta JSON.
   */
  async function requestAction(action, payload = {}, method = 'POST') {
    const base = apiUrl();
    let url = base;
    const sessionToken = String(localStorage.getItem('sessionToken') || '');
    const requestPayload = (action !== 'authLogin' && sessionToken && payload.sessionToken == null)
      ? { ...payload, sessionToken } : payload;
    const init = { method, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow' };
    if (method === 'GET') {
      const params = new URLSearchParams({ action, ...requestPayload });
      url = `${base}${base.includes('?') ? '&' : '?'}${params.toString()}`;
    } else {
      init.body = JSON.stringify({ action, ...requestPayload });
    }
    const response = await fetch(url, init);
    let data;
    try { data = await response.json(); } catch { throw new Error('Resposta inválida do Google Apps Script.'); }
    if (!response.ok || data?.ok === false) throw new Error(data?.error || `Erro HTTP ${response.status}`);
    return data;
  }

  /**
   * Executa uma requisição HTTP genérica para o backend e trata respostas/erros.
   */
  async function request(path, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const body = options.body ? JSON.parse(options.body) : {};
    const actionMap = {
      '/api/auth/login': 'authLogin',
      '/api/auth/logout': 'authLogout',
      '/api/usuario/salas': 'usuarioSalas',
      '/api/sala/criar': 'criar',
      '/api/sala/entrar': 'entrar',
      '/api/sala/salvar': 'salvar',
      '/api/sala/encerrar': 'encerrar',
      '/api/sala/participantes': 'participantes',
      '/api/sinalizacao/enviar': 'enviarSinal',
    };
    if (path.startsWith('/api/sala/status/')) {
      const codigo = decodeURIComponent(path.slice('/api/sala/status/'.length));
      return requestAction('status', { codigo }, 'GET');
    }
    if (path === '/api/sinalizacao/receber') {
      return requestAction('receberSinal', { ...body, sessionToken: String(localStorage.getItem('sessionToken') || '') }, 'GET');
    }
    if (path === '/api/sinalizacao/enviar') {
      const st = getState();
      return requestAction('enviarSinal', { ...body, remetente: st?.user?.id || st?.roomToken || '' }, 'POST');
    }
    const action = actionMap[path];
    if (!action) throw new Error(`Endpoint não suportado pelo backend GAS: ${path}`);
    if (path === '/api/sala/salvar' && body.projeto) {
      const st = getState();
      if (!st?.roomCode) throw new Error('Sala não identificada para criptografia.');
      body.projeto = await CryptoUtils.encryptJson(body.projeto, st.roomCode);
    }
    return requestAction(action, body, method);
  }

  /**
   * Encerra polling e conexões WebRTC ativas e limpa os temporizadores relacionados.
   */
  function stopRealtime() {
    stopped = true;
    if (signalTimer) clearTimeout(signalTimer);
    if (participantTimer) clearTimeout(participantTimer);
    signalTimer = participantTimer = null;
    for (const pc of peers.values()) { try { pc.close(); } catch {} }
    peers.clear();
  }

  /**
   * Descriptografa o projeto recebido da sala e devolve os dados para o editor.
   */
  async function decryptRoomProject(sala) {
    if (!sala?.projeto) return null;
    const st = getState();
    if (!st?.roomCode) return null;
    try { return await CryptoUtils.decryptJson(sala.projeto, st.roomCode); }
    catch (err) { console.warn('Falha ao descriptografar projeto da sala', err); return null; }
  }

  /**
   * Processa uma mensagem de sinalização recebida e atualiza a conexão WebRTC correspondente.
   */
  async function deliverIncomingSignal(signal) {
    const st = getState();
    if (!st || !signal) return;
    if (signal.tipo === 'offer' && st.role === 'student') {
      let pc = st.__studentPeer;
      if (!pc) {
        pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        st.__studentPeer = pc;
        pc.ondatachannel = event => {
          const dc = event.channel;
          dc.onmessage = evt => {
            try {
              const msg = JSON.parse(evt.data);
              if (msg.type === 'sync' && msg.data?.areas) {
                st.areas = typeof window.normalizeModelAreas === 'function' ? window.normalizeModelAreas(msg.data.areas) : msg.data.areas;
                st.areaAtiva = msg.data.areaAtiva || st.areas[0]?.id || null;
                window.syncAreaConnections?.(); window.updateAreaUI?.(); window.fitRoom?.(); window.updateUI?.(); window.requestDraw?.();
              } else if (msg.type === 'update' && msg.data?.areas) {
                st.areas = typeof window.normalizeModelAreas === 'function' ? window.normalizeModelAreas(msg.data.areas) : msg.data.areas;
                st.areaAtiva = msg.data.areaAtiva || st.areas[0]?.id || null;
                window.syncAreaConnections?.(); window.updateAreaUI?.(); window.fitRoom?.(); window.updateUI?.(); window.requestDraw?.();
              }
            } catch (err) { console.warn('Atualização WebRTC inválida', err); }
          };
        };
        pc.onicecandidate = evt => {
          if (evt.candidate) sendSignal({ codigoSala: st.roomCode, remetente: st.roomToken, destinatario: signal.remetente, tipo: 'ice-candidate', payload: JSON.stringify(evt.candidate) }).catch(console.warn);
        };
      }
      await pc.setRemoteDescription(JSON.parse(signal.payload));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal({ codigoSala: st.roomCode, remetente: st.roomToken, destinatario: signal.remetente, tipo: 'answer', payload: JSON.stringify(answer) });
      return;
    }
    if (signal.tipo === 'answer' && st.role === 'professor') {
      const pc = peers.get(signal.remetente);
      if (pc) await pc.setRemoteDescription(JSON.parse(signal.payload));
      return;
    }
    if (signal.tipo === 'ice-candidate') {
      if (st.role === 'professor') {
        const pc = peers.get(signal.remetente);
        if (pc) await pc.addIceCandidate(JSON.parse(signal.payload));
      } else if (st.__studentPeer) {
        await st.__studentPeer.addIceCandidate(JSON.parse(signal.payload));
      }
    }
  }

  /**
   * Consulta periodicamente o GAS em busca de ofertas, respostas e ICE candidates pendentes.
   */
  async function pollSignals() {
    if (stopped) return;
    const st = getState();
    if (!st?.roomCode || !st?.roomToken) return;
    try {
      const result = await requestAction('receberSinal', { sessionToken: st.sessionToken || localStorage.getItem('sessionToken') || '' }, 'GET');
      for (const signal of result.signals || []) {
        try { await deliverIncomingSignal(signal); } catch (err) { console.warn('Falha ao processar sinal WebRTC', err); }
      }
    } catch (err) { console.warn('Polling de sinalização falhou', err); }
    signalTimer = setTimeout(pollSignals, 700);
  }

  /**
   * Cria uma PeerConnection do professor, abre o DataChannel e envia uma oferta SDP ao estudante.
   */
  async function createOffer(studentToken) {
    const st = getState();
    if (!st || st.role !== 'professor' || peers.has(studentToken)) return;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    const dc = pc.createDataChannel('sync');
    pc.__syncDataChannel = dc;
    dc.onopen = () => {
      dc.send(JSON.stringify({ type: 'sync', data: { version: 4, areas: st.areas, areaAtiva: st.areaAtiva } }));
    };
    pc.onicecandidate = evt => {
      if (evt.candidate) sendSignal({ codigoSala: st.roomCode, remetente: st.roomToken, destinatario: studentToken, tipo: 'ice-candidate', payload: JSON.stringify(evt.candidate) }).catch(console.warn);
    };
    peers.set(studentToken, pc);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendSignal({ codigoSala: st.roomCode, remetente: st.roomToken, destinatario: studentToken, tipo: 'offer', payload: JSON.stringify(offer) });
  }

  /**
   * Consulta o backend para descobrir novos participantes e iniciar ofertas WebRTC para eles.
   */
  async function pollParticipants() {
    if (stopped) return;
    const st = getState();
    if (st?.role === 'professor' && st.roomCode && st.roomToken) {
      try {
        const result = await requestAction('participantes', { codigo: st.roomCode, token: st.roomToken }, 'POST');
        for (const token of result.participantes || []) await createOffer(token);
      } catch (err) { console.warn('Falha ao obter participantes', err); }
    }
    participantTimer = setTimeout(pollParticipants, 1500);
  }

  /**
   * Envia uma mensagem de sinalização WebRTC ao backend GAS.
   */
  async function sendSignal(data) { return requestAction('enviarSinal', data, 'POST'); }

  /**
   * Inicia o mecanismo de tempo real da sala, incluindo polling e rotinas específicas do papel atual.
   */
  async function startRealtime() {
    stopRealtime();
    stopped = false;
    const st = getState();
    if (!st?.roomCode || !st?.roomToken) return;
    pollSignals();
    pollParticipants();
  }

  /**
   * Envia uma atualização do projeto para todos os DataChannels WebRTC abertos.
   */
  async function broadcastUpdate(updateData) {
    for (const pc of peers.values()) {
      const dc = pc.__syncDataChannel;
      if (dc && dc.readyState === 'open') {
        try { dc.send(JSON.stringify({ type: 'update', data: updateData })); } catch {}
      }
    }
  }

  // Mantemos referências públicas para integração com mapa.js sem acoplamento a módulos ES.
  window.RoomBackend = Object.freeze({
    request,
    requestAction,
    startRealtime,
    stopRealtime,
    decryptRoomProject,
    broadcastUpdate,
    sendSignal,
    getGASUrl: () => GAS_URL
  });
})();
