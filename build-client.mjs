/**
 * Bundle the browser half into the __ModuleLoader__ lazy-CJS shape the shell
 * expects (same as dsh-memory). react and every @deepseek-ai/dsh-* specifier
 * stay external so the factory resolves them through the module table.
 */
import { build } from 'esbuild'

const ID = '@max-null/dsh-achievements'

await build({
  entryPoints: ['src/client/index.tsx'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  jsx: 'automatic',
  target: 'es2022',
  external: [
    'react',
    'react/jsx-runtime',
    '@deepseek-ai/*',
  ],
  outfile: 'client.js',
  banner: {
    js: `window.__ModuleLoader__.load({\n  id: ${JSON.stringify(ID)},\n  factory: (require) => {\n    var module = { exports: {} };\n    var exports = module.exports;\n`,
  },
  footer: {
    js: `    return module.exports;\n  },\n});\n`,
  },
  logLevel: 'info',
})
