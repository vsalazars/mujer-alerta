package services

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestNLPCloudTasksClientStartCreatesAuthenticatedHTTPTask(
	t *testing.T,
) {
	server := httptest.NewServer(
		http.HandlerFunc(func(
			response http.ResponseWriter,
			request *http.Request,
		) {
			if request.Method != http.MethodPost {
				t.Fatalf("método = %s; esperado POST", request.Method)
			}
			if request.Header.Get("Authorization") != "Bearer test-token" {
				t.Fatal("authorization incorrecta")
			}
			if !strings.HasSuffix(
				request.URL.Path,
				"/projects/proyecto/locations/us-east4/queues/cola/tasks",
			) {
				t.Fatalf("ruta inesperada: %s", request.URL.Path)
			}

			var createRequest struct {
				Task struct {
					Name        string `json:"name"`
					HTTPRequest struct {
						HTTPMethod string            `json:"httpMethod"`
						URL        string            `json:"url"`
						Headers    map[string]string `json:"headers"`
						Body       string            `json:"body"`
						OIDCToken  struct {
							ServiceAccountEmail string `json:"serviceAccountEmail"`
							Audience            string `json:"audience"`
						} `json:"oidcToken"`
					} `json:"httpRequest"`
				} `json:"task"`
			}
			if err := json.NewDecoder(request.Body).Decode(&createRequest); err != nil {
				t.Fatalf("payload inválido: %v", err)
			}

			httpRequest := createRequest.Task.HTTPRequest
			if httpRequest.HTTPMethod != http.MethodPost {
				t.Fatalf("httpMethod = %q", httpRequest.HTTPMethod)
			}
			if httpRequest.URL != "https://nlp.example.run.app/process" {
				t.Fatalf("url = %q", httpRequest.URL)
			}
			if httpRequest.OIDCToken.ServiceAccountEmail !=
				"invoker@proyecto.iam.gserviceaccount.com" {
				t.Fatalf(
					"service account = %q",
					httpRequest.OIDCToken.ServiceAccountEmail,
				)
			}
			if httpRequest.OIDCToken.Audience !=
				"https://nlp.example.run.app" {
				t.Fatalf("audience = %q", httpRequest.OIDCToken.Audience)
			}

			decodedBody, err := base64.StdEncoding.DecodeString(httpRequest.Body)
			if err != nil {
				t.Fatalf("body base64 inválido: %v", err)
			}

			var payload nlpCloudTaskPayload
			if err := json.Unmarshal(decodedBody, &payload); err != nil {
				t.Fatalf("body JSON inválido: %v", err)
			}
			if payload.JobID != "11111111-1111-1111-1111-111111111111" {
				t.Fatalf("job_id = %q", payload.JobID)
			}
			if len(payload.CentroIDs) != 1 || payload.CentroIDs[0] != 7 {
				t.Fatalf("centro_ids = %#v", payload.CentroIDs)
			}

			response.Header().Set("Content-Type", "application/json")
			_, _ = response.Write([]byte(`{
				"name": "projects/proyecto/locations/us-east4/queues/cola/tasks/nlp-test"
			}`))
		}),
	)
	defer server.Close()

	client := &NLPCloudTasksClient{
		ProjectID:           "proyecto",
		Region:              "us-east4",
		QueueName:           "cola",
		ServiceURL:          "https://nlp.example.run.app",
		ServiceAccountEmail: "invoker@proyecto.iam.gserviceaccount.com",
		HTTPClient:          server.Client(),
		APIBaseURL:          server.URL,
		StaticAccessToken:   "test-token",
	}

	state, err := client.Start(
		context.Background(),
		NLPRunOptions{
			JobID:     "11111111-1111-1111-1111-111111111111",
			CentroIDs: []int64{7, 7},
		},
	)
	if err != nil {
		t.Fatalf("Start() devolvió error: %v", err)
	}
	if !state.Running || state.Status != "queued" {
		t.Fatalf(
			"estado inesperado: running=%v status=%q",
			state.Running,
			state.Status,
		)
	}
}

func TestNormalizeNLPExecutionModeCloudTasks(t *testing.T) {
	if got := normalizeNLPExecutionMode("cloud_tasks"); got != NLPExecutionModeCloudTasks {
		t.Fatalf("modo = %q; esperado %q", got, NLPExecutionModeCloudTasks)
	}
}
