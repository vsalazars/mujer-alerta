package services

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
)

type PreguntasInicialesSection struct {
	Raw map[string]any `json:"-"`
}

type PreguntasInicialesOption struct {
	OptionID string `json:"option_id"`
	Label    string `json:"label"`
}

type PreguntasInicialesQuestion struct {
	QuestionID string                     `json:"question_id"`
	Order      int                        `json:"order"`
	Prompt     string                     `json:"prompt"`
	Options    []PreguntasInicialesOption `json:"options"`
}

type PreguntasInicialesDefinition struct {
	SectionID    string                       `json:"section_id"`
	Name         string                       `json:"name"`
	Subtitle     string                       `json:"subtitle"`
	Instructions string                       `json:"instructions"`
	Questions    []PreguntasInicialesQuestion `json:"questions"`
}

type PreguntasInicialesMeta struct {
	AllowedOptionsByQuestion map[string]map[string]struct{}
	OrderedQuestionIDs       []string
	TotalQuestions           int
}

func LoadPreguntasIniciales(path string) (PreguntasInicialesSection, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return PreguntasInicialesSection{}, fmt.Errorf("read preguntas iniciales: %w", err)
	}

	var raw map[string]any
	if err := json.Unmarshal(b, &raw); err != nil {
		return PreguntasInicialesSection{}, fmt.Errorf("unmarshal preguntas iniciales: %w", err)
	}

	return PreguntasInicialesSection{Raw: raw}, nil
}

func (p PreguntasInicialesSection) MarshalJSON() ([]byte, error) {
	return json.Marshal(p.Raw)
}

func ParsePreguntasInicialesDefinition(section PreguntasInicialesSection) (PreguntasInicialesDefinition, error) {
	rawQuestions, ok := section.Raw["questions"].([]any)
	if !ok || len(rawQuestions) == 0 {
		return PreguntasInicialesDefinition{}, fmt.Errorf("preguntas iniciales sin questions")
	}

	def := PreguntasInicialesDefinition{
		SectionID:    stringValuePreguntasIniciales(section.Raw["section_id"]),
		Name:         stringValuePreguntasIniciales(section.Raw["name"]),
		Subtitle:     stringValuePreguntasIniciales(section.Raw["subtitle"]),
		Instructions: stringValuePreguntasIniciales(section.Raw["instructions"]),
		Questions:    make([]PreguntasInicialesQuestion, 0, len(rawQuestions)),
	}

	for idx, rawQuestion := range rawQuestions {
		questionMap, ok := rawQuestion.(map[string]any)
		if !ok {
			return PreguntasInicialesDefinition{}, fmt.Errorf("question %d invalida", idx)
		}

		questionID := stringValuePreguntasIniciales(questionMap["question_id"])
		if questionID == "" {
			return PreguntasInicialesDefinition{}, fmt.Errorf("question %d sin question_id", idx)
		}

		rawOptions, ok := questionMap["options"].([]any)
		if !ok || len(rawOptions) == 0 {
			return PreguntasInicialesDefinition{}, fmt.Errorf("question %s sin options", questionID)
		}

		question := PreguntasInicialesQuestion{
			QuestionID: questionID,
			Order:      toIntPreguntasIniciales(questionMap["order"]),
			Prompt:     stringValuePreguntasIniciales(questionMap["prompt"]),
			Options:    make([]PreguntasInicialesOption, 0, len(rawOptions)),
		}

		for optIdx, rawOption := range rawOptions {
			optionMap, ok := rawOption.(map[string]any)
			if !ok {
				return PreguntasInicialesDefinition{}, fmt.Errorf("option %d invalida en %s", optIdx, questionID)
			}
			optionID := stringValuePreguntasIniciales(optionMap["option_id"])
			if optionID == "" {
				return PreguntasInicialesDefinition{}, fmt.Errorf("option %d sin option_id en %s", optIdx, questionID)
			}
			question.Options = append(question.Options, PreguntasInicialesOption{
				OptionID: optionID,
				Label:    stringValuePreguntasIniciales(optionMap["label"]),
			})
		}

		def.Questions = append(def.Questions, question)
	}

	sort.Slice(def.Questions, func(i, j int) bool {
		if def.Questions[i].Order == def.Questions[j].Order {
			return def.Questions[i].QuestionID < def.Questions[j].QuestionID
		}
		return def.Questions[i].Order < def.Questions[j].Order
	})

	return def, nil
}

func BuildPreguntasInicialesMeta(section PreguntasInicialesSection) (PreguntasInicialesMeta, error) {
	def, err := ParsePreguntasInicialesDefinition(section)
	if err != nil {
		return PreguntasInicialesMeta{}, err
	}

	meta := PreguntasInicialesMeta{
		AllowedOptionsByQuestion: make(map[string]map[string]struct{}, len(def.Questions)),
		OrderedQuestionIDs:       make([]string, 0, len(def.Questions)),
		TotalQuestions:           len(def.Questions),
	}

	for _, question := range def.Questions {
		if _, exists := meta.AllowedOptionsByQuestion[question.QuestionID]; exists {
			return PreguntasInicialesMeta{}, fmt.Errorf("question_id duplicado: %s", question.QuestionID)
		}
		options := make(map[string]struct{}, len(question.Options))
		for _, option := range question.Options {
			options[option.OptionID] = struct{}{}
		}
		meta.AllowedOptionsByQuestion[question.QuestionID] = options
		meta.OrderedQuestionIDs = append(meta.OrderedQuestionIDs, question.QuestionID)
	}

	return meta, nil
}

func stringValuePreguntasIniciales(v any) string {
	s, _ := v.(string)
	return s
}

func toIntPreguntasIniciales(v any) int {
	switch n := v.(type) {
	case int:
		return n
	case int32:
		return int(n)
	case int64:
		return int(n)
	case float64:
		return int(n)
	default:
		return 0
	}
}
