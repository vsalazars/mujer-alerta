package services

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

type fakeNLPJobStore struct {
	mu sync.Mutex

	job NLPJobStatus

	createStarted bool

	setCloudExecutionCalls  int
	syncCloudExecutionCalls int
	finishCalls             int

	setState  NLPExecutionState
	syncState NLPExecutionState
	finishErr error
}

func (s *fakeNLPJobStore) Create(
	ctx context.Context,
	request NLPJobCreateRequest,
) (NLPJobStatus, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.job, s.createStarted, nil
}

func (s *fakeNLPJobStore) GetLatest(
	ctx context.Context,
	institucionID int64,
	centros []int64,
	year *int,
) (NLPJobStatus, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.job, nil
}

func (s *fakeNLPJobStore) ApplyEvent(
	ctx context.Context,
	jobID string,
	event map[string]any,
) error {
	return nil
}

func (s *fakeNLPJobStore) SetCloudExecution(
	ctx context.Context,
	jobID string,
	state NLPExecutionState,
) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.setCloudExecutionCalls++
	s.setState = state
	s.job.CloudExecution = state.Name
	s.job.Running = state.Running
	s.job.Status = state.Status

	return nil
}

func (s *fakeNLPJobStore) SyncCloudExecution(
	ctx context.Context,
	jobID string,
	state NLPExecutionState,
) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.syncCloudExecutionCalls++
	s.syncState = state
	s.job.Running = state.Running
	s.job.Status = state.Status

	return nil
}

func (s *fakeNLPJobStore) Finish(
	ctx context.Context,
	jobID string,
	runErr error,
) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.finishCalls++
	s.finishErr = runErr
	s.job.Running = false

	if runErr != nil {
		s.job.Status = "failed"
	}

	return nil
}

func TestNLPJobManagerCloudRunStartPersistsExecution(
	t *testing.T,
) {
	executionName :=
		"projects/mujer-alerta-2026/locations/us-east4/" +
			"jobs/mujer-alerta-nlp/executions/mujer-alerta-nlp-test"

	server := httptest.NewServer(
		http.HandlerFunc(func(
			response http.ResponseWriter,
			request *http.Request,
		) {
			if request.Method != http.MethodPost {
				t.Fatalf(
					"método = %s; esperado POST",
					request.Method,
				)
			}

			response.Header().Set(
				"Content-Type",
				"application/json",
			)

			_, _ = response.Write([]byte(`{
				"name": "projects/mujer-alerta-2026/locations/us-east4/operations/op-test",
				"done": false,
				"metadata": {
					"name": "` + executionName + `",
					"job": "mujer-alerta-nlp",
					"reconciling": true,
					"conditions": [
						{
							"type": "Completed",
							"state": "CONDITION_PENDING"
						}
					]
				}
			}`))
		}),
	)
	defer server.Close()

	store := &fakeNLPJobStore{
		job: NLPJobStatus{
			ID:      "11111111-1111-1111-1111-111111111111",
			Key:     "institucion:1|centros:2|year:2026",
			Centros: []int64{2},
			Status:  "queued",
			Running: true,
		},
		createStarted: true,
	}

	client := &NLPCloudRunClient{
		ProjectID:         "mujer-alerta-2026",
		Region:            "us-east4",
		JobName:           "mujer-alerta-nlp",
		HTTPClient:        server.Client(),
		RunAPIBaseURL:     server.URL,
		StaticAccessToken: "test-token",
	}

	manager := NewNLPJobManager(
		NLPRunner{},
		client,
		store,
		NLPExecutionModeCloudRun,
	)

	year := 2026

	result, err := manager.Start(
		context.Background(),
		NLPJobStartRequest{
			InstitucionID: 1,
			RequestedBy:   "22222222-2222-2222-2222-222222222222",
			Options: NLPRunOptions{
				CentroIDs: []int64{2},
				Year:      &year,
			},
		},
	)
	if err != nil {
		t.Fatalf("Start() devolvió error: %v", err)
	}

	if !result.Started {
		t.Fatal("la ejecución Cloud Run debía iniciar")
	}

	if store.setCloudExecutionCalls != 1 {
		t.Fatalf(
			"SetCloudExecution llamadas = %d; esperado 1",
			store.setCloudExecutionCalls,
		)
	}

	if store.setState.Name != executionName {
		t.Fatalf(
			"execution name = %q; esperado %q",
			store.setState.Name,
			executionName,
		)
	}

	if store.finishCalls != 0 {
		t.Fatalf(
			"Finish llamadas = %d; esperado 0",
			store.finishCalls,
		)
	}
}

func TestNLPJobManagerCloudRunGetStatusSynchronizesCompletion(
	t *testing.T,
) {
	executionName :=
		"projects/mujer-alerta-2026/locations/us-east4/" +
			"jobs/mujer-alerta-nlp/executions/mujer-alerta-nlp-complete"

	completedAt := time.Date(
		2026,
		time.July,
		27,
		7,
		10,
		0,
		0,
		time.UTC,
	)

	server := httptest.NewServer(
		http.HandlerFunc(func(
			response http.ResponseWriter,
			request *http.Request,
		) {
			if request.Method != http.MethodGet {
				t.Fatalf(
					"método = %s; esperado GET",
					request.Method,
				)
			}

			response.Header().Set(
				"Content-Type",
				"application/json",
			)

			_, _ = response.Write([]byte(`{
				"name": "` + executionName + `",
				"job": "mujer-alerta-nlp",
				"completionTime": "` +
				completedAt.Format(time.RFC3339Nano) + `",
				"succeededCount": 1,
				"conditions": [
					{
						"type": "Completed",
						"state": "CONDITION_SUCCEEDED"
					}
				]
			}`))
		}),
	)
	defer server.Close()

	store := &fakeNLPJobStore{
		job: NLPJobStatus{
			ID:             "33333333-3333-3333-3333-333333333333",
			Key:            "institucion:1|centros:2|year:2026",
			Centros:        []int64{2},
			Status:         "running",
			Running:        true,
			CloudExecution: executionName,
		},
	}

	client := &NLPCloudRunClient{
		ProjectID:         "mujer-alerta-2026",
		Region:            "us-east4",
		JobName:           "mujer-alerta-nlp",
		HTTPClient:        server.Client(),
		RunAPIBaseURL:     server.URL,
		StaticAccessToken: "test-token",
	}

	manager := NewNLPJobManager(
		NLPRunner{},
		client,
		store,
		NLPExecutionModeCloudRun,
	)

	year := 2026

	status, err := manager.GetStatus(
		context.Background(),
		1,
		[]int64{2},
		&year,
	)
	if err != nil {
		t.Fatalf("GetStatus() devolvió error: %v", err)
	}

	if store.syncCloudExecutionCalls != 1 {
		t.Fatalf(
			"SyncCloudExecution llamadas = %d; esperado 1",
			store.syncCloudExecutionCalls,
		)
	}

	if status.Running {
		t.Fatal("la ejecución completada no debe seguir activa")
	}

	if status.Status != "completed" {
		t.Fatalf(
			"status = %q; esperado completed",
			status.Status,
		)
	}

	if store.syncState.SucceededCount != 1 {
		t.Fatalf(
			"succeeded count = %d; esperado 1",
			store.syncState.SucceededCount,
		)
	}
}

func TestNLPJobManagerDefaultsUnknownModeToLocal(
	t *testing.T,
) {
	manager := NewNLPJobManager(
		NLPRunner{},
		nil,
		&fakeNLPJobStore{},
		"valor-invalido",
	)

	if manager.mode != NLPExecutionModeLocal {
		t.Fatalf(
			"mode = %q; esperado %q",
			manager.mode,
			NLPExecutionModeLocal,
		)
	}
}
