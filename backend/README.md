# Backend Service (Node.js / Express)

Módulo backend desacoplado del frontend para APIs protegidas por GeneXus GAM.

## Arquitectura
* **Consumo de la librería**: Utiliza `GamAuthClient` desde `@genexus/gam-auth` en Node.js sin depender del DOM.
* **Seguridad**: Puede leer de forma segura `GAM_CLIENT_SECRET` desde variables de entorno del servidor.
* **Middleware**: `requireGamAuth` verifica automáticamente la validez de los tokens Bearer emitidos por GAM antes de otorgar acceso a rutas protegidas.
