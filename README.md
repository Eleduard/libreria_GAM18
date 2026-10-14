# @genexus/gam-auth

> Librería de autenticación OAuth 2.0 + PKCE (RFC 7636) para **GeneXus Access Manager (GAM 18)**.

`@genexus/gam-auth` permite integrar inicios de sesión seguros con GeneXus GAM en aplicaciones web modernas y backends sin exponer secretos de cliente (*client_secret*) en el navegador.

---

## 🎯 ¿Para qué lenguajes y entornos está diseñada?

- **Lenguajes:** TypeScript (con tipado estricto al 100%) y JavaScript moderno (ES Modules).
- **Frontends (SPAs):** React (incluye Context & Hooks oficiales), Vue, Svelte, Angular y Vanilla JS.
- **Backends & Runtimes:** Node.js 18+, Bun, Deno (con Fetch API nativo).
- **Compatibilidad GAM:** GeneXus 18 (flujo Web IDP con PKCE y servicios REST v2.0).

---

## ✨ Características Principales

- 🛡️ **Seguridad PKCE Nativa (RFC 7636):** Genera automáticamente `code_verifier` (criptográficamente seguro), desafío `code_challenge` en formato S256 (SHA-256) y token `state` anti-CSRF.
- 📦 **Cero dependencias pesadas:** Construida sobre la Web Crypto API nativa de los navegadores y Node.js.
- ⚛️ **Soporte Oficial para React:** Incluye `<GamAuthProvider>` y el hook `useGamAuth()` para gestionar estado, tokens, datos del usuario (`username`) y cierre de sesión en una línea.
- 🔄 **Normalización Automática:** Garantiza compatibilidad transparente entre `username` nativo de GAM y el alias `user_name`.
- 🚪 **Logout Dual:** Soporta tanto el cierre de sesión local de la SPA como el cierre de sesión federado (Single Sign-Out) para invalidar cookies centrales en GAM.

---

## 🚀 Instalación

```bash
npm install @genexus/gam-auth
```

*(O instalando el paquete local empaquetado: `npm install ./genexus-gam-auth-1.0.03.tgz`)*

---

## ⚡ Inicio Rápido en React

```tsx
import React from 'react';
import { GamAuthProvider, useGamAuth } from '@genexus/gam-auth';

// 1. Envolver la aplicación en el Provider
export function App() {
  return (
    <GamAuthProvider
      config={{
        clientId: 'TU_CLIENT_ID',
        baseUrl: 'http://<servidor:puerto>/<directorio_virtual>',
        redirectUri: `${window.location.origin}/oauth/gam/callback`,
      }}
    >
      <PanelPrincipal />
    </GamAuthProvider>
  );
}

// 2. Usar la sesión en cualquier componente
function PanelPrincipal() {
  const { user, isAuthenticated, loginWithRedirect, logout } = useGamAuth();

  if (isAuthenticated && user) {
    return (
      <div>
        <h1>¡Bienvenido, {user.first_name || user.username}!</h1>
        <p>Email: {user.email}</p>
        <button onClick={logout}>Cerrar Sesión</button>
      </div>
    );
  }

  return (
    <button onClick={() => loginWithRedirect()}>
      Iniciar Sesión con GeneXus GAM
    </button>
  );
}
```

---

## ⚡ Inicio Rápido Agnóstico (Vanilla JS / TypeScript / Node.js)

```typescript
import { GamAuthClient } from '@genexus/gam-auth';

const client = new GamAuthClient({
  clientId: 'TU_CLIENT_ID',
  baseUrl: 'http://<servidor:puerto>/<directorio_virtual>',
  redirectUri: 'http://localhost:5173/oauth/gam/callback',
});

// Paso 1: Iniciar login (genera secretos PKCE y devuelve URL)
const { url } = await client.buildAuthorizeUrl();
window.location.href = url;

// Paso 2: En la pantalla de callback (canjear code por token)
const params = new URLSearchParams(window.location.search);
const code = params.get('code');

if (code) {
  const tokenResult = await client.exchangeCodeForToken({ code });
  if (tokenResult.success && tokenResult.data) {
    const userResult = await client.getUserInfo(tokenResult.data.access_token);
    console.log('Usuario autenticado:', userResult.data?.username);
  }
}
```

---

## 📚 Documentación Detallada

Hemos organizado la documentación completa en guías especializadas dentro de la carpeta [`docs/`](./docs/):

1. ⚙️ [**Configuración de GeneXus GAM 18 como IDP**](./docs/configuracion-gam-idp.md)  
   Guía paso a paso sobre qué casillas marcar en la consola de **GAMHome** (flujo Web con PKCE S256, SSO REST en modo Servidor y scopes de usuario).

2. 🔐 [**Flujo OAuth 2.0 PKCE en Detalle**](./docs/flujo-pkce.md)  
   Cómo funciona la generación criptográfica de secretos, la protección contra ataques CSRF con `state` y el canje seguro de código por tokens.

3. ⚛️ [**Integración Avanzada con React**](./docs/react-integration.md)  
   Manejo del callback en una línea, consumo de sesión mediante `useGamAuth`, interceptores de Axios y cierre de sesión federado.

4. 📦 [**Compilación, Empaquetado (`npm pack`) y Distribución**](./docs/compilacion-empaquetado.md)  
   Configuración de Vite en Library Mode (ESM puro), generación de declaraciones de tipo con TypeScript y distribución local con `.tgz`.

5. 🛠️ [**Solución de Problemas Frecuentes (FAQ / Troubleshooting)**](./docs/solucion-de-problemas.md)  
   Cómo configurar el proxy de Vite en el puerto `5173` para evitar CORS y 404, resolver errores de bundlers y gestionar cookies de sesión.

---

## 📄 Licencia

MIT © GeneXus GAM Auth Library
