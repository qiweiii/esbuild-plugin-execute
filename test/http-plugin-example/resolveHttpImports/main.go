package main

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
)

type Result struct {
	Path      string `json:"path"`
	Namespace string `json:"namespace"`
}

func main() {
	path := os.Args[1]
	importer := os.Args[2]
	data, _ := json.Marshal(resolveHttpImports(path, importer))
	fmt.Println(string(data))
}

func resolveHttpImports(path string, importer string) *Result {
	base, err := url.Parse(importer)
	if err != nil {
		panic(err)
	}
	relative, err := url.Parse(path)
	if err != nil {
		panic(err)
	}
	res := &Result{
		Path:      base.ResolveReference(relative).String(),
		Namespace: "http-url",
	}
	return res
}
