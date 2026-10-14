# Flujo OAuth 2.0 con PKCE (RFC 7636)

El flujo de **Código de Autorización con Proof Key for Code Exchange (PKCE)** es el estándar oficial recomendado para aplicaciones frontend (Single Page Applications como React, Vue, Angular) y aplicaciones móviles.

---

## 🛡️ ¿Por qué PKCE y no el flujo tradicional?

En el flujo OAuth 2.0 tradicional, para canjear un código de autorización por un token se necesita enviar el secreto de la aplicación (`client_secret`).

* **El problema en el navegador:** Un frontend es un entorno público. Cualquier usuario o atacante puede abrir las herramientas de desarrollador (*F12*) y ver el `client_secret` en el código fuente o en la pestaña Network.
* **La solución de PKCE (RFC 7636):** Reemplaza el `client_secret` estático por un **secreto dinámico de un solo uso** generado en cada inicio de sesión:
  1. El cliente genera un valor secreto aleatorio llamado **`code_verifier`** (entre 43 y 128 caracteres seguros).
  2. Calcula su hash criptográfico SHA-256 en Base64-URL, llamado **`code_challenge`**.
  3. Envía únicamente el `code_challenge` a GAM al iniciar el login.
  4. Tras autenticarse, GAM devuelve un `code`.
  5. El cliente envía el `code` junto con el `code_verifier` original a `/oauth/gam/access_token`.
  6. GAM aplica el hash SHA-256 al `code_verifier` recibido y comprueba que coincida con el `code_challenge` del paso 3. Si coincide, entrega el token. **Nadie que intercepte el código puede usarlo sin conocer el secreto que generó el navegador**.

---

## 🔄 Los 3 Pasos del Flujo en Código

### 1. Iniciar el Login (`buildAuthorizeUrl`)

Genera los secretos, los persiste temporalmente en el almacenamiento (por defecto `sessionStorage`) y construye la URL de redirección a GAM:

```typescript
import { GamAuthClient } from '@genexus/gam-auth';

const client = new GamAuthClient({
  clientId: 'TU_CLIENT_ID',
  baseUrl: 'http://<servidor:puerto>/<directorio_virtual>',
  redirectUri: 'http://localhost:5173/oauth/gam/callback',
});

// Genera code_verifier, code_challenge (S256) y state
const { url, codeVerifier, state } = await client.buildAuthorizeUrl();

// Redirige al usuario al formulario oficial de GAM
window.location.href = url;
```

URL generada de ejemplo:
```text
http://<servidor:puerto>/<directorio_virtual>/oauth/gam/signin
  ?client_id=TU_CLIENT_ID
  &redirect_uri=http%3A%2F%2Flocalhost%3A5173%2Foauth%2Fgam%2Fcallback
  &response_type=code
  &code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
  &code_challenge_method=S256
  &state=xyz123...
  &scope=gam_user_data+gam_user_roles
```

---

### 2. Validar el Retorno en el Callback (`/oauth/gam/callback`)

Cuando GAM valida las credenciales del usuario, lo devuelve a tu `redirectUri` con dos parámetros en la URL:
`http://localhost:5173/oauth/gam/callback?code=AUTH_CODE&state=xyz123...`

```typescript
const params = new URLSearchParams(window.location.search);
const code = params.get('code');
const state = params.get('state');

// 1. Validar el token 'state' para prevenir ataques CSRF
const sesionGuardada = await client.getStoredPkceSession();
if (sesionGuardada?.state && state && sesionGuardada.state !== state) {
  throw new Error('Alerta: Posible ataque CSRF (el state no coincide).');
}
```

---

### 3. Canjear el Código por Tokens y Obtener Perfil

El cliente recupera automáticamente el `code_verifier` guardado en la sesión y hace la solicitud HTTP POST a GAM:

```typescript
// 2. Canjear código por el access_token
const tokenResult = await client.exchangeCodeForToken({ code });

if (!tokenResult.success || !tokenResult.data?.access_token) {
  throw new Error('Error al canjear el código por el token');
}

const accessToken = tokenResult.data.access_token;
console.log('Token obtenido:', accessToken);

// 3. Consultar los datos del usuario en /oauth/gam/userinfo
const userResult = await client.getUserInfo(accessToken);

if (userResult.success && userResult.data) {
  console.log('Usuario autenticado:', userResult.data.username);
  console.log('Nombre:', userResult.data.first_name);
  console.log('Email:', userResult.data.email);
  console.log('Roles:', userResult.data.roles);
}

// 4. Limpiar los secretos temporales de PKCE
await client.clearPkceSession();
```

---

## 🔒 Parámetros de Seguridad Implementados

| Parámetro | Estándar | Propósito |
| :--- | :--- | :--- |
| `code_verifier` | RFC 7636 | Cadena aleatoria de 64 caracteres criptográficamente seguros (`crypto.getRandomValues`). |
| `code_challenge` | S256 | Hash SHA-256 codificado en Base64-URL (`S256`). GAM no admite `plain` por motivos de seguridad. |
| `state` | RFC 6749 §10.12 | Token aleatorio para mitigar ataques de Cross-Site Request Forgery (CSRF). |
