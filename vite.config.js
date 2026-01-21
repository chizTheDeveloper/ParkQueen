import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    // Defines process.env variables for the client-side code
    define: {
      // safe replacement for the specific key, defaulting to empty string if undefined
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ""),
      // We do NOT want to polyfill the entire process.env object as empty
      // because it breaks libraries checking for process.env.NODE_ENV
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