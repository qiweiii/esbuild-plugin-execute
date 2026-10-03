# Go HTTP plugin example

Three small Go executables implement esbuild resolve/load callbacks using only
the Go standard library. They fetch JavaScript modules over HTTP(S) and resolve
relative imports against the importing module's URL.

Requirements: the installed Go toolchain (Go 1.18 or newer), Node.js, and the
repository's development dependencies. From the repository root:

```sh
pnpm build
node test/http-plugin-example/build-go.mjs
node test/http-plugin-example/build.mjs
```

The compiler writes platform-specific executables into the ignored `bin/`
directory. No Go modules or toolchains are downloaded. The example no longer
uses the old checked-in binaries.

The example application imports a pinned public ESM URL, so running it needs
network access. The automated tests use a local HTTP server instead:

```sh
pnpm test:go
```

The HTTP loader follows redirects and passes the final URL through string
`pluginData` so relative imports resolve correctly. It rejects unsuccessful HTTP responses, limits
responses to 1 MiB, and uses a 15-second HTTP timeout. Errors go to stderr and
cause a non-zero exit; callback results are JSON on stdout.

This is a demonstration, not a production dependency-fetching system. A pinned
URL is not an integrity check, responses are not cached between invocations,
and remote contents are not watched for changes. Only build from trusted URLs.
