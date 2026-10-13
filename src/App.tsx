import React, { useState, useEffect } from 'react';
import { LoginForm } from './components/LoginForm';
import { PkceLogin } from './components/PkceLogin';
import { CallbackHandler } from './components/CallbackHandler';
import { DeveloperGuide } from './components/DeveloperGuide';
import { GamAuthProvider } from './lib/react';
import { gamService } from './services/gam/gamService';
import { GamCallExecutionResult, GamUserInfoExecutionResult } from './types/auth';

function MainContent() {
  const [activeTab, setActiveTab] = useState<'pkce' | 'guide' | 'password'>('pkce');
  const [isCallback, setIsCallback] = useState(false);

  // Estados para el flujo directo Password grant
  const [isLoading, setIsLoading] = useState(false);
  const [statusStep, setStatusStep] = useState<string | null>(null);
  const [tokenResult, setTokenResult] = useState<GamCallExecutionResult | null>(null);
  const [userInfoResult, setUserInfoResult] = useState<GamUserInfoExecutionResult | null>(null);

  useEffect(() => {
    // Detectar si la URL actual corresponde a la redirección de callback de GAM
    const pathname = window.location.pathname;
    const search = window.location.search;
    if (pathname.includes('/oauth/gam/callback') || search.includes('code=')) {
      setIsCallback(true);
    }
  }, []);

  const handlePasswordLoginSubmit = async (credentials: {
    username: string;
    password: string;
    clientId: string;
    clientSecret: string;
  }) => {
    setIsLoading(true);
    setTokenResult(null);
    setUserInfoResult(null);
    setStatusStep('Paso 1/2: Solicitando access_token a GAM (/oauth/gam/v2.0/access_token)...');

    try {
      const result = await gamService.requestAccessToken(credentials);
      setTokenResult(result);

      const tokenData = result.data as Record<string, unknown> | undefined;
      const accessToken =
        tokenData && typeof tokenData.access_token === 'string'
          ? tokenData.access_token
          : null;

      if (result.success && accessToken) {
        setStatusStep('Paso 2/2: Obteniendo datos de usuario de GAM (/oauth/gam/v2.0/userinfo)...');
        const userResult = await gamService.getUserInfo(accessToken);
        setUserInfoResult(userResult);
      }
    } finally {
      setIsLoading(false);
      setStatusStep(null);
    }
  };

  const handleResetToHome = () => {
    window.history.replaceState({}, document.title, window.location.origin);
    setIsCallback(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
              GX
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 leading-tight">
                  GeneXus 18 — GAM OAuth 2.0 Auth Library
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-300">
                  @genexus/gam-auth
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Librería desacoplada para React & Node.js + Entorno Interactivo de Pruebas
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={typeof window !== 'undefined' ? window.location.href : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium rounded-lg border border-blue-200 transition-colors"
              title="Abrir en pestaña completa independiente fuera del iframe"
            >
              <span>Abrir en pestaña nueva</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <span className="hidden sm:inline-block text-xs bg-slate-100 text-slate-600 px-2.5 py-1.5 rounded border border-slate-200 font-mono">
              RFC 7636 (PKCE)
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 flex flex-col items-center gap-6">
        {/* Si estamos en la URL de callback tras la redirección de GAM */}
        {isCallback ? (
          <CallbackHandler onReset={handleResetToHome} />
        ) : (
          <>
            {/* Selector de modo / Pestañas */}
            <div className="flex flex-wrap justify-center bg-slate-200 p-1 rounded-xl text-xs font-medium gap-1 shadow-xs">
              <button
                type="button"
                onClick={() => setActiveTab('pkce')}
                className={`px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'pkce'
                    ? 'bg-white text-slate-900 font-semibold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>⚡ Entorno de Prueba PKCE</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('guide')}
                className={`px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'guide'
                    ? 'bg-white text-blue-700 font-semibold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span>📖 Guía de la Librería & Proxy</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('password')}
                className={`px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'password'
                    ? 'bg-white text-slate-900 font-semibold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>🔑 Password Grant (Legacy)</span>
              </button>
            </div>

            {/* Pestaña 1: Entorno de Prueba PKCE */}
            {activeTab === 'pkce' && <PkceLogin />}

            {/* Pestaña 2: Guía para Desarrolladores */}
            {activeTab === 'guide' && <DeveloperGuide />}

            {/* Pestaña 3: Password Grant */}
            {activeTab === 'password' && (
              <div className="w-full flex flex-col items-center gap-6">
                <LoginForm onSubmit={handlePasswordLoginSubmit} isLoading={isLoading} />

                {isLoading && statusStep && (
                  <div className="w-full max-w-2xl bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 flex items-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4 text-blue-600 shrink-0"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span className="font-medium">{statusStep}</span>
                  </div>
                )}

                {userInfoResult && (
                  <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                          Paso 2 / UserInfo
                        </span>
                        <h3 className="font-semibold text-base text-slate-900 flex items-center gap-2 mt-0.5">
                          <span>Información Real del Usuario</span>
                          <span className="text-xs font-mono text-slate-400">
                            ({userInfoResult.timestamp})
                          </span>
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

                    <div>
                      <div className="text-xs font-medium text-slate-600 mb-1">
                        Datos devueltos por GAM (/userinfo):
                      </div>
                      <pre className="bg-slate-900 text-emerald-400 rounded-lg p-3.5 text-xs font-mono overflow-x-auto max-h-80 border border-slate-800">
                        {JSON.stringify(userInfoResult.data ?? userInfoResult.rawError, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {tokenResult && (
                  <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Paso 1 / Access Token
                        </span>
                        <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2 mt-0.5">
                          <span>Resultado de autenticación</span>
                          <span className="text-xs font-mono text-slate-400">
                            ({tokenResult.timestamp})
                          </span>
                        </h3>
                      </div>

                      {tokenResult.success ? (
                        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                          HTTP {tokenResult.status} {tokenResult.statusText || 'OK'}
                        </span>
                      ) : tokenResult.isCorsOrNetworkError ? (
                        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 border border-red-300">
                          Bloqueo de Navegador / CORS
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                          HTTP {tokenResult.status} {tokenResult.statusText || 'Error'}
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="text-xs font-medium text-slate-500 mb-1">Petición enviada:</div>
                      <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs font-mono space-y-1 text-slate-700">
                        <div>
                          <span className="text-slate-400">Endpoint:</span> {tokenResult.endpoint}
                        </div>
                        <div>
                          <span className="text-slate-400">grant_type:</span>{' '}
                          {tokenResult.requestParams.grant_type}
                        </div>
                        <div>
                          <span className="text-slate-400">client_id:</span>{' '}
                          {tokenResult.requestParams.client_id}
                        </div>
                        <div>
                          <span className="text-slate-400">scope:</span>{' '}
                          {tokenResult.requestParams.scope}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-medium text-slate-500 mb-1">
                        Respuesta de GAM:
                      </div>
                      <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 text-xs font-mono overflow-x-auto max-h-60">
                        {JSON.stringify(tokenResult.data ?? tokenResult.rawError, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 px-6 py-4 text-center text-xs text-slate-400">
        GeneXus Access Manager (GAM 18) • Librería Universal @genexus/gam-auth • RFC 7636 PKCE
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <GamAuthProvider>
      <MainContent />
    </GamAuthProvider>
  );
}
