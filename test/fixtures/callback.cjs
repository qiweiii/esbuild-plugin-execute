const fs = require('node:fs');
const [operation, ...args] = process.argv.slice(2);
const print = (result) => console.log(JSON.stringify(result));

switch (operation) {
  case 'resolve':
    print({ path: args[0], namespace: 'executable', pluginData: 'from-resolve' });
    break;
  case 'resolve-args':
    print({ path: args[0], namespace: 'executable', pluginData: JSON.stringify(args) });
    break;
  case 'load':
    print({ contents: `export default ${JSON.stringify(args)}`, loader: 'js' });
    break;
  case 'result':
    process.stdout.write(args[0]);
    break;
  case 'fail':
    console.error('fixture failed deliberately');
    process.exitCode = 1;
    break;
  case 'wait':
    setTimeout(() => print({}), 10_000);
    break;
  case 'large':
    process.stdout.write('x'.repeat(4096));
    break;
  case 'record':
    fs.appendFileSync(args[0], `${args[1]}\n`);
    print({});
    break;
  case 'watch-load':
    print({
      contents: `export default ${JSON.stringify(fs.readFileSync(args[0], 'utf8'))}`,
      loader: 'js',
      watchFiles: [args[0]],
    });
    break;
  default:
    throw new Error(`Unknown fixture operation: ${operation}`);
}
