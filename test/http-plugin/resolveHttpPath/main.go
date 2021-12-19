package resolveHttpPath

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
)

type Result struct {
	Contents string `json:"contents"`
}

func main() {
	path := os.Args[1]
	data, _ := json.Marshal(resolveHttpPath(path))
	fmt.Println(string(data))
}

func resolveHttpPath(path string) *Result {
	res, err := http.Get(path)
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
