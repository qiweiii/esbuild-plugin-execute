package main

import (
	"encoding/json"
	"fmt"
	"os"
)

func main() {
	if len(os.Args) < 2 {
		fail("expected resolve or load operation")
	}
	args := os.Args[2:]
	var result any
	switch os.Args[1] {
	case "resolve":
		if len(args) != 6 {
			fail("expected six onResolve arguments")
		}
		data, err := json.Marshal(args)
		if err != nil {
			fail(err.Error())
		}
		result = map[string]any{"path": args[0], "namespace": "go-module", "pluginData": string(data)}
	case "load":
		if len(args) != 4 {
			fail("expected four onLoad arguments")
		}
		data, err := json.Marshal(args)
		if err != nil {
			fail(err.Error())
		}
		result = map[string]any{"contents": "export default " + string(data), "loader": "js"}
	default:
		fail("unknown callback operation")
	}
	if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
		fail(err.Error())
	}
}

func fail(message string) {
	fmt.Fprintln(os.Stderr, message)
	os.Exit(1)
}
