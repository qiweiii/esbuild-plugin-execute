import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const exampleDirectory = fileURLToPath(new URL('.', import.meta.url));

// Compile standard-library-only sources with the installed toolchain.
// Never download a Go toolchain or modules as part of an example or test.
export const goEnvironment = {
  ...process.env,
  GOTOOLCHAIN: 'local',
  GOPROXY: 'off',
  GOSUMDB: 'off',
  GOWORK: 'off',
  GO111MODULE: 'off',
};

export const compileExample = async (directory) => {
  await mkdir(directory, { recursive: true });
  const binaries = {};
  for (const name of ['resolveHttpPath', 'resolveHttpImports', 'loadResource']) {
    const executable = path.join(directory, name + (process.platform === 'win32' ? '.exe' : ''));
    await execFileAsync('go', ['build', '-o', executable, path.join(exampleDirectory, name, 'main.go')], {
      env: goEnvironment,
      timeout: 120_000,
    });
    binaries[name] = executable;
  }
  return binaries;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await compileExample(path.join(exampleDirectory, 'bin'));
  console.log('Go example executables compiled into test/http-plugin-example/bin');
}
