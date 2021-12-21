# esbuild-plugin-go

A tool to create esbuild plugins with a bunch of binaries 🙂.

Why? Inspired from esbuild [doc](https://esbuild.github.io/plugins/#plugin-api-limitations) and this [issue 515](https://github.com/evanw/esbuild/issues/515). To help using executables in esbuild plugins and also enable writting (parts of) esbuild plugins in other languages (which could be faster).

## Prerequisite

1. Knowledge of how to write esbuild plugin (note: this is a tool to create esbuild plugins)
2. Executables used in the plugin are installed on the machine

## Usage

This example recreates the plugin from https://esbuild.github.io/plugins/#resolve-callbacks

```javascript
import esbuild from 'esbuild';
import { createPlugin, CallbackType } from 'esbuild-plugin-execute';

let exampleOnResolvePlugin = createPlugin('example' [
  {
    path: './resolveImage/main', // executable path
    type: CallbackType.OnResolve,
    filter: /^images\//,
  },
  {
    path: './resolveHttp/main', // executable path
    type: CallbackType.OnResolve,
    filter: /^https?:\/\//,
  },
])

esbuild.build({
  entryPoints: ['app.js'],
  bundle: true,
  plugins: [exampleOnResolvePlugin],
  loader: { '.png': 'binary' },
}).catch(() => process.exit(1))
```

For example, the `./resolveHttp/main` executabe above could be like this if written in Go:

```Go
package main

import (
  "encoding/json"
  "fmt"
  "os"
)

type Result struct {
  Path      string `json:"path"`
  External  bool `json:"external"`
}

func main() {
  path := os.Args[1]
  data, _ := json.Marshal(resolveHttp(path))
  fmt.Println(string(data)) // print the json string to stdout
}

func resolveHttp(path string) *Result {
  res := &Result{
    Path:      path,
    External:  true,
  }
  return res
}
```

For more detailed examples, look at code in [test](./test) folder.

---

## Docs: createPlugin

`createPlugin: (name: string, callbacks: Callback[]): Plugin`

`createPlugin` takes in a plugin name and an array of callbacks:

```typescript
interface Callback {
  path: string; // path to the executable
  type: CallbackType; // one of CallbackType
  filter?: RegExp;  // https://esbuild.github.io/plugins/#filters
  namespace?: string; // https://esbuild.github.io/plugins/#namespaces
}

enum CallbackType {
  OnResolve,
  OnLoad,
  OnStart,
  OnEnd,
}
```

## Docs: executables

### 1. Arguments

Arguments are passed to your binary executable through command line.

For `CallbackType.OnResolve`, the following args are passed to your executable:

```typescript
// https://esbuild.github.io/plugins/#resolve-arguments
interface OnResolveArgs {
  path: string;
  importer: string;
  namespace: string;
  resolveDir: string;
  kind: ResolveKind;
  pluginData: any;
}

type ResolveKind =
  | 'entry-point'
  | 'import-statement'
  | 'require-call'
  | 'dynamic-import'
  | 'require-resolve'
  | 'import-rule'
  | 'url-token'
```

For `CallbackType.OnLoad`:

```typescript
// https://esbuild.github.io/plugins/#load-arguments
interface OnLoadArgs {
  path: string;
  namespace: string;
  suffix: string;
  pluginData: any;
}
```

For `CallbackType.OnStart`, no argument is passed to the executable.

For `CallbackType.OnEnd`, no argument is passed to the executable, because `BuildResult` is not easy to be passed to executable as arguments. In future, I may add a few items in `BuildResult`.


### 2. Returns

Executables should print JSON string to stdout.

For `CallbackType.OnResolve`:
- https://esbuild.github.io/plugins/#resolve-results

For `CallbackType.OnLoad`:
- https://esbuild.github.io/plugins/#load-results

For `CallbackType.OnStart`:
- https://pkg.go.dev/github.com/evanw/esbuild/pkg/api#OnStartResult

For `CallbackType.OnEnd`, no return value.


**IMPT: `OnResolveArgs.pluginData`, `OnResolveResult.pluginData`, `OnLoadArgs.pluginData`, `OnLoadResult.pluginData` are can only be text/string data**





--- 

## General design

### 1. How to run go code

Method 1: user provide the executable, goPlugin takes in a binary name and I just run it

Method 2: user provide the go code, goPlugin takes in a go file path, I convert it to executable and run it

I choose method 1, easier to use and fits more use cases

### 2. Go file -> executable

Method 1: I need to include an executable in my package (like what esbuild does), and use it to build the go code to produce an executable...

Method 2: Ask user to install go on their machine first...

I prefer method 1, easier for user to use.

After some research, since user will have to compile go code, the best way may be ask user to install Go on their machines.

### 3. User's code

We pass args as cmd line args to executable provided by user.

We get results from user's stdout.

### 4. TypeScipt

I should use typescript since esbuild API options and results have good types!

### 5. Support esm and cjs

Need to be able to be imported using both `require` or `import`

---





## Limitations

1. Not so easy to use overall...
2. Require user to parse args and make executables
3. Cannot write initialization code in `setup` function