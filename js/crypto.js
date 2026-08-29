(function () {
  'use strict';

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  /**
   * Verifica se a Web Crypto API necessária para criptografia e geração de aleatoriedade está disponível.
   */
  function ensureCrypto() {
    if (!window.crypto?.subtle || !window.crypto?.getRandomValues) {
      throw new Error('Web Crypto API não está disponível neste navegador.');
    }
  }

  /**
   * Converte um array de bytes para uma string Base64, usada para transportar os dados cifrados.
   */
  function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  /**
   * Converte uma string Base64 de volta para um array de bytes.
   */
  function base64ToBytes(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  /**
   * Deriva uma chave AES-GCM a partir da senha e do salt usando PBKDF2.
   */
  async function deriveKey(password, salt, usages) {
    ensureCrypto();
    const material = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      usages
    );
  }

  /**
   * Serializa e criptografa um objeto JSON com AES-GCM e retorna o payload pronto para armazenamento.
   */
  async function encryptJson(data, password) {
    ensureCrypto();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt, ['encrypt']);
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(JSON.stringify(data))
    ));
    const packed = new Uint8Array(salt.length + iv.length + ciphertext.length);
    packed.set(salt, 0);
    packed.set(iv, salt.length);
    packed.set(ciphertext, salt.length + iv.length);
    return `v1:${bytesToBase64(packed)}`;
  }

  /**
   * Descriptografa um payload salvo, valida o formato e reconstrói o objeto JSON original.
   */
  async function decryptJson(payload, password) {
    ensureCrypto();
    if (!payload) return null;
    if (typeof payload !== 'string') return payload;
    if (!payload.startsWith('v1:')) {
      try { return JSON.parse(payload); } catch { throw new Error('Projeto da sala está em formato inválido.'); }
    }
    const packed = base64ToBytes(payload.slice(3));
    if (packed.length < 29) throw new Error('Dados criptografados inválidos.');
    const salt = packed.subarray(0, 16);
    const iv = packed.subarray(16, 28);
    const ciphertext = packed.subarray(28);
    const key = await deriveKey(password, salt, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return JSON.parse(dec.decode(plain));
  }

  window.CryptoUtils = Object.freeze({ encryptJson, decryptJson });
})();
