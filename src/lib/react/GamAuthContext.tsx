import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { GamAuthClient } from '../core/GamAuthClient';
import {
  GamAuthorizeUrlParams,
  GamConfig,
  GamExecutionResult,
  GamTokenResponse,
  GamUserInfo,
} from '../core/types';

export interface GamAuthContextValue {
  client: GamAuthClient;
  isAuthenticated: boolean;
  isLoading: boolean;
  user: GamUserInfo | null;
  tokens: GamTokenResponse | null;
  error: string | null;
  loginWithRedirect: (params?: Partial<GamAuthorizeUrlParams>, openInNewTab?: boolean) => Promise<void>;
  handleRedirectCallback: (customUrl?: string) => Promise<{
    tokenResult: GamExecutionResult<GamTokenResponse>;
    userResult?: GamExecutionResult<GamUserInfo>;
  }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

const GamAuthContext = createContext<GamAuthContextValue | null>(null);

export interface GamAuthProviderProps {
  children: ReactNode;
  config?: Partial<GamConfig>;
  client?: GamAuthClient;
  /** Si es true, sincroniza sesión con localStorage para persistir entre recargas */
  persistSession?: boolean;
}

const STORAGE_SESSION_TOKEN = 'gam_access_token';
const STORAGE_SESSION_USER = 'gam_user_info';
const STORAGE_SESSION_REFRESH = 'gam_refresh_token';

export const GamAuthProvider: React.FC<GamAuthProviderProps> = ({
  children,
  config,
  client: providedClient,
  persistSession = true,
}) => {
  const client = useMemo(() => {
    return providedClient || new GamAuthClient(config);
  }, [providedClient, config]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [tokens, setTokens] = useState<GamTokenResponse | null>(null);
  const [user, setUser] = useState<GamUserInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Inicializar sesión desde almacenamiento si está disponible
  useEffect(() => {
    const init = async () => {
      try {
        if (persistSession && typeof window !== 'undefined') {
          const savedToken = localStorage.getItem(STORAGE_SESSION_TOKEN);
          const savedUser = localStorage.getItem(STORAGE_SESSION_USER);
          const savedRefresh = localStorage.getItem(STORAGE_SESSION_REFRESH);

          if (savedToken) {
            setTokens({
              access_token: savedToken,
              refresh_token: savedRefresh || undefined,
            });
            if (savedUser) {
              try {
                setUser(JSON.parse(savedUser));
              } catch {
                // Ignorar parse error
              }
            }
          }
        }
      } catch (err) {
        console.error('Error al inicializar sesión de GAM:', err);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [persistSession]);

  const loginWithRedirect = useCallback(
    async (params?: Partial<GamAuthorizeUrlParams>, openInNewTab = false) => {
      setError(null);
      try {
        const { url } = await client.buildAuthorizeUrl(params);
        if (openInNewTab && typeof window !== 'undefined') {
          window.open(url, '_blank');
        } else if (typeof window !== 'undefined') {
          window.location.href = url;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
      }
    },
    [client]
  );

  const handleRedirectCallback = useCallback(
    async (customUrl?: string) => {
      setIsLoading(true);
      setError(null);

      const targetUrl = customUrl || (typeof window !== 'undefined' ? window.location.href : '');
      const parsed = new URL(targetUrl, 'http://localhost');
      const code = parsed.searchParams.get('code');
      const state = parsed.searchParams.get('state');
      const errorParam = parsed.searchParams.get('error');
      const errorDesc = parsed.searchParams.get('error_description');

      if (errorParam) {
        const msg = `GAM Error: ${errorParam} - ${errorDesc || ''}`;
        setError(msg);
        setIsLoading(false);
        throw new Error(msg);
      }

      if (!code) {
        const msg = 'No se encontró el parámetro "code" en la URL de retorno.';
        setError(msg);
        setIsLoading(false);
        throw new Error(msg);
      }

      const storedSession = await client.getStoredPkceSession();
      if (storedSession?.state && state && storedSession.state !== state) {
        const msg = `Discrepancia en el parámetro 'state'. Posible ataque CSRF.`;
        setError(msg);
        setIsLoading(false);
        throw new Error(msg);
      }

      // 1. Canjear código por tokens usando PKCE
      const tokenResult = await client.exchangeCodeForToken({
        code,
        codeVerifier: storedSession?.verifier || '',
        redirectUri: storedSession?.redirectUri,
        clientId: storedSession?.clientId,
      });

      if (!tokenResult.success || !tokenResult.data?.access_token) {
        const errorMsg =
          tokenResult.data && typeof tokenResult.data === 'object' && 'Message' in tokenResult.data
            ? String((tokenResult.data as any).Message)
            : tokenResult.rawError?.message || 'Error al canjear el código de autorización.';
        setError(errorMsg);
        setIsLoading(false);
        return { tokenResult };
      }

      const tokenData = tokenResult.data;
      setTokens(tokenData);

      if (persistSession && typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_SESSION_TOKEN, tokenData.access_token);
        if (tokenData.refresh_token) {
          localStorage.setItem(STORAGE_SESSION_REFRESH, tokenData.refresh_token);
        }
      }

      // 2. Consultar UserInfo
      let userResult: GamExecutionResult<GamUserInfo> | undefined;
      try {
        userResult = await client.getUserInfo(tokenData.access_token);
        if (userResult.success && userResult.data) {
          setUser(userResult.data);
          if (persistSession && typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_SESSION_USER, JSON.stringify(userResult.data));
          }
        }
      } catch (err) {
        console.warn('Advertencia al consultar /userinfo:', err);
      }

      // Limpiar datos temporales de PKCE
      await client.clearPkceSession();

      setIsLoading(false);
      return { tokenResult, userResult };
    },
    [client, persistSession]
  );

  const logout = useCallback(async () => {
    setTokens(null);
    setUser(null);
    setError(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_SESSION_TOKEN);
      localStorage.removeItem(STORAGE_SESSION_USER);
      localStorage.removeItem(STORAGE_SESSION_REFRESH);
    }
    await client.clearPkceSession();
  }, [client]);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (!tokens?.refresh_token) return false;
    setIsLoading(true);
    try {
      const res = await client.refreshAccessToken(tokens.refresh_token);
      if (res.success && res.data?.access_token) {
        const refreshedToken = res.data;
        setTokens((prev) => ({
          ...(prev || {}),
          ...refreshedToken,
          access_token: refreshedToken.access_token,
        }));
        if (persistSession && typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_SESSION_TOKEN, res.data.access_token);
          if (res.data.refresh_token) {
            localStorage.setItem(STORAGE_SESSION_REFRESH, res.data.refresh_token);
          }
        }
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [client, tokens?.refresh_token, persistSession]);

  const value = useMemo<GamAuthContextValue>(() => {
    return {
      client,
      isAuthenticated: !!tokens?.access_token,
      isLoading,
      user,
      tokens,
      error,
      loginWithRedirect,
      handleRedirectCallback,
      logout,
      refreshSession,
    };
  }, [
    client,
    tokens,
    isLoading,
    user,
    error,
    loginWithRedirect,
    handleRedirectCallback,
    logout,
    refreshSession,
  ]);

  return <GamAuthContext.Provider value={value}>{children}</GamAuthContext.Provider>;
};

export function useGamAuth(): GamAuthContextValue {
  const ctx = useContext(GamAuthContext);
  if (!ctx) {
    throw new Error('useGamAuth debe utilizarse dentro de un <GamAuthProvider>');
  }
  return ctx;
}
