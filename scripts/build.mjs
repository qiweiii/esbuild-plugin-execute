// Build script copied from: https://github.com/iam-medvedev/esbuild-plugin-less/blob/master/scripts/build.ts
import { build } from 'esbuild';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const formats = ['cjs', 'esm'];

const getOutputFilename = (format) => {
  switch (format) {
    case 'esm':
      return `${format}.mjs`;
    default:
      return `${format}.js`;
  }
};

await Promise.all(
  formats.map(async (format) => {
    const outputFilename = getOutputFilename(format);

    await build({
      entryPoints: [path.resolve(__dirname, '..', 'src', 'index.ts')],
      bundle: true,
      minify: true,
      platform: 'node',
      loader: {
        '.ts': 'ts',
      },
      packages: 'external',
      outfile: path.resolve(__dirname, '..', 'build', outputFilename),
      format,
    });
    console.info(`— ${outputFilename} was built`);
  }),
);
