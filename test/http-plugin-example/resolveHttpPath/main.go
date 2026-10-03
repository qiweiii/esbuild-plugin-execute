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
	parsed, err := url.Parse(path)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		fmt.Fprintln(os.Stderr, "expected an absolute HTTP or HTTPS URL")
		os.Exit(1)
	}
	if err := json.NewEncoder(os.Stdout).Encode(resolveHttpPath(path)); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func resolveHttpPath(path string) *Result {
	res := &Result{
		Path:      path,
		Namespace: "http-url",
	}
	return res
}
