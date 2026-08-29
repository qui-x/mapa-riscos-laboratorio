/**
 * Cliente HTTP para o Web App Google Apps Script.
 * O body é enviado como texto para evitar preflight CORS desnecessário.
 */
(function() {
  'use strict';

  /** Retorna a URL configurada do backend GAS. */
  function gasUrl() {
    const url = String(window.APP_CONFIG?.GAS_URL || '').trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec\/?$/.test(url)) {
      throw new Error('GAS_URL não configurada. Informe a URL /exec do Google Apps Script em js/config.js.');
    }
    return url.replace(/\/$/, '');
  }

  /** Recupera o token da sessão atual armazenado no navegador. */
  function sessionToken() {
    return localStorage.getItem('mapa_riscos_session_token') || '';
  }

  /** Executa uma requisição autenticada ou pública contra o GAS. */
  async function request(path, options = {}) {
    const url = gasUrl();
    let body = {};
    if (options.body) {
      try { body = JSON.parse(options.body); } catch { body = {}; }
    }
    const token = sessionToken();
    if (token && !body.sessionToken) body.sessionToken = token;
    const actionMap = {
      '/api/auth/register': 'authRegister',
      '/api/auth/login': 'authLogin',
      '/api/auth/forgot-password': 'authForgotPassword',
      '/api/auth/reset-password': 'authResetPassword',
      '/api/auth/logout': 'authLogout',
      '/api/sala/criar': 'criar',
      '/api/sala/entrar': 'entrar',
      '/api/usuario/salas': 'listarSalas',
      '/api/sala/salvar': 'salvar',
      '/api/sala/encerrar': 'encerrar',
      '/api/sinalizacao/enviar': 'enviarSinal',
      '/api/sinalizacao/receber': 'receberSinal',
      '/api/sala/status': 'status'
    };

    if (path.startsWith('/api/sala/status/')) {
      body.action = 'status';
      body.codigo = decodeURIComponent(path.slice('/api/sala/status/'.length));
    } else if (actionMap[path]) {
      body.action = actionMap[path];
    } else {
      throw new Error('Endpoint não suportado: ' + path);
    }

    const response = await fetch(url, {
      method: options.method || 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow'
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('O backend retornou uma resposta inválida.'); }
    if (!response.ok || data.ok === false) {
      const error = new Error(data.error || 'Falha na comunicação com o servidor.');
      error.code = data.code || 'HTTP_ERROR';
      throw error;
    }
    return data;
  }

  window.RoomBackend = Object.freeze({ request });
})();
