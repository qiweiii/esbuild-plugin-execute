import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { test } from 'node:test';
import * as esbuild from 'esbuild';
import { CallbackType, createPlugin } from 'esbuild-plugin-execute';
import { compileExample, goEnvironment } from './http-plugin-example/build-go.mjs';
import { createHTTPPlugin } from './http-plugin-example/build.mjs';

const execFileAsync = promisify(execFile);
const evaluate = async (result) =>
  (await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)).default;
const options = { bundle: true, write: false, format: 'esm', logLevel: 'silent' };

test('compiled Go executables and HTTP example', { timeout: 180_000 }, async (t) => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), 'esbuild-execute-go-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const executable = path.join(directory, 'callback' + (process.platform === 'win32' ? '.exe' : ''));
  await execFileAsync(
    'go',
    ['build', '-o', executable, fileURLToPath(new URL('./fixtures/callback.go', import.meta.url))],
    {
      env: goEnvironment,
      timeout: 120_000,
    },
  );

  await t.test('native Go resolve/load round-trip all positional arguments and pluginData', async () => {
    const entry = path.join(directory, 'entry.js');
    await writeFile(entry, 'export { default } from "go:module with spaces"');
    const result = await esbuild.build({
      ...options,
      entryPoints: [entry],
      plugins: [
        createPlugin('go', [
          { path: executable, args: ['resolve'], type: CallbackType.OnResolve, filter: /^go:/ },
          { path: executable, args: ['load'], type: CallbackType.OnLoad, filter: /.*/, namespace: 'go-module' },
        ]),
      ],
    });
    const [loadedPath, namespace, suffix, data] = await evaluate(result);
    assert.deepEqual([loadedPath, namespace, suffix], ['go:module with spaces', 'go-module', '']);
    assert.deepEqual(JSON.parse(data), ['go:module with spaces', entry, 'file', directory, 'import-statement', '']);
  });

  const binaries = await compileExample(path.join(directory, 'http-bin'));
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push(request.url);
    switch (request.url) {
      case '/entry.js':
        response.end('export { default } from "./nested/value.js"');
        break;
      case '/nested/value.js':
        response.end('export default "loaded by Go"');
        break;
      case '/redirect.js':
        response.writeHead(302, { Location: '/nested/entry.js' });
        response.end();
        break;
      case '/nested/entry.js':
        response.end('export { default } from "./value.js"');
        break;
      case '/large.js':
        response.end('x'.repeat(1024 * 1024 + 1));
        break;
      default:
        response.writeHead(404);
        response.end('missing');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))));
  const base = `http://127.0.0.1:${server.address().port}`;
  const buildHTTP = (resource) =>
    esbuild.build({
      ...options,
      stdin: { contents: `export { default } from ${JSON.stringify(base + resource)}`, resolveDir: process.cwd() },
      plugins: [createHTTPPlugin(binaries)],
    });

  await t.test('Go HTTP example loads resources and resolves relative imports', async () => {
    assert.equal(await evaluate(await buildHTTP('/entry.js')), 'loaded by Go');
    assert.ok(requests.includes('/nested/value.js'));
  });
  await t.test('Go HTTP example resolves relative imports against the final redirected URL', async () => {
    assert.equal(await evaluate(await buildHTTP('/redirect.js')), 'loaded by Go');
  });
  await t.test('HTTP errors propagate from Go stderr into build errors', async () => {
    await assert.rejects(buildHTTP('/missing.js'), /404 Not Found/);
  });
  await t.test('HTTP response size is bounded', async () => {
    await assert.rejects(buildHTTP('/large.js'), /1 MiB response limit/);
  });
});
