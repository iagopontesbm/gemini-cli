import esbuild from 'esbuild';

const nativeNodeModulesPlugin = {
  name: 'native-node-modules',
  setup(build) {
    // If a ".node" file is imported within a module in the "file" namespace, resolve
    // it to an absolute path and put it into the "node-file" virtual namespace.
    build.onResolve({ filter: /\.node$/, namespace: 'file' }, args => ({
      path: require.resolve(args.path, { paths: [args.resolveDir] }),
      namespace: 'node-file',
    }))

    // Files in the "node-file" virtual namespace resolve to themselves.
    build.onResolve({ filter: /.*/, namespace: 'node-file' }, args => ({
      path: args.path,
      namespace: 'node-file',
    }))

    // When a ".node" file is loaded, we want to actually use the file loader
    // to copy the file to the output directory.
    build.onLoad({ filter: /.*/, namespace: 'node-file' }, args => ({
      contents: `
        import path from ${JSON.stringify(args.path)}
        try { module.exports = require(path) }
        catch {}
      `,
      loader: 'js',
    }))
  },
}

esbuild.build({
  entryPoints: ['packages/cli/index.ts'],
  bundle: true,
  outfile: 'bundle/gemini.js',
  platform: 'node',
  format: 'esm',
  banner: {
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url); globalThis.__filename = require('url').fileURLToPath(import.meta.url); globalThis.__dirname = require('path').dirname(globalToplevel.__filename);`,
  },
  plugins: [nativeNodeModulesPlugin],
}).catch(() => process.exit(1));
