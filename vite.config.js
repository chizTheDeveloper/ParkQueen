import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  return {
    plugins: [react()],
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
    server: {
      host: true
    }
  };
});
