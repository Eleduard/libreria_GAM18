import React, { useState } from 'react';
import { getGamConfigFromEnv } from '../lib';

export const DeveloperGuide: React.FC = () => {
  const [activeSnippetTab, setActiveSnippetTab] = useState<'react' | 'vanilla' | 'node'>('react');
  const [copied, setCopied] = useState<string | null>(null);

  const envConfig = getGamConfigFromEnv();

  const handleCopy = (code: string, label: string) => {
    navigator.clipboard.writeText(code);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const reactCodeSnippet = `// 1. Envolver la aplicación con el Provider
import React from 'react';
import { GamAuthProvider, useGamAuth } from '@genexus/gam-auth/react';

export function App() {
  return (
    <GamAuthProvider>
      <TuBarraDeNavegacion />
      <TuContenido />
    </GamAuthProvider>
  );
}

// 2. Conectar tu propio botón o componente con el hook
export function TuBotonDeLogin() {
  const { user, isAuthenticated, loginWithRedirect, logout, isLoading } = useGamAuth();

  if (isLoading) return <div>Verificando sesión...</div>;

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-3">
        <span>Hola, {user.first_name || user.user_name}!</span>
        <button onClick={logout}>Cerrar Sesión</button>
      </div>
    );
  }

  return (
    <button onClick={() => loginWithRedirect()}>
      Iniciar Sesión con GAM
    </button>
  );
}`;

  const vanillaCodeSnippet = `import { GamAuthClient } from '@genexus/gam-auth';

// Inicializar cliente (toma las variables de entorno automáticamente)
const gam = new GamAuthClient();

// 1. Iniciar login (en el onclick de tu propio botón)
document.getElementById('btnLogin').addEventListener('click', async () => {
  const { url } = await gam.buildAuthorizeUrl();
  window.location.href = url; // Redirige a GAM Remote Login
});

// 2. En tu página de Callback (/oauth/gam/callback)
async function procesarRetorno() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');

  const { success, data } = await gam.exchangeCodeForToken({ code });
  if (success && data?.access_token) {
    const userInfo = await gam.getUserInfo(data.access_token);
    console.log('Usuario autenticado:', userInfo.data);
  }
}`;

  const nodeCodeSnippet = `// En tu servidor Node.js (backend/server.ts)
import express from 'express';
import { GamAuthClient } from '@genexus/gam-auth';

const app = express();
const gam = new GamAuthClient({
  baseUrl: process.env.GAM_BASE_URL,
  clientId: process.env.GAM_CLIENT_ID,
  clientSecret: process.env.GAM_CLIENT_SECRET, // Seguro en backend
});

// Middleware para proteger tus endpoints de backend
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token faltante' });

  const result = await gam.getUserInfo(token);
  if (!result.success) return res.status(401).json({ error: 'Token inválido en GAM' });

  req.user = result.data;
  next();
}

app.get('/api/datos-privados', requireAuth, (req, res) => {
  res.json({ mensaje: 'Autorizado', usuario: req.user });
});`;

  return (
    <div className="w-full max-w-4xl space-y-6">
      {/* Tarjeta de bienvenida */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-200 border border-blue-400/30 mb-3">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>Librería Lista: @genexus/gam-auth</span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Diseña tu UI libremente con la librería GAM</h2>
        <p className="text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">
          La lógica de autorización OAuth 2.0 PKCE, canje de código seguro sin secret, y consulta de <code>/userinfo</code> ahora está empaquetada de forma modular. Tus propios componentes solo deben llamar al hook <code>useGamAuth()</code> o instanciar <code>GamAuthClient</code>.
        </p>
      </div>

      {/* Grid de Estado de Variables de Entorno */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Variables de Entorno Cargadas en Runtime</h3>
            <p className="text-xs text-slate-500">
              La librería lee estas variables desde <code>.env</code> / <code>import.meta.env</code> / <code>process.env</code>
            </p>
          </div>
          <span className="px-2 py-0.5 text-[11px] font-mono bg-emerald-100 text-emerald-800 rounded font-semibold border border-emerald-200">
            Runtime Detectado
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <span className="font-mono font-semibold text-slate-600">VITE_GAM_PUBLIC_URL:</span>
            <div className="font-mono text-slate-900 break-all bg-white p-1.5 rounded border border-slate-200">
              {envConfig.publicUrl || '(no configurada)'}
            </div>
            <p className="text-[11px] text-slate-500">URL del IDP donde el navegador del usuario se loguea.</p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <span className="font-mono font-semibold text-slate-600">VITE_GAM_BASE_URL:</span>
            <div className="font-mono text-slate-900 break-all bg-white p-1.5 rounded border border-slate-200">
              {envConfig.baseUrl || '(no configurada)'}
            </div>
            <p className="text-[11px] text-slate-500">URL del proxy en dev para peticiones REST sin CORS.</p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <span className="font-mono font-semibold text-slate-600">VITE_GAM_CLIENT_ID:</span>
            <div className="font-mono text-slate-900 break-all bg-white p-1.5 rounded border border-slate-200">
              {envConfig.clientId || '(no configurada)'}
            </div>
            <p className="text-[11px] text-slate-500">Identificador de la app registrada en GAM.</p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <span className="font-mono font-semibold text-slate-600">VITE_GAM_REDIRECT_URI:</span>
            <div className="font-mono text-slate-900 break-all bg-white p-1.5 rounded border border-slate-200">
              {envConfig.redirectUri || '(no configurada)'}
            </div>
            <p className="text-[11px] text-slate-500">Ruta de callback que recibe el código de retorno.</p>
          </div>
        </div>
      </div>

      {/* Explicación del Proxy de Vite */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-3">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-600"></span>
          <span>¿Cómo funciona el Proxy de Vite para URLs Locales?</span>
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          Los navegadores impiden por política de <strong>CORS</strong> que una SPA en <code>http://localhost:3000</code> haga un POST directo a <code>http://localhost:8082</code> si el servidor IIS/Kestrel de GeneXus no incluye cabeceras <code>Access-Control-Allow-Origin</code>.
        </p>

        <div className="bg-slate-900 text-slate-200 p-4 rounded-lg font-mono text-xs overflow-x-auto space-y-1">
          <div className="text-slate-400">// Configurado en vite.config.ts:</div>
          <div>server: &#123;</div>
          <div className="pl-4">proxy: &#123;</div>
          <div className="pl-8 text-emerald-400">'/api-gam': &#123;</div>
          <div className="pl-12">target: 'http://localhost:8082', <span className="text-slate-500">// o tu URL de prueba</span></div>
          <div className="pl-12">changeOrigin: true,</div>
          <div className="pl-12">rewrite: (path) =&gt; path.replace(/^\/api-gam/, ''),</div>
          <div className="pl-8 text-emerald-400">&#125;,</div>
          <div className="pl-4">&#125;,</div>
          <div>&#125;</div>
        </div>

        <p className="text-xs text-slate-500">
          De este modo, cuando el frontend llama a <code>/api-gam/Login_GAM.../oauth/gam/access_token</code>, el servidor de desarrollo de Vite lo reenvía como servidor a servidor, evitando cualquier restricción de CORS.
        </p>
      </div>

      {/* Ejemplos de Código para Desarrolladores */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Ejemplos de Integración en tu Código</h3>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg text-xs">
            <button
              onClick={() => setActiveSnippetTab('react')}
              className={`px-3 py-1 rounded font-medium transition-all ${
                activeSnippetTab === 'react'
                  ? 'bg-white text-blue-700 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              React Hooks
            </button>
            <button
              onClick={() => setActiveSnippetTab('vanilla')}
              className={`px-3 py-1 rounded font-medium transition-all ${
                activeSnippetTab === 'vanilla'
                  ? 'bg-white text-blue-700 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Vanilla JS / Agnóstico
            </button>
            <button
              onClick={() => setActiveSnippetTab('node')}
              className={`px-3 py-1 rounded font-medium transition-all ${
                activeSnippetTab === 'node'
                  ? 'bg-white text-blue-700 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Node.js (Backend)
            </button>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => {
              const code =
                activeSnippetTab === 'react'
                  ? reactCodeSnippet
                  : activeSnippetTab === 'vanilla'
                  ? vanillaCodeSnippet
                  : nodeCodeSnippet;
              handleCopy(code, activeSnippetTab);
            }}
            className="absolute top-3 right-3 px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors flex items-center gap-1"
          >
            {copied === activeSnippetTab ? (
              <span className="text-emerald-400">✓ Copiado</span>
            ) : (
              <span>Copiar código</span>
            )}
          </button>

          <pre className="bg-slate-950 text-slate-100 rounded-xl p-4 text-xs font-mono overflow-x-auto border border-slate-800 leading-relaxed">
            {activeSnippetTab === 'react' && reactCodeSnippet}
            {activeSnippetTab === 'vanilla' && vanillaCodeSnippet}
            {activeSnippetTab === 'node' && nodeCodeSnippet}
          </pre>
        </div>
      </div>
    </div>
  );
};
