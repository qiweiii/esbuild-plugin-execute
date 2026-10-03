import esbuild from 'esbuild';
import { createPlugin, CallbackType } from '../../build/esm.mjs';
import { fileURLToPath } from 'node:url';

// this example plugin is from
// https://esbuild.github.io/plugins/#svelte-plugin

// (This is just an example, using a node executable in this case is not necessary)

const sveltePlugin = createPlugin('svelte', [
  {
    path: process.execPath,
    args: [fileURLToPath(new URL('./load/main.js', import.meta.url))],
    type: CallbackType.OnLoad,
    filter: /\.svelte$/,
  },
]);

await esbuild.build({
  entryPoints: [fileURLToPath(new URL('./app.js', import.meta.url))],
  bundle: true,
  outfile: fileURLToPath(new URL('./out/out.js', import.meta.url)),
  plugins: [sveltePlugin],
});
