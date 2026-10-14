# Compilación, Empaquetado y Distribución

Esta guía explica cómo compilar la librería `@genexus/gam-auth` como paquete independiente en formato **ES Modules (ESM)**, empaquetarla con `npm pack` e instalarla en cualquier proyecto externo.

---

## 1. Configuración de Compilación (`vite.config.lib.mts`)

La librería debe compilarse exclusivamente en formato ESM moderno (`formats: ['es']`), excluyendo `react` y `react-dom` para evitar duplicación de instancias de React en las aplicaciones consumidoras:

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
      formats: ['es'], // Produce únicamente dist-lib/index.js (ESM limpio)
    },
    rollupOptions: {
      // Excluir dependencias de React para que use la instancia de la app cliente
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

## 2. Configuración de Tipos TypeScript (`tsconfig.lib.json`)

Para generar los archivos de declaración de tipos (`.d.ts`):

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

---

## 3. Configuración de `package.json`

En el `package.json` de la librería, se definen los puntos de entrada compilados y el script de build:

```json
{
  "name": "@genexus/gam-auth",
  "version": "1.0.03",
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

## 4. Generar el Archivo Empaquetado (`.tgz`)

1. Abre la terminal en la raíz del proyecto de la librería.
2. Ejecuta el script de compilación:
   ```bash
   npm run build:lib
   ```
3. Ejecuta `npm pack` para crear el tarball:
   ```bash
   npm pack
   ```

Esto creará en la raíz del proyecto un archivo comprimido listo para distribución, por ejemplo:
`genexus-gam-auth-1.0.03.tgz`

---

## 5. Instalación en la Aplicación Destino

Para instalar el paquete local en tu otra aplicación:

```bash
# En la terminal de tu otra aplicación:
npm install "D:\Proyectos\libreria_gam\genexus-gam-auth-1.0.03.tgz"
```

### 💡 Cómo evitar problemas de caché al reinstalar:
Si ya tenías instalada una versión previa y necesitas actualizarla:
1. Sube el número de versión en `package.json` (ej: de `1.0.02` a `1.0.03`) antes de hacer `npm pack`.
2. O en la aplicación cliente, desinstala primero para limpiar la caché de npm:
   ```bash
   npm uninstall @genexus/gam-auth
   npm install "D:\Proyectos\libreria_gam\genexus-gam-auth-1.0.03.tgz"
   ```
