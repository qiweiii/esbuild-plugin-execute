import { copyFile } from 'node:fs/promises';

// The public declarations only import external types, so both formats share
// the same API. Explicit extensions let NodeNext distinguish ESM from CJS.
const declaration = new URL('../build/index.d.ts', import.meta.url);
await Promise.all(
  ['mts', 'cts'].map((extension) => copyFile(declaration, new URL(`../build/index.d.${extension}`, import.meta.url))),
);
