import type { Plugin } from 'esbuild';
import execute = require('esbuild-plugin-execute');

const callback: execute.Callback = {
  path: process.execPath,
  type: execute.CallbackType.OnStart,
  args: ['handler.cjs'],
};
const plugin: Plugin = execute.createPlugin('cjs-consumer', [callback]);
void plugin;
