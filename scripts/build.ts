// Build script copied from: https://github.com/iam-medvedev/esbuild-plugin-less/blob/master/scripts/build.ts
import { build, Format } from 'esbuild';
import * as path from 'path';

const formats: Format[] = ['cjs', 'esm'];

const getOutputFilename = (format: Format) => {
  switch (format) {
    case 'esm':
      return `${format}.mjs`;
    default:
      return `${format}.js`;
  }
};

const createBuild = () => {
  formats.map((format) => {
    const outputFilename = getOutputFilename(format);

    build({
      entryPoints: [path.resolve(__dirname, '..', 'src', 'index.ts')],
      bundle: true,
      minify: true,
      platform: 'node',
      loader: {
        '.ts': 'ts',
      },
      external: ['child_process', 'util', 'chalk'],
      outfile: path.resolve(__dirname, '..', 'build', outputFilename),
      format,
    })
      .then(() => {
        console.info(`— ${outputFilename} was built`);
      })
      .catch((e) => {
        console.info(`🚨 ${outputFilename} build error:`);
        console.error(e);
      });
  });
};

createBuild();
