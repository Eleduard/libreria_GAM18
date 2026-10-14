import {
  GamAuthorizeUrlParams,
  GamConfig,
  GamEndpoints,
  GamExecutionResult,
  GamPkceSession,
  GamStorage,
  GamTokenExchangeParams,
  GamTokenResponse,
  GamUserInfo,
} from './types';
import { generateCodeChallenge, generateCodeVerifier, generateState } from './pkce';
import { getDefaultStorage } from './storage';
import { getGamConfigFromEnv } from './env';

const DEFAULT_ENDPOINTS: Required<GamEndpoints> = {
  signin: '/oauth/gam/signin',
  token: '/oauth/gam/access_token',
  tokenV2: '/oauth/gam/v2.0/access_token',
  userInfo: '/oauth/gam/userinfo',
  userInfoV2: '/oauth/gam/v2.0/userinfo',
};

const STORAGE_KEY_VERIFIER = 'gam_pkce_verifier';
const STORAGE_KEY_STATE = 'gam_pkce_state';
const STORAGE_KEY_CLIENT_ID = 'gam_pkce_client_id';
const STORAGE_KEY_REDIRECT_URI = 'gam_pkce_redirect_uri';
const STORAGE_KEY_TIMESTAMP = 'gam_pkce_timestamp';

/**
 * Cliente principal agnóstico de autenticación para GeneXus Access Manager (GAM 18).
 * Funciona en navegadores web y en entornos Node.js (con Web Fetch nativo).
 */
export class GamAuthClient {
  private config: GamConfig;
  private storage: GamStorage;

  constructor(userConfig?: Partial<GamConfig>) {
    const envConfig = getGamConfigFromEnv();
    const mergedConfig: GamConfig = {
      baseUrl: (userConfig?.baseUrl || envConfig.baseUrl || '').replace(/\/+$/, ''),
      publicUrl: (userConfig?.publicUrl || envConfig.publicUrl || userConfig?.baseUrl || envConfig.baseUrl || '').replace(/\/+$/, ''),
      clientId: userConfig?.clientId || envConfig.clientId || '',
      clientSecret: userConfig?.clientSecret || envConfig.clientSecret,
      redirectUri: userConfig?.redirectUri || envConfig.redirectUri || '',
      scope: userConfig?.scope || envConfig.scope || 'gam_user_data+gam_user_roles',
      endpoints: {
        ...DEFAULT_ENDPOINTS,
        ...(envConfig.endpoints || {}),
        ...(userConfig?.endpoints || {}),
      },
      storage: userConfig?.storage || getDefaultStorage(),
    };

    this.config = mergedConfig;
    this.storage = mergedConfig.storage || getDefaultStorage();
  }

  public getConfig(): Readonly<GamConfig> {
    return { ...this.config };
  }

  public setConfig(patch: Partial<GamConfig>): void {
    this.config = {
      ...this.config,
      ...patch,
      baseUrl: patch.baseUrl ? patch.baseUrl.replace(/\/+$/, '') : this.config.baseUrl,
      publicUrl: patch.publicUrl ? patch.publicUrl.replace(/\/+$/, '') : this.config.publicUrl,
      endpoints: {
        ...this.config.endpoints,
        ...(patch.endpoints || {}),
      },
    };
    if (patch.storage) {
      this.storage = patch.storage;
    }
  }

  /**
   * Construye la URL de inicio de sesión con PKCE (RFC 7636) y almacena
   * automáticamente el code_verifier y state para el retorno posterior.
   */
  public async buildAuthorizeUrl(
    params?: Partial<GamAuthorizeUrlParams>
  ): Promise<{ url: string; codeVerifier: string; state: string; codeChallenge: string }> {
    const clientId = params?.clientId || this.config.clientId;
    if (!clientId) {
      throw new Error('GamAuthClient: Se requiere "clientId" para construir la URL de autorización.');
    }

    const redirectUri = params?.redirectUri || this.config.redirectUri;
    if (!redirectUri) {
      throw new Error('GamAuthClient: Se requiere "redirectUri" para la redirección de GAM.');
    }

    const scope = params?.scope || this.config.scope || 'gam_user_data+gam_user_roles';
    const state = params?.state || generateState(32);
    const codeVerifier = generateCodeVerifier(64);
    const codeChallenge = params?.codeChallenge || (await generateCodeChallenge(codeVerifier));

    // Guardar sesión PKCE en el storage configurado
    await this.savePkceSession({
      verifier: codeVerifier,
      state,
      clientId,
      redirectUri,
      publicUrl: this.config.publicUrl,
      baseUrl: this.config.baseUrl,
      createdAt: new Date().toISOString(),
    });

    const publicBase = (this.config.publicUrl || this.config.baseUrl).replace(/\/+$/, '');
    const signinPath = this.config.endpoints?.signin || DEFAULT_ENDPOINTS.signin;

    const authUrl = new URL(`${publicBase}${signinPath}`);
    authUrl.searchParams.set('response_type', params?.responseType || 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('state', state);

    if (scope) {
      authUrl.searchParams.set('scope', scope);
    }

    if (params?.additionalParams) {
      for (const [key, value] of Object.entries(params.additionalParams)) {
        authUrl.searchParams.set(key, value);
      }
    }

    return {
      url: authUrl.toString(),
      codeVerifier,
      state,
      codeChallenge,
    };
  }

  /**
   * Resuelve el endpoint para enrutarlo transparentemente a través del proxy local (/api-gam)
   * si se ejecuta en un navegador web, evitando así cualquier restricción de CORS.
   */
  public resolveProxyEndpoint(rawEndpoint: string): { url: string; headers: Record<string, string> } {
    const headers: Record<string, string> = {};
    let url = rawEndpoint;

    if (typeof window !== 'undefined') {
      if (rawEndpoint.startsWith('http://') || rawEndpoint.startsWith('https://')) {
        try {
          const parsed = new URL(rawEndpoint);
          if (parsed.origin !== window.location.origin) {
            url = `/api-gam${parsed.pathname}${parsed.search}`;
            headers['x-gam-target'] = parsed.origin;
          }
        } catch {
          // Si no es URL válida, mantener original
        }
      } else if (rawEndpoint.startsWith('/api-gam')) {
        const target =
          this.config.publicUrl ||
          (typeof localStorage !== 'undefined' ? localStorage.getItem('gam_public_url') || '' : '');
        if (target) {
          try {
            headers['x-gam-target'] = new URL(target).origin;
          } catch {
            // fallback
          }
        }
      }
    }

    return { url, headers };
  }

  /**
   * Canjea el authorization_code devuelto por GAM por un access_token usando PKCE (sin client_secret).
   * Si no se especifica codeVerifier, lo recupera automáticamente del almacenamiento.
   */
  public async exchangeCodeForToken(
    params: GamTokenExchangeParams
  ): Promise<GamExecutionResult<GamTokenResponse>> {
    const clientId = params.clientId || this.config.clientId;
    const redirectUri = params.redirectUri || this.config.redirectUri || '';

    // Recuperar code_verifier si no viene explícito
    let verifier = params.codeVerifier;
    if (!verifier) {
      const stored = await this.getStoredPkceSession();
      verifier = stored?.verifier || '';
    }

    if (!verifier) {
      return {
        success: false,
        endpoint: '',
        rawError: {
          name: 'MissingCodeVerifierError',
          message: 'No se encontró el code_verifier en los parámetros ni en el almacenamiento local.',
        },
      };
    }

    const tokenPath = this.config.endpoints?.token || DEFAULT_ENDPOINTS.token;
    const rawEndpoint = params.endpointUrl || `${this.config.baseUrl}${tokenPath}`;
    const { url: endpoint, headers: proxyHeaders } = this.resolveProxyEndpoint(rawEndpoint);

    const bodyParams = new URLSearchParams();
    bodyParams.append('grant_type', 'authorization_code');
    bodyParams.append('client_id', clientId);
    bodyParams.append('code', params.code);
    bodyParams.append('redirect_uri', redirectUri);
    bodyParams.append('code_verifier', verifier);

    // Si se configuró clientSecret (por ejemplo en un backend Node.js confidencial):
    const secret = params.clientSecret || this.config.clientSecret;
    if (secret) {
      bodyParams.append('client_secret', secret);
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...proxyHeaders,
        },
        body: bodyParams.toString(),
      });

      const responseText = await response.text();
      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { rawResponse: responseText };
      }

      const isSuccess = response.ok && !responseData?.error && !responseData?.Code;

      return {
        success: isSuccess,
        status: response.status,
        statusText: response.statusText,
        endpoint,
        data: responseData as GamTokenResponse,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isNetwork =
        err instanceof TypeError ||
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('NetworkError');

      return {
        success: false,
        endpoint,
        isNetworkError: isNetwork,
        rawError: {
          name: err instanceof Error ? err.name : 'UnknownError',
          message: errorMessage,
        },
      };
    }
  }

  /**
   * Obtiene la información del usuario autenticado consultando el endpoint /userinfo con el Bearer token.
   */
  public async getUserInfo(
    accessToken: string,
    options?: { endpointUrl?: string }
  ): Promise<GamExecutionResult<GamUserInfo>> {
    const userInfoPath = this.config.endpoints?.userInfo || DEFAULT_ENDPOINTS.userInfo;
    const rawEndpoint = options?.endpointUrl || `${this.config.baseUrl}${userInfoPath}`;
    const { url: endpoint, headers: proxyHeaders } = this.resolveProxyEndpoint(rawEndpoint);

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${accessToken}`,
          ...proxyHeaders,
        },
      });

      const responseText = await response.text();
      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { rawResponse: responseText };
      }

      // Normalizar atributos de usuario para garantizar compatibilidad total
      // GeneXus GAM retorna 'username' de forma nativa
      let normalizedData: GamUserInfo | undefined;
      if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
        const resolvedUsername =
          responseData.username ||
          responseData.user_name ||
          responseData.user ||
          undefined;

        normalizedData = {
          ...responseData,
          username: resolvedUsername,
          user_name: resolvedUsername,
        };
      } else {
        normalizedData = responseData as GamUserInfo;
      }

      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        endpoint,
        data: normalizedData,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        endpoint,
        rawError: {
          name: err instanceof Error ? err.name : 'UnknownError',
          message: errorMessage,
        },
      };
    }
  }

  /**
   * Renueva el access_token utilizando el refresh_token provisto por GAM.
   */
  public async refreshAccessToken(
    refreshToken: string,
    options?: { endpointUrl?: string }
  ): Promise<GamExecutionResult<GamTokenResponse>> {
    const tokenPath = this.config.endpoints?.token || DEFAULT_ENDPOINTS.token;
    const rawEndpoint = options?.endpointUrl || `${this.config.baseUrl}${tokenPath}`;
    const { url: endpoint, headers: proxyHeaders } = this.resolveProxyEndpoint(rawEndpoint);

    const bodyParams = new URLSearchParams();
    bodyParams.append('grant_type', 'refresh_token');
    bodyParams.append('client_id', this.config.clientId);
    bodyParams.append('refresh_token', refreshToken);

    if (this.config.clientSecret) {
      bodyParams.append('client_secret', this.config.clientSecret);
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...proxyHeaders,
        },
        body: bodyParams.toString(),
      });

      const responseText = await response.text();
      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { rawResponse: responseText };
      }

      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        endpoint,
        data: responseData as GamTokenResponse,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        endpoint,
        rawError: {
          name: err instanceof Error ? err.name : 'UnknownError',
          message: errorMessage,
        },
      };
    }
  }

  public async savePkceSession(session: GamPkceSession): Promise<void> {
    await this.storage.setItem(STORAGE_KEY_VERIFIER, session.verifier);
    await this.storage.setItem(STORAGE_KEY_STATE, session.state);
    await this.storage.setItem(STORAGE_KEY_CLIENT_ID, session.clientId);
    await this.storage.setItem(STORAGE_KEY_REDIRECT_URI, session.redirectUri);
    if (session.publicUrl) await this.storage.setItem('gam_pkce_public_url', session.publicUrl);
    if (session.baseUrl) await this.storage.setItem('gam_pkce_base_url', session.baseUrl);
    await this.storage.setItem(STORAGE_KEY_TIMESTAMP, session.createdAt);
  }

  public async getStoredPkceSession(): Promise<GamPkceSession | null> {
    const verifier = await this.storage.getItem(STORAGE_KEY_VERIFIER);
    const state = await this.storage.getItem(STORAGE_KEY_STATE);
    const clientId = await this.storage.getItem(STORAGE_KEY_CLIENT_ID);
    const redirectUri = await this.storage.getItem(STORAGE_KEY_REDIRECT_URI);
    const publicUrl = await this.storage.getItem('gam_pkce_public_url');
    const baseUrl = await this.storage.getItem('gam_pkce_base_url');
    const createdAt = await this.storage.getItem(STORAGE_KEY_TIMESTAMP);

    if (!verifier) return null;

    return {
      verifier,
      state: state || '',
      clientId: clientId || this.config.clientId,
      redirectUri: redirectUri || this.config.redirectUri || '',
      publicUrl: publicUrl || this.config.publicUrl,
      baseUrl: baseUrl || this.config.baseUrl,
      createdAt: createdAt || new Date().toISOString(),
    };
  }

  public async clearPkceSession(): Promise<void> {
    await this.storage.removeItem(STORAGE_KEY_VERIFIER);
    await this.storage.removeItem(STORAGE_KEY_STATE);
    await this.storage.removeItem(STORAGE_KEY_CLIENT_ID);
    await this.storage.removeItem(STORAGE_KEY_REDIRECT_URI);
    await this.storage.removeItem('gam_pkce_public_url');
    await this.storage.removeItem('gam_pkce_base_url');
    await this.storage.removeItem(STORAGE_KEY_TIMESTAMP);
  }
}
