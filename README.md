# esbuild-plugin-go

An esbuild plugin to load Go code/callbacks 🙂

Why? According to esbuild [doc](https://esbuild.github.io/plugins/#plugin-api-limitations), plugins written in Go should be faster than plugins written in JavaScript, so I created this plugin to help loading Go code/callbacks in our build.

## Prerequisite

1. Go is installed on the machine
2. Make sure imported go packages in yout go code have been installed.

## Usage

This example uses the code from [exampleOnResolvePlugin](https://esbuild.github.io/plugins/#resolve-callbacks).

```js
// in your build script
const goPlugin = require('esbuild-plugin-go');

esbuild.build({
  plugins: [
    // Redirect all paths starting with "images/" to "./public/images/"
    goPlugin('./images.go', PluginCallback.OnResolve, /^images\//)
    // Mark all paths starting with "http://" or "https://" as external
    goPlugin('./https.go', PluginCallback.OnResolve, /^https?:\/\//)
  ]
})
```

`PluginCallback.OnResolve` means the function in `images.go` will take fields in [`OnResolveArgs`](https://esbuild.github.io/plugins/#resolve-arguments) as aruguments.

Example go code:

```go
// images.go
package main

import "path/filepath"
import "github.com/evanw/esbuild/pkg/api"

func images(args api.OnResolveArgs) (api.OnResolveResult, error) {
  return api.OnResolveResult{
    Path: filepath.Join(args.ResolveDir, "public", args.Path),
  }, nil
}

// https.go
package main

import "path/filepath"
import "github.com/evanw/esbuild/pkg/api"

func https(args api.OnResolveArgs) (api.OnResolveResult, error) {
  return api.OnResolveResult{
    Path:     args.Path,
    External: true,
  }, nil
}
```

For a more detailed example, look at code in [test](./test) folder.

---

## Docs
### 1. goPlugin: arguments

`goPlugin(path: string, callbackType: PluginCallback, filter: RegExp, namepace?: string)`

`path` is the relative path of the `.go` file.

`PluginCallback` is the type of function, could be one of `OnStart`, `OnEnd`, `OnResolve` or `OnLoad`

`filter` refer to esbuild [doc](https://esbuild.github.io/plugins/#filters)

`namespace` refer to esbuild [doc](https://esbuild.github.io/plugins/#namespaces)

### 2. Go code: arguments and returns

You only need to provide a `.go` file with a `main` function, the arguments passed to it depends on the type of `PluginCallback` which could be `OnStart`, `OnEnd`, `OnResolve` or `OnLoad`.

```go
// depends on type of `PluginCallback` passed in `goPlugin`, use one of the function type:
// OnResolve:
func (args ...OnResolveArgs) OnResolveResult
// OnLoad:
func (args ...OnLoadArgs) OnLoadResult
// OnStart:
func () (OnStartResult, error)
// OnEnd:
func (result *BuildResult))
```

All types mentioned above could be found in https://pkg.go.dev/github.com/evanw/esbuild/pkg/api#pkg-types

(**IMPT: we don't support `OnResolveArgs.pluginData`, `OnResolveResult.pluginData`, `OnLoadArgs.pluginData`, `OnLoadResult.pluginData` yet, they are not passed in to your function, and if you return them, they will be ignored**)





--- 

## General design

### 1. How to run go code

Method 1: user provide the executable, goPlugin takes in a binary name and I just run it

Method 2: user provide the go code, goPlugin takes in a go file path, I convert it to executable and run it

I choose method 2, easier for user to use.

### 2. Go file -> executable

Method 1: I need to include an executable in my package (like what esbuild does), and use it to build the go code to produce an executable...

Method 2: Ask user to install go on their machine first...

I prefer method 1, easier for user to use.

After some research, since user will have to compile go code, the best way may be ask user to install Go on their machines.

### 3. User's Go code

The `.go` file will be created to executable, the executable can only take string arguments, but Resolve arguments and Load arguments have `pluginData` that can be any data... 

The problem is how to pass pluginData into executable... maybe don't support it yet...

Return results are the same, the only problem is pluginData...

### 4. TypeScipt

I should use typescript! Since esbuild API options and results have good types!

### 5. Plugin's module support

Need to be able to be imported using both `require` or `import`


---





## Limitations

1. Could not put all plugin code in on file due to design
2. Require Go to be downloaded, and go module created
3. Difficult to use in CI...