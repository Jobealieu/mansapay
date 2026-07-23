import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The API does have CORS configured (see apps/api/src/app.ts), but the dev
// proxy stays anyway: it keeps local dev same-origin so nobody has to keep
// ALLOWED_ORIGINS in sync with whichever port Vite happens to pick, and it
// matches how `vite preview` behaves. Mirrored in `preview` for that reason.
const apiProxy = {
  '/api': {
    target: 'http://localhost:4000',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api/, ''),
  },
};

export default defineConfig(({ mode }) => {
  // import.meta.env.VITE_API_URL is baked into the bundle at build time,
  // not read at runtime - there is no server to read it later, this is a
  // static site. If it's missing for a production build, the build still
  // succeeds (VITE_API_URL falls back to '/api' in src/lib/api.ts) but the
  // deployed site would silently call its own origin instead of the API,
  // which just looks like every request failing. This warning is the only
  // signal you'd get, so it's worth reading in the Render build log.
  if (mode === 'production' && !process.env.VITE_API_URL) {
    console.warn(
      '\n⚠️  VITE_API_URL is not set for this production build. The deployed site will fall back ' +
        "to '/api', which only works if the API is served from this site's own origin. Set " +
        "VITE_API_URL to the deployed API's URL (e.g. https://mansapay-api.onrender.com) before " +
        'building for deployment. See DEPLOYMENT.md.\n',
    );
  }

  return {
    plugins: [react(), tailwindcss()],
    server: { proxy: apiProxy },
    preview: { proxy: apiProxy },
  };
});
