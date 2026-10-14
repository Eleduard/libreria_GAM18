# Guía de Configuración: GeneXus GAM 18 como Identity Provider (IDP) OAuth 2.0

En GeneXus 18, el **GeneXus Access Manager (GAM)** provee la capacidad de comportarse como **Identity Provider (IDP)** utilizando el protocolo **OAuth 2.0**. 

Esta funcionalidad se implementa a través de dos vías principales:
1. **Vía WEB (IDP usando SSO con Flujo de Código de Autorización + PKCE):** Diseñada para aplicaciones ejecutadas en navegadores (SPAs como React, Vue, Angular) y dispositivos móviles donde **no se puede mantener en secreto el `client_secret`**.
2. **Vía Servicios REST (Flujo de Credenciales de Contraseña - Resource Owner Password):** Diseñada para aplicaciones con servidor propio (backend-to-backend) que pueden custodiar credenciales de forma segura.

Esta guía detalla los pasos exactos para habilitar y configurar la aplicación en la consola **GAMHome**.

---

## 1. Acceso a la Consola de Administración GAM

1. Abre tu navegador e ingresa a la consola de administración de GAM:
   ```text
   http://<servidor:puerto>/<directorio_virtual>/gamhome.aspx
   ```
2. Inicia sesión con un usuario con rol de **Administrador de GAM** (por ejemplo, el usuario `admin`).
3. En el menú lateral izquierdo, haz clic en **Aplicaciones**.
4. Puedes **Crear una nueva aplicación** (botón *Nuevo*) o hacer clic en el botón de edición de una aplicación existente.

---

## 2. Configuración del Flujo Web (OAuth 2.0 + PKCE)

Dentro de la pantalla de edición de la aplicación, dirígete a la pestaña **Autenticación de OAuth**:

### Paso 2.1: Habilitar el Código de Autorización
1. Ubica y marca la casilla:
   - ☑️ **¿Permitir OAuth 2.0 (flujo de código de autorización en /oauth/gam)?**  
   *(Al marcar esta casilla se desplegarán las opciones de configuración criptográfica).*

### Paso 2.2: Configurar PKCE
2. En el campo **Opción de OAuth 2.0**, selecciona:
   - **`PKCE`**
3. En el campo **Método PKCE permitido**, selecciona:
   - **`S256`** *(SHA-256. Es el método estándar de alta seguridad soportado por `@genexus/gam-auth`).*

### Paso 2.3: Permisos y Scopes de Usuario
4. En la sección **Scopes de usuario permitidos**, marca las casillas según los datos que tu frontend requiera:
   - ☑️ **Datos del usuario** *(Obligatorio para recibir `guid`, `username`, `email`, `first_name`, `last_name`).*
   - ☑️ **Roles de usuario** *(Necesario si tu aplicación valida permisos o roles del usuario).*
   - ☑️ **Datos adicionales del usuario** *(Si utilizas atributos dinámicos extendidos en GAM).*

### Paso 2.4: Registrar la URL de Callback (Redirect URI)
5. En el campo **URL de Callback**, ingresa la URL exacta a la que GAM debe retornar al usuario tras iniciar sesión exitosamente:
   ```text
   http://<servidor_frontend:puerto>/oauth/gam/callback
   ```
   > ⚠️ **Importante:** La URL configurada en GAM debe coincidir exactamente (carácter por carácter, incluyendo puerto y protocolo) con la propiedad `redirectUri` enviada desde tu aplicación frontend.

---

## 3. Configuración de la Pestaña "SSO REST"

Para que los endpoints de canje de tokens (`/oauth/gam/access_token`) y consulta de perfil (`/oauth/gam/userinfo`) atiendan solicitudes externas:

1. Ve a la pestaña **SSO REST**.
2. Marca la casilla:
   - ☑️ **Habilitar los servicios SSO REST?**
3. En el selector **Modo**, selecciona:
   - **`Servidor`**
4. Haz clic en **Confirmar / Guardar** para aplicar los cambios.

---

## 4. (Opcional) Configuración del Flujo REST Services (Password Grant)

Si adicionalmente cuentas con un backend confidencial y necesitas autenticar usuarios enviando usuario y contraseña:

1. En la misma pestaña **Autenticación de OAuth**, desplázate hacia abajo hasta la sección **Servicios REST**.
2. Marca las casillas correspondientes:
   - ☑️ **¿Permitir OAuth 2.0 (flujo de credenciales de contraseña en /oauth)?**
   - ☑️ **¿Permitir OAuth 2.0 (flujo de credenciales de contraseña en /oauth/gam/v2.0)?**
3. Selecciona los alcances requeridos (*Datos del usuario*, *Roles*, etc.).
4. Guarda los cambios.

---

## 5. Resumen del Flujo de Comunicación en Ejecución

```text
+----------------+                +---------------------+                +---------------------+
|   Navegador    |                |    GeneXus GAM      |                |  Recurso Protegido  |
|  (App Cliente) |                | (Servidor OAuth IDP)|                |   (Backend / API)   |
+--------+-------+                +----------+----------+                +----------+----------+
         |                                   |                                      |
         | 1. Redirige a /oauth/gam/signin   |                                      |
         |    con code_challenge (S256)      |                                      |
         |---------------------------------->|                                      |
         |                                   |                                      |
         | 2. Usuario ingresa credenciales   |                                      |
         |    en formulario nativo de GAM    |                                      |
         |                                   |                                      |
         | 3. Redirección a Callback         |                                      |
         |    con ?code=AUTH_CODE            |                                      |
         |<----------------------------------|                                      |
         |                                   |                                      |
         | 4. POST /oauth/gam/access_token   |                                      |
         |    enviando code + code_verifier  |                                      |
         |---------------------------------->|                                      |
         |                                   |                                      |
         | 5. GAM valida hash S256 y entrega |                                      |
         |    access_token y refresh_token   |                                      |
         |<----------------------------------|                                      |
         |                                   |                                      |
         | 6. GET /oauth/gam/userinfo        |                                      |
         |    (Authorization: Bearer Token)  |                                      |
         |---------------------------------->|                                      |
         |                                   |                                      |
         | 7. GAM entrega perfil:            |                                      |
         |    guid, username, email, etc.    |                                      |
         |<----------------------------------|                                      |
         |                                                                          |
         | 8. Consulta a API protegida con Authorization: Bearer <access_token>     |
         |------------------------------------------------------------------------->|
```

---

## 6. Referencias Oficiales de GeneXus

- [GAM - OAuth 2.0 Endpoints to use GAM as Web IDP Server](https://wiki.genexus.com/commwiki/wiki?30441,GAM+-+OAuth+2.0+Endpoints+to+use+GAM+as+Web+IDP+Server)
- [HowTo: Use OAuth 2.0 Endpoints to authenticate with GAM as REST IDP Server](https://wiki.genexus.com/commwiki/wiki?29367,HowTo%3A+Use+OAuth+2.0+Endpoints+to+authenticate+with+GAM+as+REST+IDP+Server)
