import { defineConfig } from 'vite';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  root: 'src',
  plugins: [
    react(), viteTsconfigPaths(),
    tailwindcss()
  ],
  server: {
    headers: { 
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  }
});