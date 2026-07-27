package services

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"
)

const (
	NLPExecutionModeLocal    = "local"
	NLPExecutionModeCloudRun = "cloud-run"
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
	CloudExecution string        `json:"-"`
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

	SetCloudExecution(
		ctx context.Context,
		jobID string,
		state NLPExecutionState,
	) error

	SyncCloudExecution(
		ctx context.Context,
		jobID string,
		state NLPExecutionState,
	) error

	Finish(
		ctx context.Context,
		jobID string,
		runErr error,
	) error
}

type NLPJobManager struct {
	localRunner NLPRunner
	cloudClient *NLPCloudRunClient
	store       NLPJobStore
	mode        string
}

func NewNLPJobManager(
	localRunner NLPRunner,
	cloudClient *NLPCloudRunClient,
	store NLPJobStore,
	mode string,
) *NLPJobManager {
	mode = normalizeNLPExecutionMode(mode)

	return &NLPJobManager{
		localRunner: localRunner,
		cloudClient: cloudClient,
		store:       store,
		mode:        mode,
	}
}

func normalizeNLPExecutionMode(mode string) string {
	switch strings.ToLower(strings.TrimSpace(mode)) {
	case "cloud", "cloud-run", "cloud_run", "cloudrun":
		return NLPExecutionModeCloudRun
	default:
		return NLPExecutionModeLocal
	}
}

func (m *NLPJobManager) GetStatus(
	ctx context.Context,
	institucionID int64,
	centros []int64,
	year *int,
) (NLPJobStatus, error) {
	if m == nil || m.store == nil {
		return NLPJobStatus{}, errors.New(
			"nlp job manager is not configured",
		)
	}

	job, err := m.store.GetLatest(
		ctx,
		institucionID,
		centros,
		year,
	)
	if err != nil {
		return NLPJobStatus{}, err
	}

	if m.mode != NLPExecutionModeCloudRun ||
		!job.Running ||
		strings.TrimSpace(job.CloudExecution) == "" {
		return job, nil
	}

	if m.cloudClient == nil {
		return NLPJobStatus{}, errors.New(
			"nlp cloud run client is not configured",
		)
	}

	state, err := m.cloudClient.GetExecution(
		ctx,
		job.CloudExecution,
	)
	if err != nil {
		return NLPJobStatus{}, err
	}

	if err := m.store.SyncCloudExecution(
		ctx,
		job.ID,
		state,
	); err != nil {
		return NLPJobStatus{}, err
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
		return NLPJobStartResult{}, errors.New(
			"nlp job manager is not configured",
		)
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

	if m.mode == NLPExecutionModeCloudRun {
		return m.startCloudRun(
			ctx,
			job,
			request,
		)
	}

	go m.runLocal(job.ID, request.Options)

	return NLPJobStartResult{
		Status:  job,
		Started: true,
	}, nil
}

func (m *NLPJobManager) startCloudRun(
	ctx context.Context,
	job NLPJobStatus,
	request NLPJobStartRequest,
) (NLPJobStartResult, error) {
	if m.cloudClient == nil {
		err := errors.New(
			"nlp cloud run client is not configured",
		)
		_ = m.store.Finish(ctx, job.ID, err)
		return NLPJobStartResult{}, err
	}

	state, err := m.cloudClient.Start(
		ctx,
		request.Options,
	)
	if err != nil {
		_ = m.store.Finish(ctx, job.ID, err)
		return NLPJobStartResult{}, err
	}

	if err := m.store.SetCloudExecution(
		ctx,
		job.ID,
		state,
	); err != nil {
		_ = m.store.Finish(ctx, job.ID, err)
		return NLPJobStartResult{}, err
	}

	status, err := m.store.GetLatest(
		ctx,
		request.InstitucionID,
		request.Options.CentroIDs,
		request.Options.Year,
	)
	if err != nil {
		return NLPJobStartResult{}, err
	}

	return NLPJobStartResult{
		Status:  status,
		Started: true,
	}, nil
}

func (m *NLPJobManager) runLocal(
	jobID string,
	options NLPRunOptions,
) {
	ctx := context.Background()

	var (
		persistenceMu  sync.Mutex
		persistenceErr error
	)

	result, runErr := m.localRunner.RunAnalyzeCommentsWithProgress(
		ctx,
		options,
		func(event map[string]any) {
			if err := m.store.ApplyEvent(
				ctx,
				jobID,
				event,
			); err != nil {
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

	if err := m.store.Finish(
		ctx,
		jobID,
		finalErr,
	); err != nil {
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
