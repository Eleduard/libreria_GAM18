import React, { useEffect, useState } from 'react';
import { GamAuthClient, getGamConfigFromEnv, GamExecutionResult, GamTokenResponse, GamUserInfo } from '../lib';

interface CallbackHandlerProps {
  onReset: () => void;
}

export const CallbackHandler: React.FC<CallbackHandlerProps> = ({ onReset }) => {
  const envConfig = getGamConfigFromEnv();

  const [isProcessing, setIsProcessing] = useState(true);
  const [stepMessage, setStepMessage] = useState('Procesando respuesta de redirección de GAM con la librería...');
  const [authCode, setAuthCode] = useState<string | null>(null);
  const [stateReceived, setStateReceived] = useState<string | null>(null);
  const [stateMismatchError, setStateMismatchError] = useState<string | null>(null);
  const [exchangeResult, setExchangeResult] = useState<GamExecutionResult<GamTokenResponse> | null>(null);
  const [userInfoResult, setUserInfoResult] = useState<GamExecutionResult<GamUserInfo> | null>(null);

  // Parámetros editables para reintentos inmediatos
  const [clientId, setClientId] = useState<string>('');
  const [codeVerifier, setCodeVerifier] = useState<string>('');
  const [redirectUri, setRedirectUri] = useState<string>('');
  const [tokenEndpointUrl, setTokenEndpointUrl] = useState<string>('');
  const [endpointMode, setEndpointMode] = useState<'/oauth/gam/access_token' | '/oauth/gam/v2.0/access_token'>(
    '/oauth/gam/access_token'
  );

  const executeTokenExchange = async (
    targetClientId: string,
    targetCode: string,
    targetVerifier: string,
    targetRedirectUri: string,
    targetEndpointUrl: string
  ) => {
    setIsProcessing(true);
    setStepMessage(`Canjeando authorization_code por access_token en ${targetEndpointUrl}...`);

    const client = new GamAuthClient({
      clientId: targetClientId,
      baseUrl: envConfig.baseUrl,
      redirectUri: targetRedirectUri,
    });

    const tokenResult = await client.exchangeCodeForToken({
      clientId: targetClientId,
      code: targetCode,
      codeVerifier: targetVerifier,
      redirectUri: targetRedirectUri,
      endpointUrl: targetEndpointUrl,
    });
    setExchangeResult(tokenResult);

    const tokenData = tokenResult.data;
    const accessToken =
      tokenData && typeof tokenData.access_token === 'string'
        ? tokenData.access_token
        : null;

    if (tokenResult.success && accessToken) {
      // Deducir endpoint de userinfo
      const userInfoUrl = targetEndpointUrl.includes('v2.0')
        ? targetEndpointUrl.replace('/oauth/gam/v2.0/access_token', '/oauth/gam/v2.0/userinfo')
        : targetEndpointUrl.replace('/oauth/gam/access_token', '/oauth/gam/userinfo');

      setStepMessage(`Obteniendo información del usuario (${userInfoUrl})...`);
      const userResult = await client.getUserInfo(accessToken, { endpointUrl: userInfoUrl });
      setUserInfoResult(userResult);
    }

    setIsProcessing(false);
    setStepMessage('Proceso de autenticación completado.');
  };

  useEffect(() => {
    const processCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');
      const errorDescription = urlParams.get('error_description');

      setAuthCode(code);
      setStateReceived(state);

      if (error) {
        setIsProcessing(false);
        setStepMessage(`GAM retornó un error: ${error} - ${errorDescription || ''}`);
        return;
      }

      if (!code) {
        setIsProcessing(false);
        setStepMessage('No se encontró el parámetro "code" en la URL de retorno.');
        return;
      }

      const client = new GamAuthClient();
      const storedSession = await client.getStoredPkceSession();

      if (storedSession?.state && state && storedSession.state !== state) {
        setStateMismatchError(
          `Discrepancia en parámetro 'state': esperado '${storedSession.state}', recibido '${state}'. Posible ataque CSRF.`
        );
        setIsProcessing(false);
        return;
      }

      const foundVerifier = storedSession?.verifier || '';
      const foundClientId = storedSession?.clientId || envConfig.clientId || '';
      const foundRedirectUri =
        storedSession?.redirectUri ||
        envConfig.redirectUri ||
        `${window.location.origin}/oauth/gam/callback`;

      setCodeVerifier(foundVerifier);
      setClientId(foundClientId);
      setRedirectUri(foundRedirectUri);

      if (!foundVerifier) {
        setIsProcessing(false);
        setStateMismatchError(
          'No se encontró el "code_verifier" en el almacenamiento local. Si abriste la app en pestaña separada o ventana de incógnito, inicia el login desde esa misma pestaña.'
        );
        return;
      }

      // Determinar la URL del endpoint
      // Si la URL pública configurada tiene directorio virtual (ej: /Login_GAM_LeoNETSQLServer):
      let virtualDirectory = '';
      if (storedSession?.publicUrl) {
        try {
          const parsed = new URL(storedSession.publicUrl);
          virtualDirectory = parsed.pathname.replace(/\/+$/, '');
        } catch {
          // Si no es URL absoluta
          if (storedSession.publicUrl.startsWith('/')) {
            virtualDirectory = storedSession.publicUrl.replace(/\/+$/, '');
          }
        }
      }

      // Base URL a usar (por defecto el proxy /api-gam con el directorio virtual)
      const base = (storedSession?.baseUrl || envConfig.baseUrl || '/api-gam').replace(/\/+$/, '');
      const fullBaseWithDir = virtualDirectory && !base.includes(virtualDirectory)
        ? `${base}${virtualDirectory}`
        : base;

      const initialTokenUrl = `${fullBaseWithDir}/oauth/gam/access_token`;
      setTokenEndpointUrl(initialTokenUrl);

      // Canjear con el endpoint computado
      await executeTokenExchange(
        foundClientId,
        code,
        foundVerifier,
        foundRedirectUri,
        initialTokenUrl
      );
    };

    processCallback();
  }, []);

  const handleManualRetry = () => {
    if (!authCode || !clientId.trim() || !codeVerifier.trim()) return;
    executeTokenExchange(
      clientId.trim(),
      authCode,
      codeVerifier.trim(),
      redirectUri.trim(),
      tokenEndpointUrl.trim()
    );
  };

  return (
    <div className="w-full max-w-3xl space-y-6">
      {/* Encabezado del Callback */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${isProcessing ? 'bg-blue-600 animate-pulse' : 'bg-emerald-500'}`}></span>
            <h2 className="text-lg font-bold text-slate-900">
              Procesamiento de Callback OAuth 2.0 (PKCE)
            </h2>
          </div>
          <button
            onClick={onReset}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg border border-slate-300 transition-colors"
          >
            ← Volver al inicio
          </button>
        </div>

        <p className="text-xs text-slate-500 mt-1">{stepMessage}</p>

        {/* Parámetros recibidos en la URL */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <div className="text-xs font-semibold text-slate-700 mb-1">
            Parámetros recibidos de GAM en la URL:
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded p-2.5 text-xs font-mono text-slate-700 space-y-1">
            <div>
              <span className="text-slate-400">code:</span>{' '}
              <span className="text-emerald-700 break-all">{authCode || 'No recibido'}</span>
            </div>
            <div>
              <span className="text-slate-400">state:</span>{' '}
              <span className="text-slate-600 break-all">{stateReceived || 'No recibido'}</span>
            </div>
          </div>
        </div>

        {stateMismatchError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800">
            <strong>Atención:</strong> {stateMismatchError}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* PASO 3: INFORMACIÓN REAL DEL USUARIO (/userinfo)               */}
      {/* ============================================================== */}
      {userInfoResult && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                Paso 3 / UserInfo
              </span>
              <h3 className="font-semibold text-base text-slate-900 flex items-center gap-2 mt-0.5">
                <span>Información Real del Usuario</span>
              </h3>
            </div>

            {userInfoResult.success ? (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                HTTP {userInfoResult.status} {userInfoResult.statusText || 'OK'}
              </span>
            ) : (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                HTTP {userInfoResult.status} {userInfoResult.statusText || 'Error'}
              </span>
            )}
          </div>

          <div className="text-xs text-slate-500">
            <span className="font-medium">Endpoint consultado:</span>{' '}
            <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-700">
              {userInfoResult.endpoint}
            </code>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-600 mb-1">
              {userInfoResult.success
                ? 'Datos devueltos por GAM para el usuario autenticado:'
                : 'Detalle del error en /userinfo:'}
            </div>
            <pre className="bg-slate-900 text-emerald-400 rounded-lg p-3.5 text-xs font-mono overflow-x-auto max-h-80 border border-slate-800">
              {JSON.stringify(userInfoResult.data ?? userInfoResult.rawError, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* PASO 2: CANJE DE CODE POR ACCESS_TOKEN (PKCE)                  */}
      {/* ============================================================== */}
      {exchangeResult && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Paso 2 / Canje de Código con PKCE
              </span>
              <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2 mt-0.5">
                <span>POST {exchangeResult.endpoint}</span>
              </h3>
            </div>

            {exchangeResult.success ? (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                HTTP {exchangeResult.status} {exchangeResult.statusText || 'OK'}
              </span>
            ) : exchangeResult.status === 502 ? (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                HTTP 502 / Host GAM No Alcanzable
              </span>
            ) : exchangeResult.isNetworkError ? (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 border border-red-300">
                Error de Red
              </span>
            ) : (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                HTTP {exchangeResult.status} {exchangeResult.statusText || 'Error'}
              </span>
            )}
          </div>

          {/* Parámetros enviados en el canje */}
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">Parámetros enviados en el POST:</div>
            <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs font-mono space-y-1 text-slate-700">
              <div><span className="text-slate-400">Endpoint:</span> {exchangeResult.endpoint}</div>
              <div><span className="text-slate-400">grant_type:</span> authorization_code</div>
              <div><span className="text-slate-400">client_id:</span> {clientId}</div>
              <div><span className="text-slate-400">code:</span> {authCode}</div>
              <div><span className="text-slate-400">redirect_uri:</span> {redirectUri}</div>
              <div><span className="text-slate-400">code_verifier:</span> {codeVerifier}</div>
              <div className="text-emerald-700 font-semibold pt-1">
                ✓ client_secret: No enviado (Garantizado por PKCE)
              </div>
            </div>
          </div>

          {/* Respuesta real devuelta por el servidor */}
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">
              {exchangeResult.success ? 'Respuesta de token devuelta por GAM:' : 'Detalle de respuesta devuelta por el servidor:'}
            </div>
            <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 text-xs font-mono overflow-x-auto max-h-60">
              {JSON.stringify(exchangeResult.data ?? exchangeResult.rawError, null, 2)}
            </pre>
          </div>

          {/* Panel para reintentar o ajustar parámetros */}
          {!exchangeResult.success && (
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Ajustar Endpoint y Reintentar Canje</span>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    URL Completa del Endpoint de Token:
                  </label>
                  <input
                    type="text"
                    value={tokenEndpointUrl}
                    onChange={(e) => setTokenEndpointUrl(e.target.value)}
                    placeholder="/api-gam/Login_GAM_LeoNETSQLServer/oauth/gam/access_token"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded font-mono text-xs focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Puedes usar el proxy (ej: <code>/api-gam/TuDirectorio/oauth/gam/access_token</code>) o una URL completa.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                      Client ID:
                    </label>
                    <input
                      type="text"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                      Ruta GAM Rápida:
                    </label>
                    <select
                      value={endpointMode}
                      onChange={(e) => {
                        const mode = e.target.value as any;
                        setEndpointMode(mode);
                        setTokenEndpointUrl((prev) => {
                          if (mode.includes('v2.0')) {
                            return prev.replace('/oauth/gam/access_token', '/oauth/gam/v2.0/access_token');
                          }
                          return prev.replace('/oauth/gam/v2.0/access_token', '/oauth/gam/access_token');
                        });
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded font-mono text-xs"
                    >
                      <option value="/oauth/gam/access_token">/oauth/gam/access_token (Estándar IDP OAuth)</option>
                      <option value="/oauth/gam/v2.0/access_token">/oauth/gam/v2.0/access_token (Mobile REST v2.0)</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleManualRetry}
                disabled={isProcessing || !tokenEndpointUrl.trim()}
                className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded transition-colors disabled:opacity-50"
              >
                {isProcessing ? 'Canjeando...' : 'Reintentar canje ahora'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
