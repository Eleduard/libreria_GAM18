/**
 * Implementación universal de OAuth 2.0 PKCE (RFC 7636).
 * Compatible con navegadores modernos y Node.js 18+ sin dependencias externas.
 */

function getCrypto(): Crypto {
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  throw new Error(
    'No se encontró una API Web Crypto disponible en el entorno actual. Se requiere Node.js 18+ o un navegador compatible.'
  );
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  // Si existe Buffer de Node.js:
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64url');
  }

  // Fallback nativo navegador con btoa:
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Genera un `code_verifier` de alta entropía (entre 43 y 128 caracteres).
 */
export function generateCodeVerifier(length = 64): string {
  const clampedLength = Math.max(43, Math.min(128, length));
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const cryptoInstance = getCrypto();
  const randomBytes = new Uint8Array(clampedLength);
  cryptoInstance.getRandomValues(randomBytes);

  let result = '';
  for (let i = 0; i < clampedLength; i++) {
    result += charset.charAt(randomBytes[i] % charset.length);
  }
  return result;
}

/**
 * Deriva el `code_challenge` calculando el hash SHA-256 del `code_verifier`
 * codificado en Base64URL sin relleno (método S256).
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const cryptoInstance = getCrypto();
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await cryptoInstance.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
}

/**
 * Genera un token `state` criptográfico para prevenir ataques CSRF en OAuth.
 */
export function generateState(length = 32): string {
  return generateCodeVerifier(length);
}
