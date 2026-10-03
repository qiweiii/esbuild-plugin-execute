package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"time"
)

type Result struct {
	Contents   string `json:"contents"`
	Loader     string `json:"loader"`
	PluginData string `json:"pluginData"`
}

func main() {
	if len(os.Args) != 5 {
		fmt.Fprintln(os.Stderr, "expected four onLoad arguments")
		os.Exit(1)
	}
	result, err := loadResource(os.Args[1])
	if err == nil {
		err = json.NewEncoder(os.Stdout).Encode(result)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func loadResource(path string) (*Result, error) {
	parsed, err := url.Parse(path)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return nil, fmt.Errorf("expected an absolute HTTP or HTTPS URL: %s", path)
	}
	client := &http.Client{Timeout: 15 * time.Second}
	response, err := client.Get(path)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, fmt.Errorf("GET %s failed: %s", path, response.Status)
	}
	const maxResponseBytes = 1024 * 1024
	contents, err := io.ReadAll(io.LimitReader(response.Body, maxResponseBytes+1))
	if err != nil {
		return nil, err
	}
	if len(contents) > maxResponseBytes {
		return nil, fmt.Errorf("GET %s exceeded the 1 MiB response limit", path)
	}
	return &Result{Contents: string(contents), Loader: "js", PluginData: response.Request.URL.String()}, nil
}
