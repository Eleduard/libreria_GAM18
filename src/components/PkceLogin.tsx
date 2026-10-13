import React, { useState, useEffect } from 'react';
import { GamAuthClient, getGamConfigFromEnv } from '../lib';

interface PkceLoginProps {
  onStartLogin?: () => void;
}

export const PkceLogin: React.FC<PkceLoginProps> = () => {
  const envConfig = getGamConfigFromEnv();

  const [clientId, setClientId] = useState<string>(() => {
    return localStorage.getItem('gam_client_id') || envConfig.clientId || '';
  });
  const [publicGamUrl, setPublicGamUrl] = useState<string>(() => {
    return localStorage.getItem('gam_public_url') || envConfig.publicUrl || '';
  });
  const [redirectUri, setRedirectUri] = useState<string>('');
  const [isPreparing, setIsPreparing] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    // Current origin callback
    const computedRedirectUri = envConfig.redirectUri || `${window.location.origin}/oauth/gam/callback`;
    setRedirectUri(computedRedirectUri);
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }
  }, [envConfig.redirectUri]);

  const handleClientIdChange = (value: string) => {
    setClientId(value);
    localStorage.setItem('gam_client_id', value);
  };

  const handlePublicUrlChange = (value: string) => {
    setPublicGamUrl(value);
    localStorage.setItem('gam_public_url', value);
  };

  const startPkceFlow = async (openInNewTab = false) => {
    if (!clientId.trim() || !publicGamUrl.trim()) return;

    setIsPreparing(true);
    try {
      // Uso de la librería @genexus/gam-auth
      const client = new GamAuthClient({
        clientId: clientId.trim(),
        publicUrl: publicGamUrl.trim(),
        redirectUri,
        scope: envConfig.scope,
      });

      const { url } = await client.buildAuthorizeUrl();

      if (openInNewTab) {
        window.open(url, '_blank');
        setIsPreparing(false);
      } else {
        window.location.href = url;
      }
    } catch (err) {
      console.error('Error al iniciar flujo PKCE con la librería:', err);
      setIsPreparing(false);
    }
  };

  return (
    <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl shadow-sm p-6 sm:p-8 space-y-6">
      {isInIframe && (
        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 flex items-start gap-2.5">
          <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1 space-y-1">
            <p className="font-semibold">Recomendado para OAuth y redirecciones de GAM:</p>
            <p className="text-[11px] text-amber-800">
              Estás visualizando la app dentro del panel de AI Studio. Los navegadores aíslan el almacenamiento local (PKCE) de los iframes. Para que la redirección funcione sin pérdidas, abre la app en su pestaña directa:
            </p>
            <a
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-900 underline mt-1 text-xs"
            >
              <span>Abrir aplicación en pestaña completa</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      )}

      <div className="text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 mb-3">
          <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>Librería @genexus/gam-auth • OAuth 2.0 PKCE</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900">Iniciar sesión con GeneXus GAM</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          Flujo oficial de código de autorización con Proof Key for Code Exchange (RFC 7636). Seguro para Single Page Applications (SPA).
        </p>
      </div>

      <div className="space-y-4 text-left">
        {/* GAM Base URL */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            URL Pública de GAM (IDP):
          </label>
          <input
            type="text"
            value={publicGamUrl}
            onChange={(e) => handlePublicUrlChange(e.target.value)}
            placeholder="https://tudominio.com/tudirectoriovitual"
            className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Leída por defecto de <code>VITE_GAM_PUBLIC_URL</code>.
          </p>
        </div>

        {/* Client ID */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Client ID (Application Client ID en GAM):
          </label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => handleClientIdChange(e.target.value)}
            placeholder="Client ID generado por GAM"
            className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Leído por defecto de <code>VITE_GAM_CLIENT_ID</code>.
          </p>
        </div>

        {/* Redirect URI */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Redirect URI (Callback de retorno):
          </label>
          <input
            type="text"
            value={redirectUri}
            readOnly
            className="w-full px-3 py-2 text-xs font-mono bg-slate-100 border border-slate-200 rounded-lg text-slate-600 cursor-not-allowed"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Debe estar registrada en las <em>Callback URLs</em> de la aplicación en la consola de GAM.
          </p>
        </div>

        {/* Garantía de Seguridad PKCE */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900 space-y-1">
          <div className="font-semibold flex items-center gap-1 text-emerald-800">
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>Protección sin Client Secret</span>
          </div>
          <p className="text-[11px] text-emerald-700">
            La librería genera dinámicamente un <code>code_verifier</code> criptográfico y envía su hash SHA-256 (<code>code_challenge</code>) a GAM. Ningún secreto queda expuesto en el cliente.
          </p>
        </div>
      </div>

      {/* Acciones */}
      <div className="space-y-2 pt-2">
        <button
          type="button"
          onClick={() => startPkceFlow(false)}
          disabled={isPreparing || !clientId.trim() || !publicGamUrl.trim()}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isPreparing ? (
            <span>Generando parámetros criptográficos...</span>
          ) : (
            <>
              <span>Iniciar sesión con GAM (PKCE)</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => startPkceFlow(true)}
          disabled={isPreparing || !clientId.trim() || !publicGamUrl.trim()}
          className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-lg transition-colors border border-slate-300 disabled:opacity-50"
        >
          Abrir pantalla de login en nueva pestaña
        </button>
      </div>
    </div>
  );
};
