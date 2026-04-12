package services

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
)

type NLPRunner struct {
	PythonBin string
	WorkDir   string
	Module    string
	DBURL     string
}

type NLPRunOptions struct {
	Limit      *int
	EncuestaID string
	CentroIDs  []int64
	Year       *int
	DryRun     bool
}

type NLPRunResult struct {
	Command []string         `json:"command"`
	Events  []map[string]any `json:"events"`
	Stderr  []string         `json:"stderr"`
}

func NewNLPRunner(dbURL string) NLPRunner {
	pythonBin := os.Getenv("NLP_PYTHON_BIN")
	if pythonBin == "" {
		pythonBin = "python3"
	}

	workDir := os.Getenv("NLP_WORKDIR")
	if workDir == "" {
		workDir = filepath.Join("..", "mujer-nlp")
	}

	module := os.Getenv("NLP_MODULE")
	if module == "" {
		module = "src.analyze_comments"
	}

	return NLPRunner{
		PythonBin: pythonBin,
		WorkDir:   workDir,
		Module:    module,
		DBURL:     dbURL,
	}
}

func (r NLPRunner) RunAnalyzeComments(ctx context.Context, opts NLPRunOptions) (NLPRunResult, error) {
	args := []string{"-m", r.Module, "--json-progress"}

	if opts.Limit != nil {
		args = append(args, "--limit", strconv.Itoa(*opts.Limit))
	}
	if opts.EncuestaID != "" {
		args = append(args, "--encuesta-id", opts.EncuestaID)
	}
	if opts.Year != nil {
		args = append(args, "--year", strconv.Itoa(*opts.Year))
	}
	for _, centroID := range opts.CentroIDs {
		args = append(args, "--centro-id", strconv.FormatInt(centroID, 10))
	}
	if opts.DryRun {
		args = append(args, "--dry-run")
	}

	cmd := exec.CommandContext(ctx, r.PythonBin, args...)
	cmd.Dir = r.WorkDir
	cmd.Env = append(os.Environ(), "DATABASE_URL="+r.DBURL, "PYTHONUNBUFFERED=1")

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return NLPRunResult{}, fmt.Errorf("stdout pipe: %w", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return NLPRunResult{}, fmt.Errorf("stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return NLPRunResult{}, fmt.Errorf("start nlp process: %w", err)
	}

	result := NLPRunResult{
		Command: append([]string{r.PythonBin}, args...),
		Events:  []map[string]any{},
		Stderr:  []string{},
	}

	stderrDone := make(chan []string, 1)
	go func() {
		lines := []string{}
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			lines = append(lines, scanner.Text())
		}
		stderrDone <- lines
	}()

	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var event map[string]any
		if err := json.Unmarshal(line, &event); err == nil {
			result.Events = append(result.Events, event)
		}
	}
	if err := scanner.Err(); err != nil {
		return NLPRunResult{}, fmt.Errorf("read nlp stdout: %w", err)
	}

	waitErr := cmd.Wait()
	result.Stderr = <-stderrDone
	if waitErr != nil {
		return result, fmt.Errorf("nlp process failed: %w", waitErr)
	}

	return result, nil
}
