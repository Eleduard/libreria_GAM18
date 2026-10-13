import React, { useState } from 'react';
import { getGamConfigFromEnv } from '../lib';
import { LoginCredentials } from '../types/auth';

interface LoginFormProps {
  onSubmit: (credentials: {
    username: string;
    password: string;
    clientId: string;
    clientSecret: string;
  }) => void;
  isLoading?: boolean;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSubmit, isLoading = false }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showConfig, setShowConfig] = useState(true);
  const envConfig = getGamConfigFromEnv();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!username.trim() || !password || !clientId.trim() || !clientSecret.trim()) {
      return;
    }
    onSubmit({
      username: username.trim(),
      password,
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
    });
  };

  const isFormValid =
    username.trim().length > 0 &&
    password.length > 0 &&
    clientId.trim().length > 0 &&
    clientSecret.trim().length > 0;

  return (
    <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-sm p-6 sm:p-8">
      <div className="mb-6 text-center">
        <h2 className="text-xl font-bold text-slate-900">Autenticación OAuth 2.0 GAM</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Petición directa desde el navegador (sin backend intermediario)
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Credenciales de Aplicación GAM */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Credenciales de Aplicación en GAM
            </span>
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              {showConfig ? 'Ocultar campos' : 'Mostrar campos'}
            </button>
          </div>

          {showConfig && (
            <div className="space-y-3 pt-1">
              <div>
                <label
                  htmlFor="clientId"
                  className="block text-xs font-medium text-slate-600 mb-1"
                >
                  Client ID <span className="text-red-500">*</span>
                </label>
                <input
                  id="clientId"
                  name="clientId"
                  type="text"
                  required
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  disabled={isLoading}
                  placeholder="Ingrese el Client ID configurado en GAM"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label
                  htmlFor="clientSecret"
                  className="block text-xs font-medium text-slate-600 mb-1"
                >
                  Client Secret <span className="text-red-500">*</span>
                </label>
                <input
                  id="clientSecret"
                  name="clientSecret"
                  type="password"
                  required
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  disabled={isLoading}
                  placeholder="Ingrese el Client Secret configurado en GAM"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                />
              </div>

              <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 leading-relaxed">
                <strong>Advertencia de arquitectura:</strong> En un cliente SPA (browser-only),
                el <code className="font-mono font-semibold">client_secret</code> se transmite
                directamente desde el navegador del usuario y queda expuesto. Se utiliza aquí para
                validar técnicamente si el endpoint de GAM permite la llamada directa.
              </div>
            </div>
          )}
        </div>

        {/* Credenciales de Usuario */}
        <div>
          <label
            htmlFor="username"
            className="block text-xs font-medium text-slate-700 mb-1"
          >
            Usuario GAM <span className="text-red-500">*</span>
          </label>
          <input
            id="username"
            name="username"
            type="text"
            required
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isLoading}
            placeholder="Usuario de GAM"
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-50"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-xs font-medium text-slate-700 mb-1"
          >
            Contraseña <span className="text-red-500">*</span>
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            placeholder="Contraseña"
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !isFormValid}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin h-4 w-4 text-white"
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
              <span>Enviando POST a GAM...</span>
            </>
          ) : (
            <span>Ingresar</span>
          )}
        </button>
      </form>

      <div className="mt-5 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex flex-col gap-1">
        <div>
          <span className="font-semibold text-slate-600">Endpoint dev (proxy):</span>{' '}
          <span className="font-mono text-slate-700">{`${envConfig.baseUrl}/oauth/gam/v2.0/access_token`}</span>
        </div>
        <div>
          <span className="font-semibold text-slate-600">grant_type:</span>{' '}
          <span className="font-mono text-slate-700">password</span> |{' '}
          <span className="font-semibold text-slate-600">scope:</span>{' '}
          <span className="font-mono text-slate-700">{envConfig.scope}</span>
        </div>
      </div>
    </div>
  );
};
