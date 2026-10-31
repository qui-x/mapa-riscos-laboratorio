/**
 * Camada de autenticação remota.
 * Mantém apenas o usuário e o sessionToken no navegador; credenciais são
 * enviadas ao Google Apps Script para validação e persistência no Sheets.
 */
(function() {
  'use strict';
  const USER_KEY = 'mapa_riscos_remote_user_v1';
  const SESSION_KEY = 'mapa_riscos_session_token';

  /** Normaliza o texto usado nos campos de autenticação. */
  function clean(value) { return String(value || '').trim(); }

  /** Persiste o usuário e a sessão retornados pelo backend. */
  function storeSession(result) {
    if (!result?.usuario || !result?.sessionToken) throw new Error('O servidor não retornou uma sessão válida.');
    localStorage.setItem(USER_KEY, JSON.stringify(result.usuario));
    localStorage.setItem(SESSION_KEY, result.sessionToken);
    return result.usuario;
  }

  /** Cadastra um novo usuário no backend GAS. */
  async function registerUser(nome, email, senha, papel) {
    const result = await window.RoomBackend.request('/api/auth/register', {
      method: 'POST', body: JSON.stringify({ nome: clean(nome), email: clean(email).toLowerCase(), senha: String(senha || ''), papel })
    });
    return storeSession(result);
  }

  /** Autentica um usuário existente no backend GAS. */
  async function loginUser(email, senha, papel) {
    const result = await window.RoomBackend.request('/api/auth/login', {
      method: 'POST', body: JSON.stringify({ email: clean(email).toLowerCase(), senha: String(senha || ''), papel })
    });
    return storeSession(result);
  }

  /** Solicita um link de redefinição de senha por e-mail. */
  async function forgotPassword(email) {
    const result = await window.RoomBackend.request('/api/auth/forgot-password', {
      method: 'POST', body: JSON.stringify({ email: clean(email).toLowerCase(), frontendUrl: window.location.origin + window.location.pathname })
    });
    return result;
  }

  /** Redefine a senha usando o token recebido no link enviado por e-mail. */
  async function resetPassword(token, email, senha) {
    return window.RoomBackend.request('/api/auth/reset-password', {
      method: 'POST', body: JSON.stringify({ token, email: clean(email).toLowerCase(), senha: String(senha || '') })
    });
  }

  /** Invalida a sessão no backend e limpa a sessão local. */
  async function logoutUser() {
    try {
      await window.RoomBackend.request('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });
    } finally {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(SESSION_KEY);
    }
  }

  /** Retorna o usuário autenticado armazenado no navegador. */
  function getCurrentUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
  }

  /** Verifica se existe usuário e token de sessão persistidos. */
  function isAuthenticated() {
    return Boolean(getCurrentUser()?.id && localStorage.getItem(SESSION_KEY));
  }

  window.AuthAPI = Object.freeze({ registerUser, loginUser, forgotPassword, resetPassword, logoutUser, getCurrentUser, isAuthenticated });
})();
