package services

import (
	"encoding/json"
	"fmt"
	"os"
)

type Instrumento struct {
	// Campos que usa main.go
	Name    string `json:"name"`
	Version string `json:"version"`

	// Contiene TODO el JSON original (sin pérdida)
	Raw map[string]any `json:"-"`
}

// MarshalJSON hace que al responder la API
// se envíe el JSON COMPLETO, no solo Name/Version
func (i Instrumento) MarshalJSON() ([]byte, error) {
	return json.Marshal(i.Raw)
}

func LoadInstrumento(path string) (Instrumento, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return Instrumento{}, fmt.Errorf("read instrumento: %w", err)
	}

	var raw map[string]any
	if err := json.Unmarshal(b, &raw); err != nil {
		return Instrumento{}, fmt.Errorf("unmarshal instrumento: %w", err)
	}

	inst := Instrumento{
		Raw: raw,
	}

	// Extraemos solo lo que necesita main.go
	if v, ok := raw["name"].(string); ok {
		inst.Name = v
	}
	if v, ok := raw["version"].(string); ok {
		inst.Version = v
	}

	return inst, nil
}
