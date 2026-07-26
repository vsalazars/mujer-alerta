package services

import (
	"context"
	"errors"
	"sync"
	"time"
)

type NLPJobStatus struct {
	ID             string        `json:"-"`
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

type NLPJobStartRequest struct {
	InstitucionID int64
	RequestedBy   string
	Options       NLPRunOptions
}

type NLPJobStartResult struct {
	Status  NLPJobStatus
	Started bool
}

type NLPJobStore interface {
	Create(
		ctx context.Context,
		request NLPJobCreateRequest,
	) (NLPJobStatus, bool, error)

	GetLatest(
		ctx context.Context,
		institucionID int64,
		centros []int64,
		year *int,
	) (NLPJobStatus, error)

	ApplyEvent(
		ctx context.Context,
		jobID string,
		event map[string]any,
	) error

	Finish(
		ctx context.Context,
		jobID string,
		runErr error,
	) error
}

type NLPJobManager struct {
	runner NLPRunner
	store  NLPJobStore
}

func NewNLPJobManager(
	runner NLPRunner,
	store NLPJobStore,
) *NLPJobManager {
	return &NLPJobManager{
		runner: runner,
		store:  store,
	}
}

func (m *NLPJobManager) GetStatus(
	ctx context.Context,
	institucionID int64,
	centros []int64,
	year *int,
) (NLPJobStatus, error) {
	if m == nil || m.store == nil {
		return NLPJobStatus{}, errors.New("nlp job manager is not configured")
	}

	return m.store.GetLatest(
		ctx,
		institucionID,
		centros,
		year,
	)
}

func (m *NLPJobManager) Start(
	ctx context.Context,
	request NLPJobStartRequest,
) (NLPJobStartResult, error) {
	if m == nil || m.store == nil {
		return NLPJobStartResult{}, errors.New("nlp job manager is not configured")
	}

	job, started, err := m.store.Create(ctx, NLPJobCreateRequest{
		InstitucionID: request.InstitucionID,
		RequestedBy:   request.RequestedBy,
		Options:       request.Options,
	})
	if err != nil {
		return NLPJobStartResult{}, err
	}

	if !started {
		return NLPJobStartResult{
			Status:  job,
			Started: false,
		}, nil
	}

	go m.run(job.ID, request.Options)

	return NLPJobStartResult{
		Status:  job,
		Started: true,
	}, nil
}

func (m *NLPJobManager) run(
	jobID string,
	options NLPRunOptions,
) {
	ctx := context.Background()

	var (
		persistenceMu  sync.Mutex
		persistenceErr error
	)

	result, runErr := m.runner.RunAnalyzeCommentsWithProgress(
		ctx,
		options,
		func(event map[string]any) {
			if err := m.store.ApplyEvent(ctx, jobID, event); err != nil {
				persistenceMu.Lock()
				if persistenceErr == nil {
					persistenceErr = err
				}
				persistenceMu.Unlock()
			}
		},
	)

	persistenceMu.Lock()
	storedErr := persistenceErr
	persistenceMu.Unlock()

	finalErr := runErr
	if finalErr == nil && storedErr != nil {
		finalErr = storedErr
	}

	if err := m.store.Finish(ctx, jobID, finalErr); err != nil {
		return
	}

	_ = result
}

func cloneOptionalInt(value *int) *int {
	if value == nil {
		return nil
	}

	copyValue := *value
	return &copyValue
}
