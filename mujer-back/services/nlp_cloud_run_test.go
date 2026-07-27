package services

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
)

func TestBuildNLPCloudRunArguments(t *testing.T) {
	limit := 15
	year := 2026

	got := buildNLPCloudRunArguments(NLPRunOptions{
		Limit:      &limit,
		EncuestaID: " encuesta-uno ",
		CentroIDs:  []int64{8, 2, 8, 0, -1},
		Year:       &year,
		DryRun:     true,
	})

	want := []string{
		"--json-progress",
		"--limit", "15",
		"--encuesta-id", "encuesta-uno",
		"--centro-id", "2",
		"--centro-id", "8",
		"--year", "2026",
		"--dry-run",
	}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf(
			"argumentos = %#v; esperado %#v",
			got,
			want,
		)
	}
}

func TestNLPCloudRunClientStartUsesMetadataExecutionName(
	t *testing.T,
) {
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

			if request.Header.Get("Authorization") != "Bearer test-token" {
				t.Fatalf("authorization incorrecta")
			}

			var payload map[string]any
			if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
				t.Fatalf("payload inválido: %v", err)
			}

			response.Header().Set(
				"Content-Type",
				"application/json",
			)

			_, _ = response.Write([]byte(`{
				"name": "projects/proyecto/locations/region/operations/op-1",
				"done": false,
				"metadata": {
					"@type": "type.googleapis.com/google.cloud.run.v2.Execution",
					"name": "projects/proyecto/locations/region/jobs/job/executions/job-abc",
					"job": "job",
					"createTime": "2026-07-26T21:33:38.599004Z",
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

	client := &NLPCloudRunClient{
		ProjectID:         "proyecto",
		Region:            "region",
		JobName:           "job",
		HTTPClient:        server.Client(),
		RunAPIBaseURL:     server.URL,
		StaticAccessToken: "test-token",
	}

	state, err := client.Start(
		context.Background(),
		NLPRunOptions{},
	)
	if err != nil {
		t.Fatalf("Start() devolvió error: %v", err)
	}

	wantName := "projects/proyecto/locations/region/jobs/job/executions/job-abc"

	if state.Name != wantName {
		t.Fatalf(
			"execution name = %q; esperado %q",
			state.Name,
			wantName,
		)
	}

	if !state.Running || state.Status != "running" {
		t.Fatalf(
			"estado inesperado: running=%v status=%q",
			state.Running,
			state.Status,
		)
	}
}

func TestMapCloudRunExecutionCompleted(t *testing.T) {
	state := mapCloudRunExecution(cloudRunExecution{
		Name:           "execution-uno",
		SucceededCount: 1,
		Conditions: []cloudRunCondition{
			{
				Type:  "Completed",
				State: "CONDITION_SUCCEEDED",
			},
		},
	})

	if state.Running {
		t.Fatal("la ejecución completada no debe seguir activa")
	}

	if state.Status != "completed" {
		t.Fatalf(
			"status = %q; esperado completed",
			state.Status,
		)
	}
}

func TestMapCloudRunExecutionFailed(t *testing.T) {
	state := mapCloudRunExecution(cloudRunExecution{
		Name:        "execution-dos",
		FailedCount: 1,
		Conditions: []cloudRunCondition{
			{
				Type:    "Completed",
				State:   "CONDITION_FAILED",
				Message: "falló el procesamiento",
			},
		},
	})

	if state.Running {
		t.Fatal("la ejecución fallida no debe seguir activa")
	}

	if state.Status != "failed" {
		t.Fatalf(
			"status = %q; esperado failed",
			state.Status,
		)
	}

	if state.Error != "falló el procesamiento" {
		t.Fatalf(
			"error = %q",
			state.Error,
		)
	}
}
