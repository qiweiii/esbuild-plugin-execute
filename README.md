# esbuild-plugin-go

A tool to create esbuild plugins with a bunch of binaries 🙂.

Why? Inspired from esbuild [doc](https://esbuild.github.io/plugins/#plugin-api-limitations) and this [issue 515](https://github.com/evanw/esbuild/issues/515). To help using executables in esbuild plugins and also writting (parts of) esbuild plugins in other languages.

## Prerequisite

1. Knowledge of how to write esbuild plugin (note: this is a tool to create esbuild plugins)
2. Executables used in the plugin you want to create is installed on the machine

## Usage

This example uses the code from ...

For a more detailed example, look at code in [test](./test) folder.

---

## Docs

### 1. Arguments

For `CallbackType.OnResolve`, the following args are passed to your executable:

1. `path` This is the fully-resolved path to the module.

2. `type` is the type of callback that executable.... could be one of `OnStart`, `OnEnd`, `OnResolve` or `OnLoad`

3. `filter` refer to esbuild [doc](https://esbuild.github.io/plugins/#filters)

4. `namespace` refer to esbuild [doc](https://esbuild.github.io/plugins/#namespaces)

### 2. Returns

JSON objects contaning:

- 




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