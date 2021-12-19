import {
  OnLoadArgs,
  OnLoadOptions,
  OnResolveArgs,
  OnResolveOptions,
  PluginBuild,
  Plugin,
  OnStartResult,
  OnLoadResult,
  OnResolveResult,
} from 'esbuild';
import { execFile } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

const execFileAsync = promisify(execFile);

enum CallbackType {
  OnResolve,
  OnLoad,
  OnStart,
  OnEnd,
}

interface Callback {
  path: string;
  type: CallbackType;
  filter?: RegExp;
  namespace?: string;
}

const createPlugin = (name: string, callbacks: Callback[]): Plugin => {
  return {
    name: name,
    setup(build: PluginBuild) {
      for (const callback of callbacks) {
        if (callback.type === CallbackType.OnResolve) {
          if (!callback.filter) {
            console.error(chalk.red('ERROR'), `A filter is required for ${callback.type} callback in ${name} plugin`);
            return;
          }
          let options: OnResolveOptions = {
            filter: callback.filter,
            namespace: callback.namespace ? callback.namespace : 'file',
          };
          build.onResolve(options, async (args: OnResolveArgs): Promise<OnResolveResult | undefined> => {
            let { stdout } = await execFileAsync(callback.path, [
              args.path,
              args.importer,
              args.namespace,
              args.resolveDir,
              args.kind,
              args.pluginData,
            ]);
            return JSON.parse(stdout);
          });
        } else if (callback.type === CallbackType.OnLoad) {
          if (!callback.filter) {
            console.error(chalk.red('ERROR'), `A filter is required for ${callback.type} callback in ${name} plugin`);
            return;
          }
          let options: OnLoadOptions = {
            filter: callback.filter,
            namespace: callback.namespace ? callback.namespace : 'file',
          };
          build.onLoad(options, async (args: OnLoadArgs): Promise<OnLoadResult | undefined> => {
            let { stdout } = await execFileAsync(callback.path, [
              args.path,
              args.namespace,
              args.suffix,
              args.pluginData,
            ]);
            return JSON.parse(stdout);
          });
        } else if (callback.type === CallbackType.OnStart) {
          build.onStart(async (): Promise<void | OnStartResult | null> => {
            let { stdout } = await execFileAsync(callback.path);
            return JSON.parse(stdout);
          });
        } else if (callback.type === CallbackType.OnEnd) {
          build.onStart(async () => {
            await execFileAsync(callback.path);
          });
        }
      }
    },
  };
};

export default createPlugin;
