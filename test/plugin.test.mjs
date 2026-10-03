import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import * as esbuild from 'esbuild';
import { createPlugin, CallbackType } from 'esbuild-plugin-execute';

const fixture = fileURLToPath(new URL('./fixtures/callback.cjs', import.meta.url));
const callback = (type, operation, args = [], options = {}) => ({
  path: process.execPath,
  type,
  args: [fixture, operation, ...args],
  ...options,
});
const build = (callbacks, options = {}) =>
  esbuild.build({
    stdin: { contents: 'export default 1', resolveDir: process.cwd() },
    bundle: true,
    write: false,
    format: 'esm',
    logLevel: 'silent',
    plugins: [createPlugin('executable-test', callbacks)],
    ...options,
  });
const evaluate = async (result) =>
  (await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)).default;
const tempDirectory = async (t) => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), 'esbuild-plugin-execute-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
};

test('published CJS and ESM entry points export the same API', () => {
  const cjs = createRequire(import.meta.url)('esbuild-plugin-execute');
  assert.equal(typeof cjs.createPlugin, 'function');
  assert.deepEqual(cjs.CallbackType, CallbackType);
});

for (const format of ['commonjs', 'module']) {
  test(`${format} consumer runs real builds through all four executable hooks`, () => {
    const imports =
      format === 'commonjs'
        ? `const esbuild = require('esbuild'); const api = require('esbuild-plugin-execute');`
        : `import * as esbuild from 'esbuild'; import * as api from 'esbuild-plugin-execute';`;
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=' + format,
        '--eval',
        `
      ${imports}
      const fixture = ${JSON.stringify(fixture)};
      const callback = (type, operation, args = [], options = {}) => ({
        path: process.execPath, type, args: [fixture, operation, ...args], ...options,
      });
      (async () => {
        const { CallbackType: Type, createPlugin } = api;
        const options = {
          stdin: { contents: 'export { default } from "virtual:module"', resolveDir: process.cwd() },
          bundle: true, write: false, format: 'esm', logLevel: 'silent',
          plugins: [createPlugin('consumer', [
            callback(Type.OnStart, 'result', ['{"warnings":[{"text":"start hook ran"}]}']),
            callback(Type.OnResolve, 'resolve', [], { filter: /^virtual:/, namespace: '' }),
            callback(Type.OnLoad, 'load', [], { filter: /.*/, namespace: 'executable' }),
            callback(Type.OnEnd, 'result', ['plain text']),
          ])],
        };
        const ctx = await esbuild.context(options);
        const outputs = [];
        try {
          for (let i = 0; i < 2; i++) {
            const build = await ctx.rebuild();
            const output = await import('data:text/javascript;base64,' + Buffer.from(build.outputFiles[0].text).toString('base64'));
            outputs.push({ value: output.default, warning: build.warnings[0].text });
          }
        } finally { await ctx.dispose(); }
        let endFailure = false;
        try {
          await esbuild.build({
            stdin: { contents: 'export default 1' }, write: false, logLevel: 'silent',
            plugins: [createPlugin('failure', [callback(Type.OnEnd, 'fail')])],
          });
        } catch (error) { endFailure = error.message.includes('fixture failed deliberately'); }
        console.log(JSON.stringify({ outputs, endFailure }));
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `,
      ],
      { encoding: 'utf8', timeout: 15_000 },
    );
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      outputs: Array.from({ length: 2 }, () => ({
        value: ['virtual:module', 'executable', '', 'from-resolve'],
        warning: 'start hook ran',
      })),
      endFailure: true,
    });
  });
}

test('ESM and CommonJS consumers type-check with NodeNext resolution', () => {
  const require = createRequire(import.meta.url);
  const result = spawnSync(
    process.execPath,
    [
      require.resolve('typescript/bin/tsc'),
      '--noEmit',
      '--strict',
      '--module',
      'NodeNext',
      '--target',
      'ES2022',
      fileURLToPath(new URL('./types/consumer.mts', import.meta.url)),
      fileURLToPath(new URL('./types/consumer.cts', import.meta.url)),
    ],
    { encoding: 'utf8' },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('resolve/load preserve positional arguments, namespaces and string pluginData', async () => {
  const result = await build(
    [
      callback(CallbackType.OnResolve, 'resolve', [], { filter: /^virtual:/, namespace: '' }),
      callback(CallbackType.OnLoad, 'load', [], { filter: /.*/, namespace: 'executable' }),
    ],
    { stdin: { contents: 'export { default } from "virtual:module"', resolveDir: process.cwd() } },
  );
  assert.deepEqual(await evaluate(result), ['virtual:module', 'executable', '', 'from-resolve']);
});

test('missing pluginData is passed as an empty string', async (t) => {
  const directory = await tempDirectory(t);
  const entry = path.join(directory, 'entry.js');
  await writeFile(entry, 'unused');
  const result = await build([callback(CallbackType.OnLoad, 'load', [], { filter: /entry\.js$/ })], {
    stdin: undefined,
    entryPoints: [entry],
  });
  assert.deepEqual(await evaluate(result), [entry, 'file', '', '']);
});

test('resolve receives all six positional arguments including missing pluginData', async (t) => {
  const directory = await tempDirectory(t);
  const entry = path.join(directory, 'entry.js');
  await writeFile(entry, 'export { default } from "virtual:module"');
  const result = await build(
    [
      callback(CallbackType.OnResolve, 'resolve-args', [], { filter: /^virtual:/ }),
      callback(CallbackType.OnLoad, 'load', [], { filter: /.*/, namespace: 'executable' }),
    ],
    { stdin: undefined, entryPoints: [entry] },
  );
  const [, , , data] = await evaluate(result);
  assert.deepEqual(JSON.parse(data), ['virtual:module', entry, 'file', directory, 'import-statement', '']);
});

test('end hooks do not require JSON output', async () => {
  await build([callback(CallbackType.OnEnd, 'result', ['ordinary output'])]);
});

test('Svelte 5 example bundles through an executable loader', async () => {
  const loader = fileURLToPath(new URL('./svelte-plugin-example/load/main.js', import.meta.url));
  const entry = fileURLToPath(new URL('./svelte-plugin-example/app.js', import.meta.url));
  const result = await build(
    [
      {
        path: process.execPath,
        args: [loader],
        type: CallbackType.OnLoad,
        filter: /\.svelte$/,
      },
    ],
    { stdin: undefined, entryPoints: [entry] },
  );
  assert.equal(result.errors.length, 0);
  assert.ok(result.outputFiles[0].text.length > 0);
});

test('null JSON declines resolution and allows the next plugin to handle it', async () => {
  const result = await esbuild.build({
    stdin: { contents: 'export { default } from "virtual:module"', resolveDir: process.cwd() },
    bundle: true,
    write: false,
    format: 'esm',
    logLevel: 'silent',
    plugins: [
      createPlugin('decline', [
        callback(CallbackType.OnResolve, 'result', ['null'], { filter: /^virtual:/, namespace: '' }),
      ]),
      createPlugin('handle', [
        callback(CallbackType.OnResolve, 'resolve', [], { filter: /^virtual:/, namespace: '' }),
        callback(CallbackType.OnLoad, 'load', [], { filter: /.*/, namespace: 'executable' }),
      ]),
    ],
  });
  assert.equal((await evaluate(result))[0], 'virtual:module');
});

for (const type of [CallbackType.OnResolve, CallbackType.OnLoad, CallbackType.OnStart, CallbackType.OnEnd]) {
  test(`${CallbackType[type]} subprocess failures fail the build and include stderr`, async () => {
    const options =
      type === CallbackType.OnResolve || type === CallbackType.OnLoad ? { filter: /.*/, namespace: '' } : {};
    const buildOptions =
      type === CallbackType.OnResolve
        ? { stdin: { contents: 'import "missing"', resolveDir: process.cwd() } }
        : type === CallbackType.OnLoad
          ? { stdin: undefined, entryPoints: [fixture] }
          : {};
    await assert.rejects(build([callback(type, 'fail', [], options)], buildOptions), /fixture failed deliberately/);
  });
}

for (const stdout of ['not json', '[]', '42', '"text"', '']) {
  test(`rejects malformed/non-object stdout: ${JSON.stringify(stdout)}`, async () => {
    await assert.rejects(
      build([callback(CallbackType.OnStart, 'result', [stdout])]),
      /must (print valid JSON|return a JSON object)/,
    );
  });
}

test('esbuild validates hook-specific result properties', async () => {
  await assert.rejects(build([callback(CallbackType.OnStart, 'result', ['{"unexpected":true}'])]), /Invalid option/);
});

test('returned non-string pluginData fails clearly', async () => {
  await assert.rejects(
    build([callback(CallbackType.OnStart, 'result', ['{"pluginData":{}}'])]),
    /only support string pluginData/,
  );
});

test('incoming non-string pluginData fails clearly', async () => {
  await assert.rejects(
    esbuild.build({
      stdin: { contents: 'import "virtual:module"', resolveDir: process.cwd() },
      bundle: true,
      write: false,
      logLevel: 'silent',
      plugins: [
        {
          name: 'data',
          setup(build) {
            build.onResolve({ filter: /^virtual:/ }, () => ({
              path: 'module',
              namespace: 'executable',
              pluginData: {},
            }));
          },
        },
        createPlugin('loader', [callback(CallbackType.OnLoad, 'load', [], { filter: /.*/, namespace: 'executable' })]),
      ],
    }),
    /only support string pluginData/,
  );
});

test('missing executable fails the build', async () => {
  await assert.rejects(
    build([{ path: path.join(process.cwd(), 'nonexistent-executable'), type: CallbackType.OnStart }]),
    /ENOENT/,
  );
});

test('timeout terminates the executable and fails the build', async () => {
  await assert.rejects(build([callback(CallbackType.OnStart, 'wait', [], { timeout: 100 })]), /Executable .* failed/);
});

test('maxBuffer limits executable output', async () => {
  await assert.rejects(build([callback(CallbackType.OnStart, 'large', [], { maxBuffer: 128 })]), /maxBuffer/);
});

test('fixed arguments are not interpreted by a shell', async (t) => {
  const directory = await tempDirectory(t);
  const marker = path.join(directory, 'must-not-exist');
  const contents = JSON.stringify({ warnings: [{ text: `$(touch ${marker}) ; echo injected` }] });
  const result = await build([callback(CallbackType.OnStart, 'result', [contents])]);
  assert.equal(result.warnings[0].text, `$(touch ${marker}) ; echo injected`);
  await assert.rejects(readFile(marker), { code: 'ENOENT' });
});

test('invalid callback configuration throws before registering hooks', () => {
  for (const options of [
    { path: '' },
    { type: 99 },
    { timeout: 0 },
    { timeout: -1 },
    { maxBuffer: NaN },
    { args: [1] },
    { type: CallbackType.OnResolve },
    { type: CallbackType.OnLoad },
  ]) {
    assert.throws(() => createPlugin('invalid', [{ path: process.execPath, type: CallbackType.OnStart, ...options }]));
  }
});

test('start/end hooks run in order on every context rebuild', async (t) => {
  const directory = await tempDirectory(t);
  const record = path.join(directory, 'hooks.txt');
  const ctx = await esbuild.context({
    stdin: { contents: 'export default 1' },
    write: false,
    logLevel: 'silent',
    plugins: [
      createPlugin('hooks', [
        callback(CallbackType.OnStart, 'record', [record, 'start']),
        callback(CallbackType.OnEnd, 'record', [record, 'end']),
      ]),
    ],
  });
  try {
    await ctx.rebuild();
    await ctx.rebuild();
    assert.equal(await readFile(record, 'utf8'), 'start\nend\nstart\nend\n');
  } finally {
    await ctx.dispose();
  }
});

test('watch mode rebuilds when executable watchFiles change', { timeout: 15_000 }, async (t) => {
  const directory = await tempDirectory(t);
  const entry = path.join(directory, 'entry.js');
  await writeFile(entry, 'first');
  let count = 0;
  let notify;
  const outputs = [];
  const ctx = await esbuild.context({
    entryPoints: [entry],
    write: false,
    format: 'esm',
    logLevel: 'silent',
    plugins: [
      createPlugin('watch-loader', [callback(CallbackType.OnLoad, 'watch-load', [], { filter: /entry\.js$/ })]),
      {
        name: 'observe',
        setup(build) {
          build.onEnd((result) => {
            outputs.push(result);
            count++;
            notify?.();
          });
        },
      },
    ],
  });
  const waitForBuild = (target) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('watch rebuild timed out')), 10_000);
      notify = () => {
        if (count >= target) {
          clearTimeout(timer);
          resolve();
        }
      };
      notify();
    });
  try {
    await ctx.watch();
    await waitForBuild(1);
    assert.equal(await evaluate(outputs[0]), 'first');
    await writeFile(entry, 'second');
    await waitForBuild(2);
    assert.equal(await evaluate(outputs.at(-1)), 'second');
  } finally {
    await ctx.dispose();
  }
});
