import { GamConfig } from './types';

/**
 * Lee la configuración de GAM desde las variables de entorno disponibles en el runtime.
 * Soporta `import.meta.env` (Vite / Astro / bundlers modernos) y `process.env` (Node.js / Next.js / Webpack).
 */
export function getGamConfigFromEnv(overrides?: Partial<GamConfig>): Partial<GamConfig> {
  const getEnv = (key: string): string | undefined => {
    // 1. Intentar leer de import.meta.env (Vite)
    try {
      // @ts-ignore
      if (typeof import.meta !== 'undefined' && import.meta.env) {
        // @ts-ignore
        const val = import.meta.env[key];
        if (val) return String(val).trim();
      }
    } catch {
      // Ignorar si import.meta no es compatible
    }

    // 2. Intentar leer de process.env (Node.js)
    try {
      if (typeof process !== 'undefined' && process.env) {
        const val = process.env[key];
        if (val) return String(val).trim();
      }
    } catch {
      // Ignorar si process no existe
    }

    return undefined;
  };

  const baseUrl =
    getEnv('VITE_GAM_BASE_URL') ||
    getEnv('GAM_BASE_URL') ||
    '/api-gam';

  const publicUrl =
    getEnv('VITE_GAM_PUBLIC_URL') ||
    getEnv('GAM_PUBLIC_URL') ||
    '';

  const clientId =
    getEnv('VITE_GAM_CLIENT_ID') ||
    getEnv('GAM_CLIENT_ID') ||
    '';

  const clientSecret =
    getEnv('GAM_CLIENT_SECRET') ||
    getEnv('VITE_GAM_CLIENT_SECRET') ||
    undefined;

  const redirectUri =
    getEnv('VITE_GAM_REDIRECT_URI') ||
    getEnv('GAM_REDIRECT_URI') ||
    (typeof window !== 'undefined' ? `${window.location.origin}/oauth/gam/callback` : undefined);

  const scope =
    getEnv('VITE_GAM_SCOPE') ||
    getEnv('GAM_SCOPE') ||
    'gam_user_data+gam_user_roles';

  return {
    baseUrl,
    publicUrl,
    clientId,
    clientSecret,
    redirectUri,
    scope,
    ...overrides,
  };
}
