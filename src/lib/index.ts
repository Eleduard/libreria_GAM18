/**
 * @genexus/gam-auth
 * Librería de autenticación OAuth 2.0 + PKCE para GeneXus Access Manager (GAM 18).
 * Compatible con Node.js 18+ y navegadores modernos (React, Vue, Vanilla).
 */

export { GamAuthClient } from './core/GamAuthClient';
export {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
} from './core/pkce';
export {
  BrowserStorage,
  MemoryStorage,
  getDefaultStorage,
} from './core/storage';
export { getGamConfigFromEnv } from './core/env';

export type {
  GamConfig,
  GamEndpoints,
  GamAuthorizeUrlParams,
  GamTokenExchangeParams,
  GamTokenResponse,
  GamUserInfo,
  GamStorage,
  GamPkceSession,
  GamExecutionResult,
} from './core/types';

export {
  GamAuthProvider,
  useGamAuth,
  type GamAuthProviderProps,
  type GamAuthContextValue,
} from './react';
