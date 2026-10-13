import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';

/**
 * Plugin de proxy inteligente para GeneXus GAM (/api-gam).
 * Resuelve cualquier problema de CORS interceptando las peticiones en Node.js,
 * inyectando cabeceras CORS permisivas, manejando preflights (OPTIONS),
 * y determinando dinámicamente el host de GAM (desde x-gam-target, env o memoria).
 */
function gamProxyPlugin(env: Record<string, string>): Plugin {
  let lastKnownTarget = env.VITE_GAM_PROXY_TARGET || env.VITE_GAM_PUBLIC_URL || '';

  return {
    name: 'gam-smart-proxy',
    configureServer(server) {
      server.middlewares.use('/api-gam', async (req, res) => {
        // 1. Manejo universal de CORS para cualquier origen del navegador
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Access-Control-Expose-Headers', '*');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        // 2. Determinar el host destino de GAM
        const headerTarget = req.headers['x-gam-target'] as string | undefined;
        let targetCandidate =
          headerTarget ||
          env.VITE_GAM_PROXY_TARGET ||
          env.VITE_GAM_PUBLIC_URL ||
          lastKnownTarget ||
          '';

        if (headerTarget) {
          try {
            lastKnownTarget = new URL(headerTarget).origin;
          } catch {
            lastKnownTarget = headerTarget;
          }
        }

        if (!targetCandidate) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: 'missing_gam_target',
              message:
                'No se especificó la URL destino del servidor GAM. Configura VITE_GAM_PUBLIC_URL en .env o envía la cabecera x-gam-target.',
            })
          );
          return;
        }

        let targetOrigin = targetCandidate;
        try {
          targetOrigin = new URL(targetCandidate).origin;
        } catch {
          if (!targetOrigin.startsWith('http://') && !targetOrigin.startsWith('https://')) {
            targetOrigin = `https://${targetOrigin}`;
          }
        }

        const rawUrl = req.url || '';
        const upstreamUrl = `${targetOrigin.replace(/\/+$/, '')}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;

        // 3. Capturar el body si la petición es POST / PUT / PATCH
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }
        const bodyBuffer = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

        // 4. Preparar cabeceras para el reenvío a GAM
        const forwardHeaders: Record<string, string> = {
          'ngrok-skip-browser-warning': 'true',
          'User-Agent': 'GamAuthProxy/1.0',
        };

        if (req.headers['content-type']) {
          forwardHeaders['content-type'] = req.headers['content-type'] as string;
        }
        if (req.headers['authorization']) {
          forwardHeaders['authorization'] = req.headers['authorization'] as string;
        }
        if (req.headers['accept']) {
          forwardHeaders['accept'] = req.headers['accept'] as string;
        }

        try {
          const upstreamRes = await fetch(upstreamUrl, {
            method: req.method,
            headers: forwardHeaders,
            body: ['POST', 'PUT', 'PATCH'].includes(req.method || '') ? bodyBuffer : undefined,
          });

          res.statusCode = upstreamRes.status;
          res.setHeader('Access-Control-Allow-Origin', '*');
          const contentType = upstreamRes.headers.get('content-type');
          if (contentType) {
            res.setHeader('Content-Type', contentType);
          }

          const arrayBuf = await upstreamRes.arrayBuffer();
          res.end(Buffer.from(arrayBuf));
        } catch (err: any) {
          // Responder 502 con cabeceras CORS para que el navegador NO lo confunda con un error de CORS
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(
            JSON.stringify({
              error: 'upstream_connection_failed',
              endpoint: upstreamUrl,
              target: targetOrigin,
              message: `Error al conectar con el servidor GAM (${upstreamUrl}): ${err.message}`,
            })
          );
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss(), gamProxyPlugin(env)],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
        '@genexus/gam-auth/react': path.resolve(import.meta.dirname, 'src/lib/react/index.ts'),
        '@genexus/gam-auth': path.resolve(import.meta.dirname, 'src/lib/index.ts'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
