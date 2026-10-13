import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    outDir: 'dist-lib',
    lib: {
      // Punto de entrada de la librería
      entry: path.resolve(import.meta.dirname, 'src/lib/index.ts'),
      name: 'GamAuth',
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      // Si la librería usa dependencias externas que la app consumidora ya tendrá
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