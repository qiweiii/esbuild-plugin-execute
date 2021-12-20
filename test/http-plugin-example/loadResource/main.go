package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net"
	"net/http"
	"os"
	"time"
)

type Result struct {
	Contents string `json:"contents"`
}

func main() {
	path := os.Args[1]
	data, _ := json.Marshal(loadResource(path))
	fmt.Println(string(data))
}

func loadResource(path string) *Result {
	// to avoid TSL handshake timeout error
	// https://stackoverflow.com/a/41956295
	t := &http.Transport{
		Dial: (&net.Dialer{
			Timeout:   60 * time.Second,
			KeepAlive: 30 * time.Second,
		}).Dial,
		TLSHandshakeTimeout: 60 * time.Second,
	}
	c := &http.Client{
		Transport: t,
	}

	// to avoid EOF error: https://stackoverflow.com/a/19006050
	req, _ := http.NewRequest("GET", path, nil)
	req.Close = true

	// download resource
	res, err := c.Do(req)
	if err != nil {
		panic(err)
	}
	defer res.Body.Close()
	bytes, err := ioutil.ReadAll(res.Body)
	if err != nil {
		panic(err)
	}

	contents := string(bytes)
	return &Result{
		Contents: contents,
	}
}
