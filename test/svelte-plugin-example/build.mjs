import esbuild from 'esbuild';
import { createPlugin, CallbackType } from '../../dist/esm.js';

// this example plugin is from
// https://esbuild.github.io/plugins/#svelte-plugin

// (This is just an example, using a node binary in this case is not necessary)

const sveltePlugin = createPlugin('svelte', [
  {
    path: './load/main',
    type: CallbackType.OnLoad,
    filter: /\.svelte$/,
  },
]);

esbuild.build({
  entryPoints: ['app.svelte'],
  bundle: true,
  outfile: 'out/out.js',
  plugins: [sveltePlugin],
});
