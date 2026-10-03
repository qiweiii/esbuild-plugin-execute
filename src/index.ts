import type { OnLoadResult, OnResolveResult, OnStartResult, Plugin } from 'esbuild';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

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
  /** Fixed arguments placed before the existing esbuild callback arguments. */
  args?: string[];
  /** Maximum execution time in milliseconds. Omit to disable the timeout. */
  timeout?: number;
  /** Maximum stdout or stderr size in bytes. Defaults to Node's execFile limit. */
  maxBuffer?: number;
}

const pluginDataArgument = (data: unknown): string => {
  if (data === undefined || data === null) return '';
  if (typeof data !== 'string') {
    throw new Error('Executable callbacks only support string pluginData');
  }
  return data;
};

const execute = async (callback: Callback, args: string[] = []): Promise<string> => {
  try {
    const { stdout } = await execFileAsync(callback.path, [...(callback.args ?? []), ...args], {
      encoding: 'utf8',
      timeout: callback.timeout,
      maxBuffer: callback.maxBuffer,
      shell: false,
    });
    return stdout;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`Executable "${callback.path}" failed: ${message}`, { cause });
  }
};

const executeJSON = async <T>(callback: Callback, args: string[] = []): Promise<T | undefined> => {
  const stdout = await execute(callback, args);
  let result: unknown;
  try {
    result = JSON.parse(stdout);
  } catch (cause) {
    throw new Error(`Executable "${callback.path}" must print valid JSON to stdout`, { cause });
  }
  // A null result declines to handle this callback, as in esbuild's plugin API.
  if (result === null) return undefined;
  if (typeof result !== 'object' || Array.isArray(result)) {
    throw new Error(`Executable "${callback.path}" must return a JSON object or null`);
  }
  if ('pluginData' in result) pluginDataArgument(result.pluginData);
  // esbuild validates the hook-specific properties of the returned object.
  return result as T;
};

export const createPlugin = (name: string, callbacks: Callback[]): Plugin => {
  for (const callback of callbacks) {
    if (typeof callback.path !== 'string' || callback.path.trim() === '') {
      throw new Error(`An executable path is required in "${name}" plugin`);
    }
    if (
      ![CallbackType.OnResolve, CallbackType.OnLoad, CallbackType.OnStart, CallbackType.OnEnd].includes(callback.type)
    ) {
      throw new Error(`Unknown callback type "${callback.type}" in "${name}" plugin`);
    }
    if (
      (callback.type === CallbackType.OnResolve || callback.type === CallbackType.OnLoad) &&
      !(callback.filter instanceof RegExp)
    ) {
      throw new Error(`A filter is required for ${CallbackType[callback.type]} callback in "${name}" plugin`);
    }
    if (
      callback.args !== undefined &&
      (!Array.isArray(callback.args) || callback.args.some((arg) => typeof arg !== 'string'))
    ) {
      throw new Error(`Executable arguments must be strings in "${name}" plugin`);
    }
    for (const option of ['timeout', 'maxBuffer'] as const) {
      const value = callback[option];
      if (value !== undefined && (!Number.isSafeInteger(value) || value <= 0)) {
        throw new Error(`${option} must be a positive integer in "${name}" plugin`);
      }
    }
  }

  return {
    name,
    setup(build) {
      for (const callback of callbacks) {
        if (callback.type === CallbackType.OnResolve) {
          build.onResolve({ filter: callback.filter!, namespace: callback.namespace ?? 'file' }, (args) =>
            executeJSON<OnResolveResult>(callback, [
              args.path,
              args.importer,
              args.namespace,
              args.resolveDir,
              args.kind,
              pluginDataArgument(args.pluginData),
            ]),
          );
        } else if (callback.type === CallbackType.OnLoad) {
          build.onLoad({ filter: callback.filter!, namespace: callback.namespace ?? 'file' }, (args) =>
            executeJSON<OnLoadResult>(callback, [
              args.path,
              args.namespace,
              args.suffix,
              pluginDataArgument(args.pluginData),
            ]),
          );
        } else if (callback.type === CallbackType.OnStart) {
          build.onStart(() => executeJSON<OnStartResult>(callback));
        } else if (callback.type === CallbackType.OnEnd) {
          build.onEnd(async () => {
            await execute(callback);
          });
        }
      }
    },
  };
};
