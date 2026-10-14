import {
  GamCallExecutionResult,
  GamCodeExchangeExecutionResult,
  GamCodeExchangeParams,
  GamTokenRequestParams,
  GamUserInfoExecutionResult,
} from '../../types/auth';

// En desarrollo con Vite, usamos el prefijo '/api-gam' para que las peticiones vayan al proxy de Vite
// y eviten el bloqueo de CORS del navegador, reenviando al host configurado en vite.config.ts
export const DEFAULT_GAM_BASE_URL = '/api-gam';
export const DEFAULT_PUBLIC_GAM_URL = '';
export const GAM_TOKEN_ENDPOINT = '/oauth/gam/v2.0/access_token';
export const GAM_IDP_TOKEN_ENDPOINT = '/oauth/gam/access_token';
export const GAM_USERINFO_ENDPOINT = '/oauth/gam/v2.0/userinfo';
export const GAM_IDP_USERINFO_ENDPOINT = '/oauth/gam/userinfo';
export const GAM_SIGNIN_ENDPOINT = '/oauth/gam/signin';
export const GAM_SCOPE = 'gam_user_data+gam_user_roles';

export const DEFAULT_GAM_CONFIG = {
  baseUrl: DEFAULT_GAM_BASE_URL,
  tokenEndpoint: GAM_TOKEN_ENDPOINT,
  idpTokenEndpoint: GAM_IDP_TOKEN_ENDPOINT,
  userInfoEndpoint: GAM_USERINFO_ENDPOINT,
  idpUserInfoEndpoint: GAM_IDP_USERINFO_ENDPOINT,
  signinEndpoint: GAM_SIGNIN_ENDPOINT,
  scope: GAM_SCOPE,
};

function getProxyHeaders(endpoint: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof window !== 'undefined' && endpoint.startsWith('/api-gam')) {
    const stored = localStorage.getItem('gam_public_url');
    if (stored) {
      try {
        headers['x-gam-target'] = new URL(stored).origin;
      } catch {}
    }
  }
  return headers;
}

export class GamService {
  private baseUrl: string;

  constructor(baseUrl: string = DEFAULT_GAM_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public getTokenEndpointUrl(): string {
    return `${this.baseUrl}${GAM_TOKEN_ENDPOINT}`;
  }

  public getIdpTokenEndpointUrl(): string {
    return `${this.baseUrl}${GAM_IDP_TOKEN_ENDPOINT}`;
  }

  public getUserInfoEndpointUrl(): string {
    return `${this.baseUrl}${GAM_USERINFO_ENDPOINT}`;
  }

  public getIdpUserInfoEndpointUrl(): string {
    return `${this.baseUrl}${GAM_IDP_USERINFO_ENDPOINT}`;
  }

  /**
   * Builds the authorization URL for redirection to GAM login page with PKCE parameters.
   */
  public buildAuthorizationUrl(params: {
    publicGamBaseUrl: string;
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    state: string;
    scope?: string;
  }): string {
    const cleanBase = params.publicGamBaseUrl.replace(/\/+$/, '');
    const url = new URL(`${cleanBase}${GAM_SIGNIN_ENDPOINT}`);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', params.clientId);
    url.searchParams.set('redirect_uri', params.redirectUri);
    url.searchParams.set('scope', params.scope || GAM_SCOPE);
    url.searchParams.set('state', params.state);
    url.searchParams.set('code_challenge', params.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  /**
   * Exchanges an authorization code for an access token using PKCE (RFC 7636).
   * Notice: NO client_secret is sent.
   */
  public async exchangeCodeForToken(
    params: GamCodeExchangeParams & { endpointUrl?: string }
  ): Promise<GamCodeExchangeExecutionResult> {
    const endpoint = params.endpointUrl || this.getIdpTokenEndpointUrl();
    const timestamp = new Date().toISOString();

    const bodyParams = new URLSearchParams();
    bodyParams.append('grant_type', 'authorization_code');
    bodyParams.append('client_id', params.clientId);
    bodyParams.append('code', params.code);
    bodyParams.append('redirect_uri', params.redirectUri);
    bodyParams.append('code_verifier', params.codeVerifier);

    const executionLog: GamCodeExchangeExecutionResult = {
      timestamp,
      endpoint,
      requestParams: {
        grant_type: 'authorization_code',
        client_id: params.clientId,
        code: params.code,
        redirect_uri: params.redirectUri,
        code_verifier: params.codeVerifier,
      },
      success: false,
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...getProxyHeaders(endpoint),
        },
        body: bodyParams.toString(),
      });

      executionLog.status = response.status;
      executionLog.statusText = response.statusText;

      const responseText = await response.text();
      let responseBody: unknown;
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        responseBody = responseText;
      }

      executionLog.data = responseBody;
      executionLog.success = response.ok;

      return executionLog;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isCorsOrNetwork =
        err instanceof TypeError ||
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('NetworkError');

      executionLog.success = false;
      executionLog.isCorsOrNetworkError = isCorsOrNetwork;
      executionLog.rawError = {
        name: err instanceof Error ? err.name : 'UnknownError',
        message: errorMessage,
      };

      return executionLog;
    }
  }

  /**
   * Performs the real OAuth 2.0 access_token POST directly using Resource Owner Password credentials.
   */
  public async requestAccessToken(params: {
    clientId: string;
    clientSecret: string;
    username: string;
    password: string;
  }): Promise<GamCallExecutionResult> {
    const endpoint = this.getTokenEndpointUrl();
    const timestamp = new Date().toISOString();

    const bodyParams = new URLSearchParams();
    bodyParams.append('grant_type', 'password');
    bodyParams.append('client_id', params.clientId);
    bodyParams.append('client_secret', params.clientSecret);
    bodyParams.append('scope', GAM_SCOPE);
    bodyParams.append('username', params.username);
    bodyParams.append('password', params.password);

    const maskedSecret =
      params.clientSecret.length > 4
        ? `${params.clientSecret.slice(0, 2)}***${params.clientSecret.slice(-2)}`
        : '***';

    const executionLog: GamCallExecutionResult = {
      timestamp,
      endpoint,
      requestParams: {
        grant_type: 'password',
        client_id: params.clientId,
        client_secret_masked: maskedSecret,
        scope: GAM_SCOPE,
        username: params.username,
      },
      success: false,
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...getProxyHeaders(endpoint),
        },
        body: bodyParams.toString(),
      });

      executionLog.status = response.status;
      executionLog.statusText = response.statusText;

      const responseText = await response.text();
      let responseBody: unknown;
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        responseBody = responseText;
      }

      executionLog.data = responseBody;
      executionLog.success = response.ok;

      return executionLog;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isCorsOrNetwork =
        err instanceof TypeError ||
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('NetworkError');

      executionLog.success = false;
      executionLog.isCorsOrNetworkError = isCorsOrNetwork;
      executionLog.rawError = {
        name: err instanceof Error ? err.name : 'UnknownError',
        message: errorMessage,
      };

      return executionLog;
    }
  }

  /**
   * Performs the real OAuth 2.0 userinfo GET request directly from the browser to GAM
   * using the native Fetch API with Authorization: Bearer <access_token>.
   */
  public async getUserInfo(
    accessToken: string,
    endpointUrl?: string
  ): Promise<GamUserInfoExecutionResult> {
    const endpoint = endpointUrl || this.getIdpUserInfoEndpointUrl();
    const timestamp = new Date().toISOString();

    const userInfoLog: GamUserInfoExecutionResult = {
      timestamp,
      endpoint,
      success: false,
    };

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${accessToken}`,
          ...getProxyHeaders(endpoint),
        },
      });

      userInfoLog.status = response.status;
      userInfoLog.statusText = response.statusText;

      const responseText = await response.text();
      let responseBody: unknown;
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        responseBody = responseText;
      }

      userInfoLog.data = responseBody;
      userInfoLog.success = response.ok;

      return userInfoLog;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      userInfoLog.success = false;
      userInfoLog.rawError = {
        name: err instanceof Error ? err.name : 'UnknownError',
        message: errorMessage,
      };
      return userInfoLog;
    }
  }
}

export const gamService = new GamService();
