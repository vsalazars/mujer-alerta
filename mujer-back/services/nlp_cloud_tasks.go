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
	"strings"
	"time"
)

const (
	defaultNLPCloudTasksQueue  = "mujer-alerta-nlp"
	googleCloudTasksAPIBaseURL = "https://cloudtasks.googleapis.com/v2"
)

type NLPCloudTasksClient struct {
	ProjectID           string
	Region              string
	QueueName           string
	ServiceURL          string
	ServiceAccountEmail string

	HTTPClient        *http.Client
	TokenURL          string
	APIBaseURL        string
	StaticAccessToken string
}

type nlpCloudTaskPayload struct {
	JobID      string  `json:"job_id"`
	Limit      *int    `json:"limit,omitempty"`
	EncuestaID string  `json:"encuesta_id,omitempty"`
	CentroIDs  []int64 `json:"centro_ids"`
	Year       *int    `json:"year,omitempty"`
	DryRun     bool    `json:"dry_run"`
}

type cloudTaskOIDCToken struct {
	ServiceAccountEmail string `json:"serviceAccountEmail"`
	Audience            string `json:"audience"`
}

type cloudTaskHTTPRequest struct {
	HTTPMethod string             `json:"httpMethod"`
	URL        string             `json:"url"`
	Headers    map[string]string  `json:"headers"`
	Body       []byte             `json:"body"`
	OIDCToken  cloudTaskOIDCToken `json:"oidcToken"`
}

type cloudTask struct {
	Name             string               `json:"name,omitempty"`
	HTTPRequest      cloudTaskHTTPRequest `json:"httpRequest"`
	DispatchDeadline string               `json:"dispatchDeadline"`
}

type cloudTaskCreateRequest struct {
	Task cloudTask `json:"task"`
}

func NewNLPCloudTasksClientFromEnv() *NLPCloudTasksClient {
	projectID := firstConfiguredValue(
		os.Getenv("NLP_CLOUD_TASKS_PROJECT_ID"),
		os.Getenv("NLP_CLOUD_RUN_PROJECT_ID"),
		os.Getenv("GOOGLE_CLOUD_PROJECT"),
		os.Getenv("GCP_PROJECT"),
		defaultNLPCloudProjectID,
	)

	region := firstConfiguredValue(
		os.Getenv("NLP_CLOUD_TASKS_REGION"),
		os.Getenv("NLP_CLOUD_RUN_REGION"),
		defaultNLPCloudRegion,
	)

	queueName := firstConfiguredValue(
		os.Getenv("NLP_CLOUD_TASKS_QUEUE"),
		defaultNLPCloudTasksQueue,
	)

	return &NLPCloudTasksClient{
		ProjectID:           projectID,
		Region:              region,
		QueueName:           queueName,
		ServiceURL:          strings.TrimSpace(os.Getenv("NLP_CLOUD_TASKS_SERVICE_URL")),
		ServiceAccountEmail: strings.TrimSpace(os.Getenv("NLP_CLOUD_TASKS_SERVICE_ACCOUNT")),
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		TokenURL:   googleMetadataTokenURL,
		APIBaseURL: googleCloudTasksAPIBaseURL,
	}
}

func NewNLPAsyncClientFromEnv(mode string) NLPAsyncClient {
	if normalizeNLPExecutionMode(mode) == NLPExecutionModeCloudTasks {
		return NewNLPCloudTasksClientFromEnv()
	}

	return NewNLPCloudRunClientFromEnv()
}

func (c *NLPCloudTasksClient) Start(
	ctx context.Context,
	options NLPRunOptions,
) (NLPExecutionState, error) {
	if err := c.validate(); err != nil {
		return NLPExecutionState{}, err
	}

	jobID := strings.TrimSpace(options.JobID)
	if jobID == "" {
		return NLPExecutionState{}, errors.New("job id is required")
	}

	payload, err := json.Marshal(nlpCloudTaskPayload{
		JobID:      jobID,
		Limit:      options.Limit,
		EncuestaID: strings.TrimSpace(options.EncuestaID),
		CentroIDs:  normalizeCentroIDs(options.CentroIDs),
		Year:       cloneOptionalInt(options.Year),
		DryRun:     options.DryRun,
	})
	if err != nil {
		return NLPExecutionState{}, fmt.Errorf(
			"codificar payload NLP: %w",
			err,
		)
	}

	parent := fmt.Sprintf(
		"projects/%s/locations/%s/queues/%s",
		c.ProjectID,
		c.Region,
		c.QueueName,
	)
	taskName := parent + "/tasks/nlp-" + strings.ReplaceAll(jobID, "-", "")
	serviceURL := strings.TrimRight(c.ServiceURL, "/")

	requestBody := cloudTaskCreateRequest{
		Task: cloudTask{
			Name:             taskName,
			DispatchDeadline: "1800s",
			HTTPRequest: cloudTaskHTTPRequest{
				HTTPMethod: http.MethodPost,
				URL:        serviceURL + "/process",
				Headers: map[string]string{
					"Content-Type": "application/json",
				},
				Body: payload,
				OIDCToken: cloudTaskOIDCToken{
					ServiceAccountEmail: c.ServiceAccountEmail,
					Audience:            serviceURL,
				},
			},
		},
	}

	var created cloudTask
	endpoint := fmt.Sprintf(
		"%s/%s/tasks",
		strings.TrimRight(c.apiBaseURL(), "/"),
		escapeCloudTasksResourceName(parent),
	)

	if err := c.requestJSON(
		ctx,
		http.MethodPost,
		endpoint,
		requestBody,
		&created,
	); err != nil {
		return NLPExecutionState{}, fmt.Errorf(
			"crear tarea NLP: %w",
			err,
		)
	}

	if strings.TrimSpace(created.Name) == "" {
		created.Name = taskName
	}

	now := time.Now().UTC()
	return NLPExecutionState{
		Name:      created.Name,
		Running:   true,
		Status:    "queued",
		CreatedAt: &now,
	}, nil
}

func (c *NLPCloudTasksClient) GetExecution(
	_ context.Context,
	executionName string,
) (NLPExecutionState, error) {
	return NLPExecutionState{
		Name:    strings.TrimSpace(executionName),
		Running: true,
		Status:  "running",
	}, nil
}

func (c *NLPCloudTasksClient) validate() error {
	if c == nil {
		return errors.New("nlp cloud tasks client is nil")
	}
	if strings.TrimSpace(c.ProjectID) == "" {
		return errors.New("NLP_CLOUD_TASKS_PROJECT_ID is required")
	}
	if strings.TrimSpace(c.Region) == "" {
		return errors.New("NLP_CLOUD_TASKS_REGION is required")
	}
	if strings.TrimSpace(c.QueueName) == "" {
		return errors.New("NLP_CLOUD_TASKS_QUEUE is required")
	}
	if strings.TrimSpace(c.ServiceURL) == "" {
		return errors.New("NLP_CLOUD_TASKS_SERVICE_URL is required")
	}
	if parsed, err := url.ParseRequestURI(c.ServiceURL); err != nil ||
		parsed.Scheme != "https" ||
		parsed.Host == "" {
		return errors.New("NLP_CLOUD_TASKS_SERVICE_URL must be an HTTPS URL")
	}
	if strings.TrimSpace(c.ServiceAccountEmail) == "" {
		return errors.New("NLP_CLOUD_TASKS_SERVICE_ACCOUNT is required")
	}

	return nil
}

func (c *NLPCloudTasksClient) requestJSON(
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

	tokenClient := &NLPCloudRunClient{
		HTTPClient:        client,
		TokenURL:          c.TokenURL,
		StaticAccessToken: c.StaticAccessToken,
	}
	accessToken, err := tokenClient.accessToken(ctx, client)
	if err != nil {
		return err
	}

	encoded, err := json.Marshal(requestBody)
	if err != nil {
		return fmt.Errorf("codificar solicitud Cloud Tasks: %w", err)
	}

	request, err := http.NewRequestWithContext(
		ctx,
		method,
		endpoint,
		bytes.NewReader(encoded),
	)
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bearer "+accessToken)
	request.Header.Set("Content-Type", "application/json")

	response, err := client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	responseData, err := io.ReadAll(io.LimitReader(response.Body, 4<<20))
	if err != nil {
		return err
	}

	if response.StatusCode < 200 || response.StatusCode >= 300 {
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
			"decodificar respuesta Cloud Tasks: %w",
			err,
		)
	}

	return nil
}

func (c *NLPCloudTasksClient) apiBaseURL() string {
	if value := strings.TrimSpace(c.APIBaseURL); value != "" {
		return value
	}

	return googleCloudTasksAPIBaseURL
}

func escapeCloudTasksResourceName(resourceName string) string {
	parts := strings.Split(resourceName, "/")
	for index, part := range parts {
		parts[index] = url.PathEscape(part)
	}

	return strings.Join(parts, "/")
}
