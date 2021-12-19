package loadResource

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
	data, _ := json.Marshal(loadResource(path))
	fmt.Println(string(data))
}

func loadResource(path string) *Result {
	res := &Result{
		Path:      path,
		Namespace: "http-url",
	}
	return res
}
