import esbuild from 'esbuild';
import { createPlugin, CallbackType } from '../../build/esm.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// this example plugin is from
// https://esbuild.github.io/plugins/#http-plugin

export const createHTTPPlugin = (binaries) =>
  createPlugin('http-plugin', [
    {
      path: binaries.resolveHttpPath,
      type: CallbackType.OnResolve,
      filter: /^https?:\/\//,
      namespace: '',
    },
    {
      path: binaries.resolveHttpImports,
      type: CallbackType.OnResolve,
      filter: /.*/,
      namespace: 'http-url',
    },
    {
      path: binaries.loadResource,
      type: CallbackType.OnLoad,
      filter: /.*/,
      namespace: 'http-url',
      timeout: 20_000,
      maxBuffer: 8 * 1024 * 1024,
    },
  ]);

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const binary = (name) =>
    fileURLToPath(new URL(`./bin/${name}${process.platform === 'win32' ? '.exe' : ''}`, import.meta.url));
  await esbuild.build({
    entryPoints: [fileURLToPath(new URL('./app.js', import.meta.url))],
    bundle: true,
    outfile: fileURLToPath(new URL('./out/out.js', import.meta.url)),
    plugins: [
      createHTTPPlugin({
        resolveHttpPath: binary('resolveHttpPath'),
        resolveHttpImports: binary('resolveHttpImports'),
        loadResource: binary('loadResource'),
      }),
    ],
  });
}
