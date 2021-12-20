import esbuild from 'esbuild';
import { createPlugin, CallbackType } from '../../build/esm.mjs';

// this example plugin is from
// https://esbuild.github.io/plugins/#svelte-plugin

// (This is just an example, using a node executable in this case is not necessary)

const sveltePlugin = createPlugin('svelte', [
  {
    path: './load/main-macos',
    type: CallbackType.OnLoad,
    filter: /\.svelte$/,
  },
]);

esbuild.build({
  entryPoints: ['app.js'],
  bundle: true,
  outfile: 'out/out.js',
  plugins: [sveltePlugin],
});
