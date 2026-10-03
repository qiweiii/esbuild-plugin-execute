// Use a pinned ESM URL rather than an unversioned dependency.
import { zip } from 'https://cdn.jsdelivr.net/npm/lodash-es@4.17.21/lodash.js';

console.log(zip(['a', 'b'], [1, 2]));
