package services

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

type NLPJobStatus struct {
	Key            string        `json:"key"`
	Centros        []int64       `json:"centros"`
	Year           *int          `json:"year,omitempty"`
	Running        bool          `json:"running"`
	Status         string        `json:"status"`
	Current        int           `json:"current"`
	Total          int           `json:"total"`
	Processed      int           `json:"processed"`
	Errors         int           `json:"errors"`
	LastEncuestaID string        `json:"last_encuesta_id,omitempty"`
	LastEvent      string        `json:"last_event,omitempty"`
	LastError      string        `json:"last_error,omitempty"`
	StartedAt      *time.Time    `json:"started_at,omitempty"`
	FinishedAt     *time.Time    `json:"finished_at,omitempty"`
	Result         *NLPRunResult `json:"result,omitempty"`
	UpdatedAt      time.Time     `json:"updated_at"`
}

type NLPJobStartResult struct {
	Status  NLPJobStatus
	Started bool
}

type NLPJobManager struct {
	runner NLPRunner

	mu   sync.RWMutex
	jobs map[string]*NLPJobStatus
}

func NewNLPJobManager(runner NLPRunner) *NLPJobManager {
	return &NLPJobManager{
		runner: runner,
		jobs:   map[string]*NLPJobStatus{},
	}
}

func BuildNLPJobKey(centros []int64, year *int) string {
	sorted := append([]int64{}, centros...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i] < sorted[j] })

	parts := make([]string, 0, len(sorted)+1)
	for _, centro := range sorted {
		parts = append(parts, strconv.FormatInt(centro, 10))
	}

	yearPart := "all"
	if year != nil {
		yearPart = strconv.Itoa(*year)
	}
	return fmt.Sprintf("centros:%s|year:%s", strings.Join(parts, ","), yearPart)
}

func (m *NLPJobManager) GetStatus(centros []int64, year *int) NLPJobStatus {
	key := BuildNLPJobKey(centros, year)

	m.mu.RLock()
	defer m.mu.RUnlock()

	if job, ok := m.jobs[key]; ok {
		return cloneNLPJobStatus(job)
	}

	return NLPJobStatus{
		Key:       key,
		Centros:   append([]int64{}, centros...),
		Year:      cloneOptionalInt(year),
		Status:    "idle",
		UpdatedAt: time.Now().UTC(),
	}
}

func (m *NLPJobManager) Start(ctx context.Context, opts NLPRunOptions) NLPJobStartResult {
	key := BuildNLPJobKey(opts.CentroIDs, opts.Year)
	now := time.Now().UTC()

	m.mu.Lock()
	if existing, ok := m.jobs[key]; ok && existing.Running {
		status := cloneNLPJobStatus(existing)
		m.mu.Unlock()
		return NLPJobStartResult{Status: status, Started: false}
	}

	job := &NLPJobStatus{
		Key:       key,
		Centros:   append([]int64{}, opts.CentroIDs...),
		Year:      cloneOptionalInt(opts.Year),
		Running:   true,
		Status:    "queued",
		StartedAt: &now,
		UpdatedAt: now,
	}
	m.jobs[key] = job
	m.mu.Unlock()

	go m.run(context.WithoutCancel(ctx), key, opts)

	return NLPJobStartResult{
		Status:  cloneNLPJobStatus(job),
		Started: true,
	}
}

func (m *NLPJobManager) run(ctx context.Context, key string, opts NLPRunOptions) {
	result, err := m.runner.RunAnalyzeCommentsWithProgress(ctx, opts, func(event map[string]any) {
		m.applyEvent(key, event)
	})

	now := time.Now().UTC()

	m.mu.Lock()
	defer m.mu.Unlock()

	job, ok := m.jobs[key]
	if !ok {
		return
	}

	job.Running = false
	job.UpdatedAt = now
	job.FinishedAt = &now
	job.Result = &result

	if err != nil {
		job.Status = "failed"
		job.LastError = err.Error()
		return
	}

	if job.Status == "queued" {
		job.Status = "completed"
	}
}

func (m *NLPJobManager) applyEvent(key string, event map[string]any) {
	now := time.Now().UTC()

	m.mu.Lock()
	defer m.mu.Unlock()

	job, ok := m.jobs[key]
	if !ok {
		return
	}

	job.UpdatedAt = now
	job.LastEvent = toString(event["event"])

	if total := toInt(event["total"]); total > 0 {
		job.Total = total
	}
	if current := toInt(event["current"]); current > 0 {
		job.Current = current
	}
	if processed := toInt(event["processed"]); processed >= 0 {
		job.Processed = processed
	}
	if errors := toInt(event["errors"]); errors >= 0 {
		job.Errors = errors
	}
	if encuestaID := toString(event["encuesta_id"]); encuestaID != "" {
		job.LastEncuestaID = encuestaID
	}

	switch toString(event["event"]) {
	case "start":
		job.Status = "running"
		if job.Total == 0 {
			job.Total = toInt(event["total"])
		}
	case "progress":
		job.Status = "running"
		status := toString(event["status"])
		switch status {
		case "processed", "dry-run":
			job.Processed++
		case "error":
			job.Errors++
			job.LastError = toString(event["error"])
		}
	case "complete":
		job.Status = "completed"
		job.Processed = toInt(event["processed"])
		job.Errors = toInt(event["errors"])
		if job.Total == 0 {
			job.Total = toInt(event["total"])
		}
		job.Current = job.Total
	}
}

func cloneNLPJobStatus(job *NLPJobStatus) NLPJobStatus {
	clone := *job
	clone.Centros = append([]int64{}, job.Centros...)
	clone.Year = cloneOptionalInt(job.Year)
	if job.Result != nil {
		resultCopy := *job.Result
		resultCopy.Command = append([]string{}, job.Result.Command...)
		resultCopy.Stderr = append([]string{}, job.Result.Stderr...)
		if len(job.Result.Events) > 0 {
			resultCopy.Events = make([]map[string]any, 0, len(job.Result.Events))
			for _, event := range job.Result.Events {
				eventCopy := map[string]any{}
				for k, v := range event {
					eventCopy[k] = v
				}
				resultCopy.Events = append(resultCopy.Events, eventCopy)
			}
		}
		clone.Result = &resultCopy
	}
	return clone
}

func cloneOptionalInt(value *int) *int {
	if value == nil {
		return nil
	}
	copyValue := *value
	return &copyValue
}

func toInt(value any) int {
	switch v := value.(type) {
	case int:
		return v
	case int32:
		return int(v)
	case int64:
		return int(v)
	case float64:
		return int(v)
	case float32:
		return int(v)
	default:
		return 0
	}
}

func toString(value any) string {
	if v, ok := value.(string); ok {
		return v
	}
	return ""
}
