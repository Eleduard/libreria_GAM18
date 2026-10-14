# Integración Oficial con React

La librería `@genexus/gam-auth` incluye un contexto y hook oficiales para React, facilitando la gestión reactiva del estado de autenticación, almacenamiento en `localStorage`, control del callback y cierre de sesión.

---

## 1. Configurar el Provider (`GamAuthProvider`)

Envuelve el árbol de componentes de tu aplicación (en `App.tsx` o `main.tsx`):

```tsx
import React from 'react';
import { GamAuthProvider } from '@genexus/gam-auth';
import { MiAplicacion } from './MiAplicacion';

export default function App() {
  return (
    <GamAuthProvider
      config={{
        clientId: 'TU_CLIENT_ID',
        baseUrl: 'http://<servidor:puerto>/<directorio_virtual>',
        redirectUri: `${window.location.origin}/oauth/gam/callback`,
        scope: 'gam_user_data+gam_user_roles',
      }}
      // persistSession: true por defecto (mantiene la sesión en localStorage al recargar)
      persistSession={true}
    >
      <MiAplicacion />
    </GamAuthProvider>
  );
}
```

---

## 2. Manejo del Callback en 1 Línea (`handleRedirectCallback`)

Crea un componente para la ruta `/oauth/gam/callback`:

```tsx
import React, { useEffect } from 'react';
import { useGamAuth } from '@genexus/gam-auth';

export const CallbackPage: React.FC = () => {
  const { handleRedirectCallback, error, isLoading } = useGamAuth();

  useEffect(() => {
    // handleRedirectCallback se encarga automáticamente de:
    // 1. Extraer code y state de la URL.
    // 2. Validar la sesión PKCE anti-CSRF.
    // 3. Canjear el código por el token (/oauth/gam/access_token).
    // 4. Consultar el perfil (/oauth/gam/userinfo).
    // 5. Guardar tokens en localStorage.
    // 6. Actualizar isAuthenticated: true y user en React.
    handleRedirectCallback()
      .then(() => {
        window.location.href = '/dashboard';
      })
      .catch((err) => {
        console.error('Error al procesar el callback:', err);
      });
  }, [handleRedirectCallback]);

  if (error) {
    return <div style={{ color: 'red' }}>Error en la autenticación: {error}</div>;
  }

  return <div>Iniciando sesión con GeneXus GAM...</div>;
};
```

---

## 3. Consumir la Sesión en Componentes (`useGamAuth`)

El hook `useGamAuth()` expone los siguientes estados y métodos:

| Propiedad | Tipo | Descripción |
| :--- | :--- | :--- |
| `isAuthenticated` | `boolean` | `true` si el usuario tiene un token de acceso válido. |
| `isLoading` | `boolean` | `true` mientras se inicializa la sesión o se procesa el callback. |
| `user` | `GamUserInfo \| null` | Objeto con el perfil del usuario (`username`, `email`, `first_name`, etc.). |
| `tokens` | `GamTokenResponse \| null` | Objeto con `access_token`, `refresh_token`, etc. |
| `error` | `string \| null` | Mensaje de error si ocurrió algún fallo en el proceso. |
| `loginWithRedirect`| `() => Promise<void>` | Inicia el flujo PKCE y redirige a la pantalla de login de GAM. |
| `handleRedirectCallback`| `() => Promise<...>` | Procesa el retorno de GAM en la página de callback. |
| `logout` | `() => Promise<void>` | Limpia la sesión local en React y `localStorage`. |
| `refreshSession` | `() => Promise<boolean>` | Renueva el token de acceso usando el `refresh_token`. |

### Ejemplo en una barra de navegación:

```tsx
import React from 'react';
import { useGamAuth } from '@genexus/gam-auth';

export const BarraSuperior = () => {
  const { user, isAuthenticated, isLoading, loginWithRedirect, logout } = useGamAuth();

  if (isLoading) return <span>Cargando sesión...</span>;

  if (isAuthenticated && user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span>Hola, {user.first_name || user.username}!</span>
        <button onClick={logout}>Cerrar Sesión</button>
      </div>
    );
  }

  return (
    <button onClick={() => loginWithRedirect()}>
      Iniciar Sesión con GAM
    </button>
  );
};
```

---

## 4. Recuperación del `access_token`

### En componentes React:
```tsx
const { tokens } = useGamAuth();
const token = tokens?.access_token;
```

### Fuera de React (Servicios API o Interceptores de Axios):
`GamAuthProvider` persiste automáticamente el token en `localStorage` bajo la clave estándar `gam_access_token`:

```typescript
// En api/axiosClient.ts
import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://<servidor:puerto>/<directorio_virtual>/rest',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gam_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

---

## 5. Cierre de Sesión: Local vs Federado (GAM Signout)

### A. Cierre de Sesión Local
Llama a `logout()`:
```tsx
const { logout } = useGamAuth();

const handleLogout = async () => {
  await logout();
  // Limpia tokens en memoria, localStorage y secretos PKCE.
};
```

### B. Cierre de Sesión Federado (Destruir Cookies SSO en GAM)
Cuando el usuario inicia sesión en GAM, GAM crea una cookie central de sesión para Single Sign-On (SSO). Si quieres destruir esa cookie para que al volver a presionar *"Iniciar Sesión"* GAM pida usuario y contraseña obligatoriamente:

```tsx
const { logout } = useGamAuth();

const handleLogoutCompleto = async () => {
  // 1. Limpieza de React y localStorage
  await logout();

  // 2. Redirigir a GAM para destruir su cookie central de sesión
  const signoutUrl = 
    `http://<servidor:puerto>/<directorio_virtual>/oauth/gam/signout` +
    `?client_id=TU_CLIENT_ID&redirect_uri=${encodeURIComponent(window.location.origin)}`;

  window.location.href = signoutUrl;
};
```
