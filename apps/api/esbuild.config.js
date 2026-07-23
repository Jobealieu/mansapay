import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

// Bundle everything so the compiled output is self-contained and runnable
// with plain `node` in production (Render), with one deliberate exception:
// @mansapay/shared is a workspace package published as raw TypeScript
// source (see its package.json - "main": "src/index.ts"). That works for
// `tsx`/vitest, which transpile any .ts they import on the fly, but plain
// Node has no such loader and cannot import a .ts file at all. Bundling
// inlines and transpiles it here instead.
//
// Every real npm dependency stays external: esbuild bundling a native
// addon (argon2) would break it, and there is no benefit to inlining
// ordinary node_modules packages that are already valid, resolvable JS -
// they just need `npm ci` to have installed them, same as today.
const externalDependencies = Object.keys(pkg.dependencies).filter((name) => name !== '@mansapay/shared');

await build({
  entryPoints: ['src/index.ts', 'src/db/migrate.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: true,
  external: externalDependencies,
});
