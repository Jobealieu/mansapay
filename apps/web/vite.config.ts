import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The API has no CORS headers configured (and apps/api is out of scope for
// this frontend pass), so the browser can never call it directly across
// origins. Proxying /api same-origin sidesteps CORS entirely instead of
// requiring a backend change. Mirrored in `preview` so `npm run preview`
// works the same way as `npm run dev`.
const apiProxy = {
  '/api': {
    target: 'http://localhost:4000',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api/, ''),
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
});
