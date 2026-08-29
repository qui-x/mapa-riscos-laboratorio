/**
 * Utilitários opcionais de criptografia no cliente.
 *
 * O módulo não participa do login por e-mail e senha. Ele fornece
 * funções para cifrar/decifrar dados de projeto antes de uma futura
 * persistência remota, mantendo compatibilidade com a arquitetura GAS.
 */
(function () {
  'use strict';

  /** Converte bytes para Base64. */
  function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  /** Converte uma string Base64 de volta para bytes. */
  function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  /** Deriva uma chave AES-GCM usando PBKDF2 e um salt fornecido. */
  async function deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const material = await crypto.subtle.importKey(
      'raw',
      encoder.encode(String(password)),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /** Criptografa um valor JSON e retorna Base64 contendo salt + IV + ciphertext. */
  async function encryptData(data, password) {
    if (!window.crypto?.subtle) throw new Error('Web Crypto API indisponível neste navegador.');
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(JSON.stringify(data))
    );
    const payload = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    payload.set(salt, 0);
    payload.set(iv, salt.length);
    payload.set(new Uint8Array(encrypted), salt.length + iv.length);
    return bytesToBase64(payload);
  }

  /** Descriptografa um payload criado por encryptData(). */
  async function decryptData(payload, password) {
    if (!window.crypto?.subtle) throw new Error('Web Crypto API indisponível neste navegador.');
    const bytes = base64ToBytes(payload);
    if (bytes.length < 29) throw new Error('Payload criptografado inválido.');
    const salt = bytes.slice(0, 16);
    const iv = bytes.slice(16, 28);
    const encrypted = bytes.slice(28);
    const key = await deriveKey(password, salt);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
    return JSON.parse(new TextDecoder().decode(decrypted));
  }

  window.CryptoUtils = Object.freeze({ encryptData, decryptData });
})();
