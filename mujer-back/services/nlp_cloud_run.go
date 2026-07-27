package services

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	defaultNLPCloudProjectID = "mujer-alerta-2026"
	defaultNLPCloudRegion    = "us-east4"
	defaultNLPCloudJobName   = "mujer-alerta-nlp"

	googleMetadataTokenURL = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token"
	googleRunAPIBaseURL    = "https://run.googleapis.com/v2"
)

type NLPExecutionState struct {
	Name                string
	Job                 string
	Running             bool
	Status              string
	Error               string
	CreatedAt           *time.Time
	StartedAt           *time.Time
	CompletedAt         *time.Time
	SucceededCount      int
	FailedCount         int
	CancelledCount      int
	CompletionCondition string
}

type NLPCloudRunClient struct {
	ProjectID string
	Region    string
	JobName   string

	HTTPClient        *http.Client
	TokenURL          string
	RunAPIBaseURL     string
	StaticAccessToken string
}

type cloudRunJobOperation struct {
	Name     string            `json:"name"`
	Done     bool              `json:"done"`
	Metadata cloudRunExecution `json:"metadata"`
	Error    *cloudRunError    `json:"error,omitempty"`
}

type cloudRunExecution struct {
	Name           string              `json:"name"`
	Job            string              `json:"job"`
	Reconciling    bool                `json:"reconciling"`
	CreateTime     string              `json:"createTime"`
	StartTime      string              `json:"startTime"`
	CompletionTime string              `json:"completionTime"`
	SucceededCount int                 `json:"succeededCount"`
	FailedCount    int                 `json:"failedCount"`
	CancelledCount int                 `json:"cancelledCount"`
	RetriedCount   int                 `json:"retriedCount"`
	RunningCount   int                 `json:"runningCount"`
	PendingCount   int                 `json:"pendingCount"`
	Conditions     []cloudRunCondition `json:"conditions"`
}

type cloudRunCondition struct {
	Type     string `json:"type"`
	State    string `json:"state"`
	Message  string `json:"message"`
	Reason   string `json:"reason"`
	Severity string `json:"severity"`
}

type cloudRunError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Status  string `json:"status"`
}

type googleMetadataToken struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	TokenType   string `json:"token_type"`
}

func NewNLPCloudRunClientFromEnv() *NLPCloudRunClient {
	projectID := firstConfiguredValue(
		os.Getenv("NLP_CLOUD_RUN_PROJECT_ID"),
		os.Getenv("GOOGLE_CLOUD_PROJECT"),
		os.Getenv("GCP_PROJECT"),
		defaultNLPCloudProjectID,
	)

	region := firstConfiguredValue(
		os.Getenv("NLP_CLOUD_RUN_REGION"),
		defaultNLPCloudRegion,
	)

	jobName := firstConfiguredValue(
		os.Getenv("NLP_CLOUD_RUN_JOB"),
		defaultNLPCloudJobName,
	)

	return &NLPCloudRunClient{
		ProjectID: projectID,
		Region:    region,
		JobName:   jobName,
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		TokenURL:      googleMetadataTokenURL,
		RunAPIBaseURL: googleRunAPIBaseURL,
	}
}

func (c *NLPCloudRunClient) Start(
	ctx context.Context,
	options NLPRunOptions,
) (NLPExecutionState, error) {
	if err := c.validate(); err != nil {
		return NLPExecutionState{}, err
	}

	arguments := buildNLPCloudRunArguments(options)

	payload := map[string]any{
		"overrides": map[string]any{
			"containerOverrides": []map[string]any{
				{
					"args": arguments,
				},
			},
			"taskCount": 1,
		},
	}

	endpoint := fmt.Sprintf(
		"%s/projects/%s/locations/%s/jobs/%s:run",
		strings.TrimRight(c.apiBaseURL(), "/"),
		url.PathEscape(c.ProjectID),
		url.PathEscape(c.Region),
		url.PathEscape(c.JobName),
	)

	var operation cloudRunJobOperation

	if err := c.requestJSON(
		ctx,
		http.MethodPost,
		endpoint,
		payload,
		&operation,
	); err != nil {
		return NLPExecutionState{}, fmt.Errorf(
			"iniciar Cloud Run Job %s: %w",
			c.JobName,
			err,
		)
	}

	if operation.Error != nil {
		return NLPExecutionState{}, fmt.Errorf(
			"Cloud Run Job rechazado: %s",
			operation.Error.Message,
		)
	}

	if strings.TrimSpace(operation.Metadata.Name) == "" {
		return NLPExecutionState{}, errors.New(
			"Cloud Run no devolvió metadata.name de la ejecución",
		)
	}

	return mapCloudRunExecution(operation.Metadata), nil
}

func (c *NLPCloudRunClient) GetExecution(
	ctx context.Context,
	executionName string,
) (NLPExecutionState, error) {
	if err := c.validate(); err != nil {
		return NLPExecutionState{}, err
	}

	executionName = strings.TrimSpace(executionName)
	if executionName == "" {
		return NLPExecutionState{}, errors.New(
			"cloud execution name is required",
		)
	}

	expectedPrefix := fmt.Sprintf(
		"projects/%s/locations/%s/jobs/%s/executions/",
		c.ProjectID,
		c.Region,
		c.JobName,
	)

	if !strings.HasPrefix(executionName, expectedPrefix) {
		return NLPExecutionState{}, fmt.Errorf(
			"ejecución fuera del Job configurado: %s",
			executionName,
		)
	}

	endpoint := fmt.Sprintf(
		"%s/%s",
		strings.TrimRight(c.apiBaseURL(), "/"),
		escapeCloudRunResourceName(executionName),
	)

	var execution cloudRunExecution

	if err := c.requestJSON(
		ctx,
		http.MethodGet,
		endpoint,
		nil,
		&execution,
	); err != nil {
		return NLPExecutionState{}, fmt.Errorf(
			"consultar ejecución Cloud Run: %w",
			err,
		)
	}

	return mapCloudRunExecution(execution), nil
}

func (c *NLPCloudRunClient) validate() error {
	if c == nil {
		return errors.New("nlp cloud run client is nil")
	}

	if strings.TrimSpace(c.ProjectID) == "" {
		return errors.New("NLP_CLOUD_RUN_PROJECT_ID is required")
	}

	if strings.TrimSpace(c.Region) == "" {
		return errors.New("NLP_CLOUD_RUN_REGION is required")
	}

	if strings.TrimSpace(c.JobName) == "" {
		return errors.New("NLP_CLOUD_RUN_JOB is required")
	}

	return nil
}

func (c *NLPCloudRunClient) requestJSON(
	ctx context.Context,
	method string,
	endpoint string,
	requestBody any,
	responseBody any,
) error {
	client := c.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 30 * time.Second}
	}

	accessToken, err := c.accessToken(ctx, client)
	if err != nil {
		return err
	}

	var body io.Reader

	if requestBody != nil {
		encoded, err := json.Marshal(requestBody)
		if err != nil {
			return fmt.Errorf("codificar solicitud: %w", err)
		}

		body = bytes.NewReader(encoded)
	}

	request, err := http.NewRequestWithContext(
		ctx,
		method,
		endpoint,
		body,
	)
	if err != nil {
		return err
	}

	request.Header.Set(
		"Authorization",
		"Bearer "+accessToken,
	)

	if requestBody != nil {
		request.Header.Set(
			"Content-Type",
			"application/json",
		)
	}

	response, err := client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	responseData, err := io.ReadAll(
		io.LimitReader(response.Body, 4<<20),
	)
	if err != nil {
		return err
	}

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		var apiError struct {
			Error cloudRunError `json:"error"`
		}

		if json.Unmarshal(responseData, &apiError) == nil &&
			strings.TrimSpace(apiError.Error.Message) != "" {
			return fmt.Errorf(
				"HTTP %d: %s",
				response.StatusCode,
				apiError.Error.Message,
			)
		}

		return fmt.Errorf(
			"HTTP %d: %s",
			response.StatusCode,
			strings.TrimSpace(string(responseData)),
		)
	}

	if responseBody == nil || len(responseData) == 0 {
		return nil
	}

	if err := json.Unmarshal(responseData, responseBody); err != nil {
		return fmt.Errorf(
			"decodificar respuesta de Cloud Run: %w",
			err,
		)
	}

	return nil
}

func (c *NLPCloudRunClient) accessToken(
	ctx context.Context,
	client *http.Client,
) (string, error) {
	if token := strings.TrimSpace(c.StaticAccessToken); token != "" {
		return token, nil
	}

	tokenURL := strings.TrimSpace(c.TokenURL)
	if tokenURL == "" {
		tokenURL = googleMetadataTokenURL
	}

	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		tokenURL,
		nil,
	)
	if err != nil {
		return "", err
	}

	request.Header.Set("Metadata-Flavor", "Google")

	response, err := client.Do(request)
	if err != nil {
		return "", fmt.Errorf(
			"obtener token del metadata server: %w",
			err,
		)
	}
	defer response.Body.Close()

	responseData, err := io.ReadAll(
		io.LimitReader(response.Body, 1<<20),
	)
	if err != nil {
		return "", err
	}

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return "", fmt.Errorf(
			"metadata server HTTP %d: %s",
			response.StatusCode,
			strings.TrimSpace(string(responseData)),
		)
	}

	var token googleMetadataToken

	if err := json.Unmarshal(responseData, &token); err != nil {
		return "", fmt.Errorf(
			"decodificar token del metadata server: %w",
			err,
		)
	}

	if strings.TrimSpace(token.AccessToken) == "" {
		return "", errors.New(
			"metadata server devolvió un token vacío",
		)
	}

	return token.AccessToken, nil
}

func buildNLPCloudRunArguments(options NLPRunOptions) []string {
	arguments := []string{"--json-progress"}

	if options.Limit != nil {
		arguments = append(
			arguments,
			"--limit",
			strconv.Itoa(*options.Limit),
		)
	}

	if encuestaID := strings.TrimSpace(options.EncuestaID); encuestaID != "" {
		arguments = append(
			arguments,
			"--encuesta-id",
			encuestaID,
		)
	}

	for _, centroID := range normalizeCentroIDs(options.CentroIDs) {
		arguments = append(
			arguments,
			"--centro-id",
			strconv.FormatInt(centroID, 10),
		)
	}

	if options.Year != nil {
		arguments = append(
			arguments,
			"--year",
			strconv.Itoa(*options.Year),
		)
	}

	if options.DryRun {
		arguments = append(arguments, "--dry-run")
	}

	return arguments
}

func mapCloudRunExecution(
	execution cloudRunExecution,
) NLPExecutionState {
	state := NLPExecutionState{
		Name:           execution.Name,
		Job:            execution.Job,
		Running:        true,
		Status:         "running",
		CreatedAt:      parseCloudRunTime(execution.CreateTime),
		StartedAt:      parseCloudRunTime(execution.StartTime),
		CompletedAt:    parseCloudRunTime(execution.CompletionTime),
		SucceededCount: execution.SucceededCount,
		FailedCount:    execution.FailedCount,
		CancelledCount: execution.CancelledCount,
	}

	for _, condition := range execution.Conditions {
		if condition.Type != "Completed" {
			continue
		}

		state.CompletionCondition = condition.State

		switch condition.State {
		case "CONDITION_SUCCEEDED":
			state.Running = false
			state.Status = "completed"

		case "CONDITION_FAILED":
			state.Running = false
			state.Status = "failed"
			state.Error = firstConfiguredValue(
				condition.Message,
				condition.Reason,
				"Cloud Run Job failed",
			)

		case "CONDITION_PENDING",
			"CONDITION_RECONCILING",
			"CONDITION_UNKNOWN":
			state.Running = true
			state.Status = "running"
		}

		break
	}

	if state.CancelledCount > 0 {
		state.Running = false
		state.Status = "cancelled"
	}

	if state.FailedCount > 0 &&
		state.CompletionCondition == "" {
		state.Running = false
		state.Status = "failed"
		state.Error = "Cloud Run Job registró tareas fallidas"
	}

	if state.CompletedAt != nil &&
		state.Status == "running" {
		state.Running = false

		if state.FailedCount > 0 {
			state.Status = "failed"
			state.Error = "Cloud Run Job finalizó con tareas fallidas"
		} else {
			state.Status = "completed"
		}
	}

	return state
}

func parseCloudRunTime(value string) *time.Time {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}

	parsed, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		return nil
	}

	parsed = parsed.UTC()
	return &parsed
}

func firstConfiguredValue(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}

	return ""
}

func escapeCloudRunResourceName(resourceName string) string {
	parts := strings.Split(resourceName, "/")

	for index, part := range parts {
		parts[index] = url.PathEscape(part)
	}

	return strings.Join(parts, "/")
}

func (c *NLPCloudRunClient) apiBaseURL() string {
	if value := strings.TrimSpace(c.RunAPIBaseURL); value != "" {
		return value
	}

	return googleRunAPIBaseURL
}
