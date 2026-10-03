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
	if len(os.Args) != 7 {
		fmt.Fprintln(os.Stderr, "expected six onResolve arguments")
		os.Exit(1)
	}
	path := os.Args[1]
	importer := os.Args[2]
	// The loader passes the final URL so relative imports also work after redirects.
	if os.Args[6] != "" {
		importer = os.Args[6]
	}
	result, err := resolveHttpImports(path, importer)
	if err == nil {
		err = json.NewEncoder(os.Stdout).Encode(result)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func resolveHttpImports(path string, importer string) (*Result, error) {
	base, err := url.Parse(importer)
	if err != nil {
		return nil, err
	}
	relative, err := url.Parse(path)
	if err != nil {
		return nil, err
	}
	res := &Result{
		Path:      base.ResolveReference(relative).String(),
		Namespace: "http-url",
	}
	return res, nil
}
