import { OnLoadArgs, OnLoadOptions, OnResolveArgs, OnResolveOptions, PluginBuild, Plugin } from 'esbuild';
import { execFile } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

const execFileAsync = promisify(execFile);

export enum CallbackType {
  OnResolve,
  OnLoad,
  OnStart,
  OnEnd,
}

export interface Callback {
  path: string;
  type: CallbackType;
  filter?: RegExp;
  namespace?: string;
}

export const createPlugin = (name: string, callbacks: Callback[]): Plugin => {
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
          build.onResolve(options, async (args: OnResolveArgs) => {
            try {
              let { stdout } = await execFileAsync(callback.path, [
                args.path,
                args.importer,
                args.namespace,
                args.resolveDir,
                args.kind,
                args.pluginData,
              ]);
              let res = JSON.parse(stdout);
              return res;
            } catch (e) {
              console.log(e);
            }
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
          build.onLoad(options, async (args: OnLoadArgs) => {
            try {
              let { stdout } = await execFileAsync(callback.path, [
                args.path,
                args.namespace,
                args.suffix,
                args.pluginData,
              ]);
              let res = JSON.parse(stdout);
              return res;
            } catch (e) {
              console.log(e);
            }
          });
        } else if (callback.type === CallbackType.OnStart) {
          build.onStart(async () => {
            try {
              let { stdout } = await execFileAsync(callback.path);
              return JSON.parse(stdout);
            } catch (e) {
              console.log(e);
            }
          });
        } else if (callback.type === CallbackType.OnEnd) {
          build.onStart(async () => {
            try {
              await execFileAsync(callback.path);
            } catch (e) {
              console.log(e);
            }
          });
        }
      }
    },
  };
};
