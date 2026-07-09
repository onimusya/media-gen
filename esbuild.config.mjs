import { build } from 'esbuild';
import { copyFileSync, readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/media-gen.mjs',
  minify: true,
  sourcemap: false,
  legalComments: 'none',
  banner: {
    js: `#!/usr/bin/env node
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
`,
  },
  define: {
    'process.env.NODE_ENV': '"production"',
    '__APP_VERSION__': JSON.stringify(pkg.version),
  },
  mangleProps: /_$/,
  treeShaking: true,
  drop: ['debugger'],
  logLevel: 'info',
});

// Copy built CLI into skills/media-generation/scripts/ for agent access
copyFileSync('dist/media-gen.mjs', 'skills/media-generation/scripts/media-gen.mjs');
console.log('Build complete: dist/media-gen.mjs');
console.log('Copied to: skills/media-generation/scripts/media-gen.mjs');
