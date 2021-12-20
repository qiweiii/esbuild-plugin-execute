import esbuild from 'esbuild';
import { createPlugin, CallbackType } from '../../build/esm.mjs';

// this example plugin is from
// https://esbuild.github.io/plugins/#http-plugin

const httpPluginGo = createPlugin('http-plugin', [
  {
    path: './resolveHttpPath/main',
    type: CallbackType.OnResolve,
    filter: /^https?:\/\//,
  },
  {
    path: './resolveHttpImports/main',
    type: CallbackType.OnResolve,
    filter: /.*/,
    namespace: 'http-url',
  },
  {
    path: './loadResource/main',
    type: CallbackType.OnLoad,
    filter: /.*/,
    namespace: 'http-url',
  },
]);

esbuild.build({
  entryPoints: ['app.js'],
  bundle: true,
  outfile: 'out/out.js',
  plugins: [httpPluginGo],
});
