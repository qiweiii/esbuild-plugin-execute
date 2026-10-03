import type { Plugin } from 'esbuild';
import { CallbackType, createPlugin, type Callback } from 'esbuild-plugin-execute';

const callback: Callback = { path: process.execPath, type: CallbackType.OnStart, args: ['handler.cjs'] };
const plugin: Plugin = createPlugin('esm-consumer', [callback]);
void plugin;
