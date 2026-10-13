/**
 * Utility functions for OAuth 2.0 PKCE (Proof Key for Code Exchange - RFC 7636)
 * Uses browser Web Crypto API.
 */

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
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
 * Generates a high-entropy cryptographic random string (code_verifier).
 * Must be between 43 and 128 characters from unreserved characters [A-Z, a-z, 0-9, -, ., _, ~].
 */
export function generateCodeVerifier(length = 64): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const randomValues = new Uint8Array(length);
  window.crypto.getRandomValues(randomValues);
  let text = '';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(randomValues[i] % possible.length);
  }
  return text;
}

/**
 * Derives the code_challenge using SHA-256 hash of the code_verifier,
 * encoded in Base64URL without padding (code_challenge_method = 'S256').
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
}

/**
 * Generates a random cryptographic state token to prevent CSRF attacks.
 */
export function generateState(length = 32): string {
  return generateCodeVerifier(length);
}
