# Documentación Oficial: `@genexus/gam-auth`

Librería desacoplada en TypeScript/JavaScript para la autenticación con **GeneXus Access Manager (GAM 18)** bajo los estándares **OAuth 2.0 y RFC 7636 (PKCE)**. Compatible con navegadores modernos (React, Vue, Angular, Vanilla JS) y entornos Node.js.

---

## 📋 Tabla de Contenidos
1. [Comparativa de Flujos: ¿Cuándo usar cada uno?](#1-comparativa-de-flujos)
2. [Configuración Inicial y Parámetros (`GamConfig`)](#2-configuración-inicial-y-parámetros)
3. [Flujo 1: Authorization Code con PKCE (Recomendado para SPAs)](#3-flujo-1-authorization-code-con-pkce)
4. [Flujo 2: Resource Owner Password Credentials (Formulario Directo)](#4-flujo-2-resource-owner-password-credentials)
5. [Uso con React Context y Hooks (`GamAuthProvider` y `useGamAuth`)](#5-uso-con-react-context-y-hooks)
   - [Configurar el Provider](#51-configurar-el-provider)
   - [Manejo del Callback con `handleRedirectCallback()`](#52-manejo-del-callback-con-handleredirectcallback)
   - [Recuperar el `access_token` guardado](#53-recuperar-el-access_token-guardado)
   - [Cierre de sesión con `logout()`](#54-cierre-de-sesión-con-logout)
6. [Compilación, Empaquetado y Distribución de la Librería](#6-compilación-empaquetado-y-distribución)
   - [Configuración de Vite (`vite.config.lib.mts`)](#61-configuración-de-vite-viteconfiglibmts)
   - [Configuración de TypeScript (`tsconfig.lib.json`)](#62-configuración-de-typescript-tsconfiglibjson)
   - [Configuración de `package.json`](#63-configuración-de-packagejson)
   - [Empaquetar con `npm pack` e instalar en otra aplicación](#64-empaquetar-con-npm-pack-e-instalar)
7. [Configuración del Proxy en Aplicaciones Cliente Vite (Puerto 5173)](#7-configuración-del-proxy-en-aplicaciones-cliente-vite)
8. [Endpoints Oficiales de GeneXus GAM 18](#8-endpoints-oficiales-de-genexus-gam-18)
9. [Referencia Completa de la API](#9-referencia-completa-de-la-api)
10. [Solución de Problemas Frecuentes (Troubleshooting)](#10-solución-de-problemas-frecuentes)

---

## 1. Comparativa de Flujos

| Característica | Flujo PKCE (Authorization Code) | Flujo Password (Resource Owner) |
| :--- | :--- | :--- |
| **Tipo de Aplicación** | Frontend / SPA (React, Vue, móvil). | Backend a Backend o Apps corporativas cerradas. |
| **¿Requiere `client_secret`?** | **NO** (Prohibido exponer secretos en frontend). | **SÍ** (Debe viajar seguro en el backend). |
| **Pantalla de Login** | Oficial de GeneXus GAM (Redirección segura). | Formulario propio con inputs de usuario y contraseña. |
| **Seguridad** | Máxima (Protegido con SHA-256 contra intercepción). | Media (Tu frontend manipula las contraseñas en texto claro). |
| **Soporte MFA / 2FA** | Compatible automáticamente. | No soporta segundo factor nativo de GAM. |

---

## 2. Configuración Inicial y Parámetros

```typescript
import { GamConfig } from '@genexus/gam-auth';

const config: GamConfig = {
  // 1. Client ID registrado en la consola de GAM para tu aplicación
  clientId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',

  // 2. URL base donde corre tu GeneXus GAM (incluyendo el directorio virtual)
  // En desarrollo web suele usarse la ruta proxy local para evitar CORS:
  baseUrl: 'http://localhost:5173/api-gam/<directorio_virtual>',

  // 3. (Opcional) URL pública real de GAM si se requiere para redirecciones externas:
  // publicUrl: 'http://<servidor:puerto>/<directorio_virtual>',

  // 4. URL exacta a la que GAM debe retornar tras el login
  redirectUri: 'http://localhost:5173/oauth/gam/callback',

  // 5. Permisos requeridos
  scope: 'gam_user_data+gam_user_roles',
};
```

---

## 3. Flujo 1: Authorization Code con PKCE

Este flujo consta de **3 pasos cronológicos**:
```text
[Tu App] ──(1. Redirige con code_challenge)──> [Pantalla Login GAM]
[Tu App] <──(2. Vuelve con ?code=...)──────── [GAM valida credenciales]
[Tu App] ──(3. Canjea code + code_verifier)──> [GAM devuelve Token y UserInfo]
```

### Paso A: Pantalla de Inicio (`LoginPage.tsx`)
Inicia el flujo generando los secretos criptográficos y enviando al usuario al formulario oficial de GAM:

```tsx
import React, { useState } from 'react';
import { GamAuthClient } from '@genexus/gam-auth';

export const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);

    const client = new GamAuthClient({
      clientId: 'TU_CLIENT_ID',
      publicUrl: 'http://<servidor:puerto>/<directorio_virtual>',
      redirectUri: `${window.location.origin}/oauth/gam/callback`,
    });

    // buildAuthorizeUrl() genera:
    // - code_verifier (clave secreta de 64 caracteres)
    // - code_challenge (hash criptográfico SHA-256 / S256)
    // - state (token aleatorio anti-CSRF)
    // Los guarda automáticamente en sessionStorage y construye la URL de GAM.
    const { url } = await client.buildAuthorizeUrl();

    // Redirige al usuario a la pantalla oficial de GAM
    window.location.href = url;
  };

  return (
    <button onClick={handleLogin} disabled={loading}>
      {loading ? 'Conectando con GAM...' : 'Iniciar Sesión con GeneXus GAM'}
    </button>
  );
};
```

---

### Paso B: Procesamiento del Retorno (`CallbackPage.tsx`)
Se ejecuta en la ruta `/oauth/gam/callback` a la que GAM redirige al usuario:

```tsx
import React, { useEffect, useState } from 'react';
import { GamAuthClient, GamUserInfo } from '@genexus/gam-auth';

export const CallbackPage: React.FC = () => {
  const [estado, setEstado] = useState('Procesando autenticación...');
  const [usuario, setUsuario] = useState<GamUserInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const procesarRetorno = async () => {
      // 1. Extraer los parámetros que GAM agregó a la URL
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');

      if (!code) {
        setError('No se recibió el código de autorización de GAM.');
        return;
      }

      const client = new GamAuthClient({
        clientId: 'TU_CLIENT_ID',
        baseUrl: 'http://localhost:5173/api-gam/<directorio_virtual>',
        redirectUri: `${window.location.origin}/oauth/gam/callback`,
      });

      // 2. Validar el token 'state' contra el guardado (protección anti-CSRF)
      const sesionGuardada = await client.getStoredPkceSession();
      if (sesionGuardada?.state && state && sesionGuardada.state !== state) {
        setError('Alerta de seguridad: Discrepancia en el parámetro state.');
        return;
      }

      // 3. Canjear el code por el access_token (recupera el code_verifier automáticamente)
      setEstado('Canjeando código por token de acceso...');
      const tokenResult = await client.exchangeCodeForToken({ code });

      if (!tokenResult.success || !tokenResult.data?.access_token) {
        setError('Error al canjear el token: ' + JSON.stringify(tokenResult.data || tokenResult.rawError));
        return;
      }

      const accessToken = tokenResult.data.access_token;
      localStorage.setItem('gam_access_token', accessToken);

      // 4. Consultar los datos del usuario autenticado
      setEstado('Obteniendo información del usuario (/userinfo)...');
      const userResult = await client.getUserInfo(accessToken);

      if (userResult.success && userResult.data) {
        setUsuario(userResult.data);
        setEstado('¡Sesión iniciada con éxito!');
        // Opcional: Redirigir a la pantalla principal
        // window.location.href = '/dashboard';
      } else {
        setError('Error al obtener perfil del usuario.');
      }
    };

    procesarRetorno();
  }, []);

  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
  if (usuario) return <div>Bienvenido, {usuario.first_name || usuario.username || usuario.user_name} ({usuario.email})</div>;
  return <div>{estado}</div>;
};
```

---

## 4. Flujo 2: Resource Owner Password Credentials

En este flujo el usuario ingresa sus credenciales directamente en un formulario de tu aplicación. 

> ⚠️ **Nota de Arquitectura:** Requiere enviar el `client_secret`. Si estás en un frontend público, se recomienda enviar las credenciales a un backend propio (BFF / Node.js) y que sea este quien consulte a GAM.

```typescript
import { GamExecutionResult, GamTokenResponse } from '@genexus/gam-auth';

export async function loginConPassword(credenciales: {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}): Promise<GamExecutionResult<GamTokenResponse>> {
  const endpoint = `${credenciales.baseUrl.replace(/\/+$/, '')}/oauth/gam/v2.0/access_token`;

  const body = new URLSearchParams();
  body.append('grant_type', 'password');
  body.append('client_id', credenciales.clientId);
  body.append('client_secret', credenciales.clientSecret);
  body.append('scope', 'gam_user_data+gam_user_roles');
  body.append('username', credenciales.username);
  body.append('password', credenciales.password);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const data = await res.json();
    return {
      success: res.ok && !data.error,
      status: res.status,
      statusText: res.statusText,
      endpoint,
      data,
    };
  } catch (err: any) {
    return {
      success: false,
      endpoint,
      rawError: { name: err.name, message: err.message },
    };
  }
}
```

---

## 5. Uso con React Context y Hooks (`useGamAuth`)

La librería exporta el componente `<GamAuthProvider>` y el hook `useGamAuth()` directamente desde `@genexus/gam-auth`.

### 5.1. Configurar el Provider
Envuelve tu aplicación en el Provider (por ejemplo en `App.tsx` o `main.tsx`):

```tsx
import React from 'react';
import { GamAuthProvider } from '@genexus/gam-auth';
import { MiAplicacion } from './MiAplicacion';

export default function App() {
  return (
    <GamAuthProvider
      config={{
        clientId: 'TU_CLIENT_ID',
        baseUrl: 'http://localhost:5173/api-gam/<directorio_virtual>',
        redirectUri: `${window.location.origin}/oauth/gam/callback`,
      }}
    >
      <MiAplicacion />
    </GamAuthProvider>
  );
}
```

---

### 5.2. Manejo del Callback con `handleRedirectCallback()`
En la ruta a la que GAM redirige al usuario (`/oauth/gam/callback`), procesas todo el flujo en **1 sola línea**:

```tsx
import React, { useEffect } from 'react';
import { useGamAuth } from '@genexus/gam-auth';

export const CallbackPage = () => {
  const { handleRedirectCallback, error } = useGamAuth();

  useEffect(() => {
    // handleRedirectCallback hace automáticamente:
    // 1. Lee code y state de la URL.
    // 2. Valida la sesión anti-CSRF.
    // 3. Canjea el código por el token.
    // 4. Consulta /userinfo y guarda todo en localStorage.
    // 5. Actualiza isAuthenticated: true y user en React.
    handleRedirectCallback()
      .then(() => {
        window.location.href = '/dashboard';
      })
      .catch((err) => {
        console.error('Error al procesar callback:', err);
      });
  }, [handleRedirectCallback]);

  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
  return <div>Iniciando sesión con GAM...</div>;
};
```

---

### 5.3. Recuperar el `access_token` guardado

Tienes dos formas de acceder al token según dónde lo necesites:

#### Opción A: Desde cualquier componente React con el hook:
```tsx
import React from 'react';
import { useGamAuth } from '@genexus/gam-auth';

export const MiComponente = () => {
  const { tokens, user, isAuthenticated } = useGamAuth();

  // Token disponible de forma reactiva:
  const token = tokens?.access_token;

  return <div>Token actual: {token}</div>;
};
```

#### Opción B: Directamente desde `localStorage` (para servicios, Axios o llamadas API):
`GamAuthProvider` persiste automáticamente la sesión en el almacenamiento local:
```typescript
// En tu interceptor de Axios o función fetch:
const accessToken = localStorage.getItem('gam_access_token');
const userInfo = JSON.parse(localStorage.getItem('gam_user_info') || 'null');
const refreshToken = localStorage.getItem('gam_refresh_token');
```

---

### 5.4. Cierre de sesión con `logout()`

#### Invocación directa del hook:
```tsx
import React from 'react';
import { useGamAuth } from '@genexus/gam-auth';

export const BarraUsuario = () => {
  const { user, isAuthenticated, logout } = useGamAuth();

  if (!isAuthenticated) return null;

  return (
    <div>
      <span>Hola, {user?.first_name || user?.username || user?.user_name}</span>
      <button onClick={logout}>Cerrar Sesión</button>
    </div>
  );
};
```

#### ¿Qué hace exactamente `logout()`?
1. Limpia los estados en memoria de React (`setTokens(null)`, `setUser(null)`, `isAuthenticated: false`).
2. Elimina las claves de `localStorage` (`gam_access_token`, `gam_user_info`, `gam_refresh_token`).
3. Limpia las claves temporales de PKCE (`code_verifier`, `state`, etc.).

#### Cierre de Sesión Federado (Destruir cookies en GAM):
Si deseas que GAM también invalide su cookie central de Single Sign-On (para que vuelva a pedir contraseña al iniciar de nuevo), invoca `logout()` y luego redirige al endpoint de signout de GAM:

```typescript
const handleLogoutCompleto = async () => {
  // 1. Limpieza local de React y localStorage
  await logout();

  // 2. Notificar a GAM para destruir su cookie central
  const signoutUrl = 
    `http://<servidor:puerto>/<directorio_virtual>/oauth/gam/signout` +
    `?client_id=TU_CLIENT_ID&redirect_uri=${encodeURIComponent(window.location.origin)}`;

  window.location.href = signoutUrl;
};
```

---

## 6. Compilación, Empaquetado y Distribución

Para compilar la librería como paquete distribuible (`.tgz`):

### 6.1. Configuración de Vite (`vite.config.lib.mts`)
Asegúrate de compilar **únicamente en formato ESM puro (`formats: ['es']`)** y excluir `react`, `react-dom` y `react/jsx-runtime`:

```typescript
// vite.config.lib.mts
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    outDir: 'dist-lib',
    lib: {
      entry: path.resolve(import.meta.dirname, 'src/lib/index.ts'),
      name: 'GamAuth',
      fileName: 'index',
      formats: ['es'], // Formato ES Modules moderno
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'ReactJSXRuntime',
        },
      },
    },
  },
});
```

---

### 6.2. Configuración de TypeScript (`tsconfig.lib.json`)
Crea este archivo para emitir únicamente las definiciones de tipos (`.d.ts`):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["node"],
    "jsx": "react-jsx",
    "declaration": true,
    "emitDeclarationOnly": true,
    "rootDir": "./src/lib",
    "outDir": "./dist-lib/types",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src/lib/**/*"]
}
```

Y en tu `tsconfig.json` principal, excluye las carpetas de salida:
```json
{
  "compilerOptions": { ... },
  "exclude": [
    "node_modules",
    "dist",
    "dist-lib"
  ]
}
```

---

### 6.3. Configuración de `package.json`
```json
{
  "name": "@genexus/gam-auth",
  "version": "1.0.1",
  "type": "module",
  "main": "./dist-lib/index.js",
  "module": "./dist-lib/index.js",
  "types": "./dist-lib/types/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist-lib/types/index.d.ts",
      "import": "./dist-lib/index.js",
      "default": "./dist-lib/index.js"
    }
  },
  "files": [
    "dist-lib"
  ],
  "scripts": {
    "build:lib": "vite build --config vite.config.lib.mts && tsc --project tsconfig.lib.json"
  }
}
```

---

### 6.4. Empaquetar con `npm pack` e Instalar

1. **En la carpeta de la librería:**
   ```bash
   npm run build:lib
   npm pack
   ```
   *(Generará `genexus-gam-auth-1.0.1.tgz`).*

2. **En tu otra aplicación:**
   ```bash
   npm uninstall @genexus/gam-auth
   npm install "D:\Proyectos\libreria_gam\genexus-gam-auth-1.0.1.tgz"
   ```

---

## 7. Configuración del Proxy en Aplicaciones Cliente Vite

Si tu aplicación cliente corre en el puerto `5173` y tu servidor GeneXus GAM corre en `http://<servidor:puerto>`, debes agregar el proxy en el `vite.config.ts` de la aplicación cliente para **evitar el error 404 y los bloqueos de CORS**:

```typescript
// vite.config.ts (en tu aplicación cliente)
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api-gam': {
        target: 'http://<servidor:puerto>', // Servidor GeneXus GAM
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api-gam/, ''),
      },
    },
  },
});
```

---

## 8. Endpoints Oficiales de GeneXus GAM 18

Todos los endpoints cuelgan del directorio virtual de tu modelo GeneXus (ej: `/<directorio_virtual>`):

| Propósito | Endpoint Estándar (Web / IDP) | Endpoint REST v2.0 (Mobile) | Método |
| :--- | :--- | :--- | :--- |
| **Inicio de Sesión (Login)** | `/oauth/gam/signin` | `/oauth/gam/signin` | `GET` |
| **Canje de Código / Token** | `/oauth/gam/access_token` | `/oauth/gam/v2.0/access_token` | `POST` |
| **Información del Usuario** | `/oauth/gam/userinfo` | `/oauth/gam/v2.0/userinfo` | `GET` |
| **Cierre de Sesión (Logout)**| `/oauth/gam/signout` | `/oauth/gam/signout` | `GET / POST` |

---

## 9. Referencia Completa de la API

### Clase `GamAuthClient`

```typescript
const client = new GamAuthClient(config?: Partial<GamConfig>);
```

* **`buildAuthorizeUrl(params?): Promise<{ url, codeVerifier, state, codeChallenge }>`**: Construye la URL de login con desafío S256 y guarda la sesión PKCE en el storage.
* **`exchangeCodeForToken(params): Promise<GamExecutionResult<GamTokenResponse>>`**: Canjea el código recibido por el token de acceso. Lee automáticamente el `code_verifier` guardado.
* **`getUserInfo(accessToken, options?): Promise<GamExecutionResult<GamUserInfo>>`**: Consulta `/oauth/gam/userinfo` enviando `Authorization: Bearer <token>`.
* **`refreshAccessToken(refreshToken, options?): Promise<GamExecutionResult<GamTokenResponse>>`**: Renueva un token expirado.
* **`getStoredPkceSession(): Promise<GamPkceSession | null>`**: Recupera los secretos temporales de PKCE guardados.
* **`clearPkceSession(): Promise<void>`**: Limpia los secretos temporales de PKCE.

---

## 10. Solución de Problemas Frecuentes

### 1. Error: `Calling require for "react" in an environment that doesn't expose the require function`
* **Causa:** La librería fue compilada en formato CommonJS (`.cjs`) y el bundler de tu aplicación (Rolldown / Vite) no admite `require()` en el navegador.
* **Solución:** En `vite.config.lib.mts`, configura `formats: ['es']` para compilar exclusivamente en formato ESM moderno.

### 2. Error: `404 (Not Found)` al consultar `/api-gam/.../oauth/gam/access_token`
* **Causa:** Tu aplicación cliente en el puerto `5173` no tiene configurado el proxy en su `vite.config.ts`, por lo que Vite busca una ruta interna inexistente en el puerto 5173.
* **Solución:** Configura `server.proxy` en el `vite.config.ts` de tu aplicación cliente apuntando al host de GeneXus GAM (`http://<servidor:puerto>`).

### 3. Al hacer logout y volver a hacer clic en login, entra sin pedir usuario y contraseña
* **Causa:** GAM guarda una cookie de sesión central (SSO) en el navegador.
* **Solución:** Invoca `logout()` para la limpieza local y luego redirige a la URL de signout de GAM: `${baseUrl}/oauth/gam/signout?client_id=...&redirect_uri=...`.

### 4. Error: `Opción 'exclude' del compilador desconocida` en `tsconfig.json`
* **Causa:** Pusiste `"exclude"` dentro de `"compilerOptions"`.
* **Solución:** `"exclude"` debe ir en la raíz de `tsconfig.json`, afuera de `"compilerOptions"`.
