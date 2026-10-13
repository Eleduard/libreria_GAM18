/**
 * Tipos e interfaces de configuración y respuesta para la librería GeneXus GAM Auth.
 */

export interface GamEndpoints {
  /** Endpoint para inicio de sesión en el IDP (por defecto: /oauth/gam/signin) */
  signin?: string;
  /** Endpoint para canje de código de autorización (por defecto: /oauth/gam/access_token) */
  token?: string;
  /** Endpoint alternativo móvil/REST v2.0 (por defecto: /oauth/gam/v2.0/access_token) */
  tokenV2?: string;
  /** Endpoint de información del usuario (por defecto: /oauth/gam/userinfo) */
  userInfo?: string;
  /** Endpoint alternativo de userinfo v2.0 (por defecto: /oauth/gam/v2.0/userinfo) */
  userInfoV2?: string;
}

export interface GamConfig {
  /** URL base para llamadas REST (ej: /api-gam/tuidp en dev o https://idp.empresa.com) */
  baseUrl: string;
  /** URL pública a la que se redirige el navegador del usuario para autenticarse */
  publicUrl?: string;
  /** Client ID registrado en GAM */
  clientId: string;
  /** Client Secret (solo para flujos confidenciales en Node.js; opcional y omitido en PKCE) */
  clientSecret?: string;
  /** URI de retorno por defecto tras el login */
  redirectUri?: string;
  /** Scopes por defecto (ej: gam_user_data+gam_user_roles) */
  scope?: string;
  /** Personalización de endpoints si el servidor GAM usa rutas distintas */
  endpoints?: GamEndpoints;
  /** Adaptador de almacenamiento (por defecto: BrowserStorage en navegador, MemoryStorage en Node) */
  storage?: GamStorage;
}

export interface GamAuthorizeUrlParams {
  clientId?: string;
  redirectUri?: string;
  codeChallenge: string;
  state: string;
  scope?: string;
  responseType?: 'code';
  additionalParams?: Record<string, string>;
}

export interface GamTokenExchangeParams {
  code: string;
  codeVerifier: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  endpointUrl?: string;
}

export interface GamTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  user_guid?: string;
  [key: string]: unknown;
}

export interface GamUserInfo {
  guid?: string;
  user_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  roles?: Array<{ id?: string; name?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

export interface GamStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export interface GamPkceSession {
  verifier: string;
  state: string;
  clientId: string;
  redirectUri: string;
  createdAt: string;
  publicUrl?: string;
  baseUrl?: string;
}

export interface GamExecutionResult<T = unknown> {
  success: boolean;
  status?: number;
  statusText?: string;
  endpoint: string;
  data?: T;
  rawError?: {
    name?: string;
    message?: string;
  };
  isNetworkError?: boolean;
}
