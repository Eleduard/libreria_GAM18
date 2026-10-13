# @genexus/gam-auth

Librería TypeScript/JavaScript universal para autenticación **OAuth 2.0 + PKCE (RFC 7636)** con **GeneXus Access Manager (GAM 18)**.

* **Segura por diseño**: No expone el `client_secret` en el navegador. Usa PKCE con SHA-256 (`S256`).
* **Universal**: Funciona tanto en **React** / navegadores como en **Node.js 18+** (Express, NestJS, etc.).
* **Configurable por Variables de Entorno**: Lee automáticamente variables de entorno sin datos quemados en código.
* **Componentes libres**: El desarrollador diseña su propia UI y la conecta con 1 sola línea de código mediante el hook `useGamAuth()` o la clase `GamAuthClient`.

---

## 📦 Instalación

```bash
npm install @genexus/gam-auth
```

---

## ⚙️ Variables de Entorno

Puedes configurar la librería mediante variables de entorno en tu archivo `.env`:

```env
# Frontend (Vite)
VITE_GAM_BASE_URL="/api-gam/Login_GAM_LeoNETSQLServer"
VITE_GAM_PUBLIC_URL="https://midominio.com/Login_GAM_LeoNETSQLServer"
VITE_GAM_CLIENT_ID="mi_client_id_en_gam"
VITE_GAM_REDIRECT_URI="http://localhost:3000/oauth/gam/callback"
VITE_GAM_SCOPE="gam_user_data+gam_user_roles"

# Backend (Node.js confidencial opcional)
GAM_BASE_URL="http://localhost:8082/Login_GAM_LeoNETSQLServer"
GAM_CLIENT_ID="mi_client_id_en_gam"
GAM_CLIENT_SECRET="mi_client_secret_confidencial"
```

---

## 🚀 Uso en React

### 1. Configurar el Provider

```tsx
import React from 'react';
import { GamAuthProvider } from '@genexus/gam-auth/react';

export function RootApp() {
  return (
    <GamAuthProvider>
      <MiAplicacion />
    </GamAuthProvider>
  );
}
```

### 2. Conectar tus propios componentes con `useGamAuth`

```tsx
import React from 'react';
import { useGamAuth } from '@genexus/gam-auth/react';

export function BarraSuperior() {
  const { user, isAuthenticated, loginWithRedirect, logout, isLoading } = useGamAuth();

  if (isLoading) return <span>Cargando sesión...</span>;

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-4">
        <span>Bienvenido, {user.first_name || user.user_name}!</span>
        <button onClick={logout} className="btn-secundario">
          Cerrar Sesión
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => loginWithRedirect()} className="btn-primario">
      Iniciar Sesión con GAM
    </button>
  );
}
```

### 3. Componente de Callback (`/oauth/gam/callback`)

```tsx
import React, { useEffect } from 'react';
import { useGamAuth } from '@genexus/gam-auth/react';
import { useNavigate } from 'react-router-dom';

export function GamCallbackPage() {
  const { handleRedirectCallback, error } = useGamAuth();
  const navigate = useNavigate();

  useEffect(() => {
    handleRedirectCallback()
      .then(() => navigate('/dashboard'))
      .catch((err) => console.error('Error al procesar callback:', err));
  }, [handleRedirectCallback, navigate]);

  if (error) return <div className="alerta-error">{error}</div>;

  return <div>Procesando inicio de sesión con GeneXus GAM...</div>;
}
```

---

## 🖥️ Uso en Node.js / Backend (Express / Nest)

```typescript
import { GamAuthClient } from '@genexus/gam-auth';

const gam = new GamAuthClient({
  baseUrl: process.env.GAM_BASE_URL,
  clientId: process.env.GAM_CLIENT_ID,
  clientSecret: process.env.GAM_CLIENT_SECRET, // Opcional para backend
});

// Ruta de callback en Express
app.get('/api/auth/callback', async (req, res) => {
  const { code } = req.query;
  const verifier = req.session.codeVerifier;

  const result = await gam.exchangeCodeForToken({
    code: String(code),
    codeVerifier: verifier,
    redirectUri: 'http://localhost:4000/api/auth/callback',
  });

  if (result.success && result.data?.access_token) {
    const userInfo = await gam.getUserInfo(result.data.access_token);
    req.session.user = userInfo.data;
    return res.redirect('/dashboard');
  }

  return res.status(401).json({ error: 'Fallo al autenticar con GAM' });
});
```

---

## 🛠️ Endpoints Oficiales de GAM soportados
* **Sign-in**: `/oauth/gam/signin`
* **Token (OAuth 2.0 Web IDP)**: `/oauth/gam/access_token`
* **Token (Mobile REST v2.0)**: `/oauth/gam/v2.0/access_token`
* **User info**: `/oauth/gam/userinfo`
