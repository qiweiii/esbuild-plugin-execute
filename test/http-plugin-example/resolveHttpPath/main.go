package main

import (
	"encoding/json"
	"fmt"
	"os"
)

type Result struct {
	Path      string `json:"path"`
	Namespace string `json:"namespace"`
}

func main() {
	path := os.Args[1]
	data, _ := json.Marshal(resolveHttpPath(path))
	fmt.Println(string(data))
}

func resolveHttpPath(path string) *Result {
	res := &Result{
		Path:      path,
		Namespace: "http-url",
	}
	return res
}
