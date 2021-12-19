const esbuild = require('esbuild');
import { createPlugin } from '../../src/index';

// this example plugin is from
// https://esbuild.github.io/plugins/#http-plugin
const httpPluginGo = createPlugin([
  {
    path: './resolveHttpPath',
    type: CallbackType.OnResolve,
    filter: /^https?:\/\//,
  },
  {
    path: './resolveHttpImports',
    type: CallbackType.OnResolve,
    filter: /.*/,
    namespace: 'http-url',
  },
  {
    path: './loadResource',
    type: CallbackType.OnLoad,
    filter: /.*/,
    namespace: 'http-url',
  },
]);

esbuild.build({
  entryPoints: ['app.js'],
  bundle: true,
  outfile: 'out/outTest.js',
  plugins: [httpPluginGo],
});
