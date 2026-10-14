# Solución de Problemas Frecuentes (FAQ / Troubleshooting)

Esta guía recopila los errores y dudas técnicas más comunes al integrar `@genexus/gam-auth` y cómo resolverlos.

---

## 1. Error: `Calling require for "react" in an environment that doesn't expose the require function`

### Causa:
La librería fue compilada en formato CommonJS (`index.cjs`) o el `package.json` apuntaba a un archivo `.cjs`. El nuevo motor de empaquetado de Vite (Rolldown) en el navegador no admite `require()`.

### Solución:
1. En `vite.config.lib.mts`, configura exclusivamente `formats: ['es']`.
2. En `package.json`, asegúrate de que `"main"` apunte a `./dist-lib/index.js` y que el tipo sea `"type": "module"`.
3. Vuelve a compilar con `npm run build:lib`.

---

## 2. Error: `404 (Not Found)` al llamar a `/api-gam/.../oauth/gam/access_token`

### Causa:
Tu aplicación frontend corre en el puerto `5173` (o similar), pero no tiene configurado el proxy en su `vite.config.ts`. El servidor de desarrollo de Vite intenta buscar un archivo local en el puerto 5173 en lugar de reenviarlo al servidor GeneXus GAM.

### Solución:
Agrega la regla de proxy en el `vite.config.ts` de la aplicación cliente:

```typescript
// vite.config.ts (en tu aplicación cliente)
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api-gam': {
        target: 'http://<servidor:puerto>', // Servidor donde corre GeneXus GAM
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api-gam/, ''),
      },
    },
  },
});
```
> **Nota:** Tras modificar `vite.config.ts`, debes reiniciar el servidor de desarrollo (`npm run dev`).

---

## 3. Error de CORS: `Blocked by CORS policy` / `Failed to fetch`

### Causa:
El navegador impide que una SPA en `http://localhost:5173` haga peticiones POST directas a otro host o puerto (ej: `http://servidor:8080`) si el servidor web de GeneXus (IIS o Kestrel) no incluye cabeceras `Access-Control-Allow-Origin`.

### Solución:
Usa la solución del **Punto 2 (Proxy de Vite)** en desarrollo. El proxy realiza la petición de servidor a servidor, por lo que el navegador no aplica las restricciones de CORS.

---

## 4. Al presionar "Cerrar Sesión" y volver a entrar, entra automáticamente sin pedir contraseña

### Causa:
GeneXus GAM guarda una cookie de sesión central de **Single Sign-On (SSO)** en el navegador. La función `logout()` de la librería limpia la sesión local de tu aplicación React, pero la cookie de GAM sigue viva en el navegador.

### Solución:
Realiza un **Logout Federado** redirigiendo al usuario al endpoint de signout de GAM:

```typescript
const handleCerrarSesionCompleto = async () => {
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

## 5. El atributo `user.user_name` devuelve `undefined`

### Causa:
En GeneXus GAM 18, el atributo nativo del payload JSON devuelto por `/oauth/gam/userinfo` es **`username`** (sin guion bajo).

### Solución:
A partir de la versión `1.0.03`, la librería `@genexus/gam-auth` normaliza automáticamente la respuesta. Puedes acceder indistintamente a:
* `user.username` *(recomendado / oficial)*
* `user.user_name` *(alias de compatibilidad)*

---

## 6. Error de TypeScript: `Opción 'exclude' del compilador desconocida`

### Causa:
Se colocó la propiedad `"exclude"` adentro del objeto `"compilerOptions"` en `tsconfig.json`.

### Solución:
En `tsconfig.json`, `"exclude"` debe ubicarse en la raíz del archivo, como hermano de `"compilerOptions"`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext"
  },
  "exclude": [
    "node_modules",
    "dist",
    "dist-lib"
  ]
}
```
