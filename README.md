# esbuild-plugin-execute

A small bridge between esbuild plugins and external executables 🙂.

Use it to implement esbuild callbacks with tools written in Go, Rust, Python,
or any language that can read command-line arguments and print JSON. Your build
configuration stays in JavaScript, and the executable handles the work.

This is about **interoperability and reusing existing tools**, not guaranteed
performance gains. Each matching callback starts a new process, so startup
overhead can outweigh the benefit of a faster implementation.

## Background

Inspired by the [esbuild plugin documentation](https://esbuild.github.io/plugins/)
and [esbuild issue #515](https://github.com/evanw/esbuild/issues/515), about using
Go and JavaScript plugins together.

## When to use it

- Reuse an existing executable to resolve imports or load custom file formats.
- Keep non-JavaScript tooling alongside regular JavaScript esbuild plugins.
- Run a tool at the start or end of each build, including rebuilds.

If all your plugin logic is already JavaScript, a regular esbuild plugin is
usually simpler. Executables used with this package must implement the protocol
below; arbitrary CLI tools are not automatically compatible.

## Installation

Requires Node.js 22.12.0 or newer and esbuild `^0.28.2`.
The package supports both ESM (`import`) and CommonJS (`require`), with
TypeScript declarations for each. It has no runtime dependencies of its own.

```sh
pnpm add -D esbuild-plugin-execute esbuild@0.28.2
```

You provide and install the executables. The plugin does not compile or download
them, and it runs in Node.js, not in the browser.

## Quick start

Here is a small text loader. It uses a Node.js executable to demonstrate the
protocol without requiring another compiler; the same interface works with an
executable written in another language.
esbuild already has a built-in text loader; this example is only a minimal
demonstration of the executable protocol.

Create `tools/load-text.cjs`:

```js
const { readFileSync } = require('node:fs');

// The first onLoad argument is the file path.
const [path] = process.argv.slice(2);
const contents = readFileSync(path, 'utf8');

console.log(JSON.stringify({ contents, loader: 'text', watchFiles: [path] }));
```

Then add it to `build.mjs`:

```js
import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import { createPlugin, CallbackType } from 'esbuild-plugin-execute';

const textPlugin = createPlugin('load-text', [
  {
    path: process.execPath,
    args: [fileURLToPath(new URL('./tools/load-text.cjs', import.meta.url))],
    type: CallbackType.OnLoad,
    filter: /\.txt$/,
    timeout: 5000,
  },
]);

await esbuild.build({
  entryPoints: ['app.js'],
  bundle: true,
  outfile: 'dist/app.js',
  plugins: [textPlugin],
});
```

Your application can now import text files:

```js
import message from './message.txt';
console.log(message);
```

For a native executable, use its path directly and omit `args` unless needed.
For a Python script, for example, use the interpreter as `path` and the script
path as the first fixed argument.

CommonJS builds can use the same API:

```js
const { createPlugin, CallbackType } = require('esbuild-plugin-execute');
```

## API

`createPlugin(name, callbacks)` returns an esbuild plugin.

```ts
interface Callback {
  path: string;
  type: CallbackType;
  filter?: RegExp;
  namespace?: string;
  args?: string[];
  timeout?: number;
  maxBuffer?: number;
}

enum CallbackType {
  OnResolve,
  OnLoad,
  OnStart,
  OnEnd,
}
```

- **`path`**: executable path, or a command available on `PATH`.
- **`filter`**: required for resolve and load callbacks. Keep filters narrow to
  avoid launching unnecessary processes.
- **`namespace`**: defaults to `file`. Use `''` to match all namespaces, including
  imports from stdin and virtual modules.
- **`args`**: fixed arguments placed before the callback arguments below.
- **`timeout`**: positive milliseconds; omitted means no timeout.
- **`maxBuffer`**: positive bytes, limiting stdout and stderr individually.
  Defaults to Node.js's `execFile` limit.

## Executable protocol

### Arguments

Callback arguments are positional strings, following any fixed `args`:

| Callback    | Arguments, in order                                                 |
| ----------- | ------------------------------------------------------------------- |
| `OnResolve` | `path`, `importer`, `namespace`, `resolveDir`, `kind`, `pluginData` |
| `OnLoad`    | `path`, `namespace`, `suffix`, `pluginData`                         |
| `OnStart`   | None                                                                |
| `OnEnd`     | None                                                                |

`pluginData` must be a string when provided. Missing or `null` data is passed as
an empty string; other types fail the build.

### Results

Resolve, load, and start callbacks must print **one JSON object** to stdout,
using the corresponding esbuild result shape:

- [`OnResolveResult`](https://esbuild.github.io/plugins/#resolve-results)
- [`OnLoadResult`](https://esbuild.github.io/plugins/#load-results)
- [`OnStartResult`](https://esbuild.github.io/plugins/#on-start)

Print `{}` or `null` to return no result. Keep diagnostic logs on stderr so they
do not interfere with JSON parsing. esbuild validates hook-specific fields.

End callbacks ignore stdout. They run after every build, including failed
builds, but do not receive the build result. Start callbacks also run on every
build. Both work with `esbuild.context()` and watch mode.

Invalid configuration throws when creating the plugin. A non-zero exit code,
missing executable, timeout, excessive output, or invalid JSON fails the build
instead of being silently ignored.

### Limitations and safety

- Executables run directly, without a shell. Only use trusted executables;
  this package is **not a sandbox**.
- Each invocation is a separate process; there is no persistent worker or
  shared in-process state.
- The argument protocol exposes the fields listed above, not the entire
  esbuild plugin API. It does not expose `setup`, `build.resolve`, or `onDispose`.
- JSON results cannot carry arbitrary JavaScript values such as functions or
  typed arrays. `pluginData` is string-only.

See the [Svelte example](./test/svelte-plugin-example) for a loader that wraps an
existing compiler.
The [Go HTTP example](./test/http-plugin-example) demonstrates native executables
for resolution and loading, including relative URL imports.

## Development

Use Node.js 22.12.0 or newer and pnpm 12.8.1, pinned in `package.json`.
The integration suite also requires an installed Go toolchain (Go 1.18 or newer).
Go tests compile standard-library-only sources; no modules or toolchains are downloaded.
For an existing checkout with a lockfile:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm audit --audit-level=high
pnpm test
pnpm types
pnpm lint
pnpm format:check
```

When changing dependencies, generate the lockfile and audit it before installing:

```sh
pnpm install --lockfile-only --ignore-scripts
pnpm audit --audit-level=high
pnpm install --frozen-lockfile --ignore-scripts
```

Stop if the audit fails; do not suppress advisories or bypass release-age checks.
Commit the reviewed `pnpm-lock.yaml` with dependency changes.

Install-time scripts are disabled, including automatic Git hook setup. Enable
hooks explicitly with `pnpm hooks:setup` if needed; do not enable all dependency
scripts to work around an installation issue.

`pnpm test` builds both module formats and their declarations, then runs the
integration tests. Use `pnpm build` or `pnpm build:types` separately when needed,
and `pnpm format` to format maintained files with Oxfmt. `pnpm format:check`
checks formatting without writing files; `pnpm lint` runs Oxlint's correctness
checks. Type checking remains a separate `pnpm types` command.
Run `pnpm test:go` for just the Go integration tests. Format Go sources with `gofmt`.

## License

MIT
