package services

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNLPJobNotFound = errors.New("nlp job not found")

type NLPJobCreateRequest struct {
	InstitucionID int64
	RequestedBy   string
	Options       NLPRunOptions
}

type NLPJobRepository struct {
	DB *pgxpool.Pool
}

func NewNLPJobRepository(db *pgxpool.Pool) *NLPJobRepository {
	return &NLPJobRepository{DB: db}
}

func BuildNLPJobKey(institucionID int64, centros []int64, year *int) string {
	sorted := normalizeCentroIDs(centros)

	parts := make([]string, 0, len(sorted))
	for _, centroID := range sorted {
		parts = append(parts, strconv.FormatInt(centroID, 10))
	}

	yearPart := "all"
	if year != nil {
		yearPart = strconv.Itoa(*year)
	}

	return fmt.Sprintf(
		"institucion:%d|centros:%s|year:%s",
		institucionID,
		strings.Join(parts, ","),
		yearPart,
	)
}

func normalizeCentroIDs(centros []int64) []int64 {
	sorted := append([]int64(nil), centros...)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i] < sorted[j]
	})

	unique := make([]int64, 0, len(sorted))
	for _, centroID := range sorted {
		if centroID <= 0 {
			continue
		}
		if len(unique) > 0 && unique[len(unique)-1] == centroID {
			continue
		}
		unique = append(unique, centroID)
	}

	return unique
}

func (r *NLPJobRepository) Create(
	ctx context.Context,
	request NLPJobCreateRequest,
) (NLPJobStatus, bool, error) {
	if r == nil || r.DB == nil {
		return NLPJobStatus{}, false, errors.New("nlp job repository is not configured")
	}
	if request.InstitucionID <= 0 {
		return NLPJobStatus{}, false, errors.New("institucion_id is required")
	}

	centros := normalizeCentroIDs(request.Options.CentroIDs)
	if len(centros) == 0 {
		return NLPJobStatus{}, false, errors.New("at least one centro is required")
	}

	jobKey := BuildNLPJobKey(
		request.InstitucionID,
		centros,
		request.Options.Year,
	)

	var requestedBy any
	if strings.TrimSpace(request.RequestedBy) != "" {
		requestedBy = strings.TrimSpace(request.RequestedBy)
	}

	var encuestaID any
	if strings.TrimSpace(request.Options.EncuestaID) != "" {
		encuestaID = strings.TrimSpace(request.Options.EncuestaID)
	}

	var job NLPJobStatus
	err := r.DB.QueryRow(ctx, `
		insert into public.nlp_jobs (
			job_key,
			institucion_id,
			centro_ids,
			year,
			limit_value,
			encuesta_id,
			dry_run,
			status,
			running,
			requested_by
		)
		values (
			$1,
			$2,
			$3,
			$4,
			$5,
			$6::uuid,
			$7,
			'queued',
			true,
			$8::uuid
		)
		returning
			id::text,
			job_key,
			centro_ids,
			year,
			running,
			status,
			current_value,
			total_value,
			processed_value,
			errors_value,
			coalesce(last_encuesta_id::text, ''),
			coalesce(last_event, ''),
			coalesce(last_error, ''),
			coalesce(cloud_execution, ''),
			started_at,
			finished_at,
			updated_at
	`,
		jobKey,
		request.InstitucionID,
		centros,
		request.Options.Year,
		request.Options.Limit,
		encuestaID,
		request.Options.DryRun,
		requestedBy,
	).Scan(
		&job.ID,
		&job.Key,
		&job.Centros,
		&job.Year,
		&job.Running,
		&job.Status,
		&job.Current,
		&job.Total,
		&job.Processed,
		&job.Errors,
		&job.LastEncuestaID,
		&job.LastEvent,
		&job.LastError,
		&job.CloudExecution,
		&job.StartedAt,
		&job.FinishedAt,
		&job.UpdatedAt,
	)
	if err == nil {
		return job, true, nil
	}

	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23505" {
		return NLPJobStatus{}, false, err
	}

	existing, getErr := r.GetActive(
		ctx,
		request.InstitucionID,
		centros,
		request.Options.Year,
	)
	if getErr != nil {
		return NLPJobStatus{}, false, getErr
	}

	return existing, false, nil
}

func (r *NLPJobRepository) GetActive(
	ctx context.Context,
	institucionID int64,
	centros []int64,
	year *int,
) (NLPJobStatus, error) {
	jobKey := BuildNLPJobKey(institucionID, centros, year)

	return r.scanOne(ctx, `
		select
			id::text,
			job_key,
			centro_ids,
			year,
			running,
			status,
			current_value,
			total_value,
			processed_value,
			errors_value,
			coalesce(last_encuesta_id::text, ''),
			coalesce(last_event, ''),
			coalesce(last_error, ''),
			coalesce(cloud_execution, ''),
			started_at,
			finished_at,
			updated_at
		from public.nlp_jobs
		where institucion_id = $1
		  and job_key = $2
		  and running = true
		order by created_at desc
		limit 1
	`, institucionID, jobKey)
}

func (r *NLPJobRepository) GetLatest(
	ctx context.Context,
	institucionID int64,
	centros []int64,
	year *int,
) (NLPJobStatus, error) {
	jobKey := BuildNLPJobKey(institucionID, centros, year)

	job, err := r.scanOne(ctx, `
		select
			id::text,
			job_key,
			centro_ids,
			year,
			running,
			status,
			current_value,
			total_value,
			processed_value,
			errors_value,
			coalesce(last_encuesta_id::text, ''),
			coalesce(last_event, ''),
			coalesce(last_error, ''),
			coalesce(cloud_execution, ''),
			started_at,
			finished_at,
			updated_at
		from public.nlp_jobs
		where institucion_id = $1
		  and job_key = $2
		order by created_at desc
		limit 1
	`, institucionID, jobKey)
	if errors.Is(err, ErrNLPJobNotFound) {
		return NLPJobStatus{
			Key:       jobKey,
			Centros:   normalizeCentroIDs(centros),
			Year:      cloneOptionalInt(year),
			Status:    "idle",
			UpdatedAt: time.Now().UTC(),
		}, nil
	}

	return job, err
}

func (r *NLPJobRepository) scanOne(
	ctx context.Context,
	query string,
	args ...any,
) (NLPJobStatus, error) {
	var job NLPJobStatus

	err := r.DB.QueryRow(ctx, query, args...).Scan(
		&job.ID,
		&job.Key,
		&job.Centros,
		&job.Year,
		&job.Running,
		&job.Status,
		&job.Current,
		&job.Total,
		&job.Processed,
		&job.Errors,
		&job.LastEncuestaID,
		&job.LastEvent,
		&job.LastError,
		&job.CloudExecution,
		&job.StartedAt,
		&job.FinishedAt,
		&job.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return NLPJobStatus{}, ErrNLPJobNotFound
	}
	if err != nil {
		return NLPJobStatus{}, err
	}

	return job, nil
}

func (r *NLPJobRepository) ApplyEvent(
	ctx context.Context,
	jobID string,
	event map[string]any,
) error {
	eventName := toString(event["event"])
	current := toInt(event["current"])
	total := toInt(event["total"])
	processed := toInt(event["processed"])
	errorsCount := toInt(event["errors"])
	encuestaID := toString(event["encuesta_id"])
	progressStatus := toString(event["status"])
	lastError := toString(event["error"])

	switch eventName {
	case "start":
		_, err := r.DB.Exec(ctx, `
			update public.nlp_jobs
			set status = 'running',
			    running = true,
			    started_at = coalesce(started_at, now()),
			    total_value = greatest(total_value, $2),
			    last_event = 'start'
			where id = $1::uuid
		`, jobID, total)
		return err

	case "progress":
		processedIncrement := 0
		errorIncrement := 0

		switch progressStatus {
		case "processed", "dry-run":
			processedIncrement = 1
		case "error":
			errorIncrement = 1
		}

		_, err := r.DB.Exec(ctx, `
			update public.nlp_jobs
			set status = 'running',
			    running = true,
			    current_value = greatest(current_value, $2),
			    total_value = greatest(total_value, $3),
			    processed_value = processed_value + $4,
			    errors_value = errors_value + $5,
			    last_encuesta_id = case
			        when nullif($6, '') is null then last_encuesta_id
			        else $6::uuid
			    end,
			    last_event = 'progress',
			    last_error = case
			        when nullif($7, '') is null then last_error
			        else $7
			    end
			where id = $1::uuid
		`,
			jobID,
			current,
			total,
			processedIncrement,
			errorIncrement,
			encuestaID,
			lastError,
		)
		return err

	case "complete":
		_, err := r.DB.Exec(ctx, `
			update public.nlp_jobs
			set status = 'completed',
			    running = false,
			    current_value = greatest(current_value, $2),
			    total_value = greatest(total_value, $2),
			    processed_value = greatest(processed_value, $3),
			    errors_value = greatest(errors_value, $4),
			    last_event = 'complete',
			    finished_at = now()
			where id = $1::uuid
		`, jobID, total, processed, errorsCount)
		return err
	}

	return nil
}

func (r *NLPJobRepository) SetCloudExecution(
	ctx context.Context,
	jobID string,
	state NLPExecutionState,
) error {
	executionName := strings.TrimSpace(state.Name)
	if executionName == "" {
		return errors.New("cloud execution name is required")
	}

	status := strings.TrimSpace(state.Status)
	if status == "" {
		status = "running"
	}

	running := state.Running
	if status == "running" {
		running = true
	}

	_, err := r.DB.Exec(ctx, `
		update public.nlp_jobs
		set cloud_execution = $2,
		    status = case
		        when running = false
		          and status in ('completed', 'failed', 'cancelled')
		        then status
		        else $3
		    end,
		    running = case
		        when running = false
		          and status in ('completed', 'failed', 'cancelled')
		        then false
		        else $4
		    end,
		    last_event = case
		        when running = false
		          and status in ('completed', 'failed', 'cancelled')
		        then last_event
		        when $3 = 'queued' then 'queued'
		        else 'cloud-run-started'
		    end,
		    last_error = nullif($5, ''),
		    started_at = coalesce(started_at, $6, now()),
		    finished_at = case
		        when running = false
		          and status in ('completed', 'failed', 'cancelled')
		        then finished_at
		        when $4 then null
		        else coalesce($7, now())
		    end,
		    updated_at = now()
		where id = $1::uuid
	`,
		jobID,
		executionName,
		status,
		running,
		strings.TrimSpace(state.Error),
		state.StartedAt,
		state.CompletedAt,
	)
	return err
}

func (r *NLPJobRepository) SyncCloudExecution(
	ctx context.Context,
	jobID string,
	state NLPExecutionState,
) error {
	status := strings.TrimSpace(state.Status)
	if status == "" {
		status = "running"
	}

	running := state.Running
	if status == "running" {
		running = true
	}

	lastEvent := "cloud-run-status"
	if !running {
		lastEvent = "cloud-run-" + status
	}

	_, err := r.DB.Exec(ctx, `
		update public.nlp_jobs
		set status = case
		        when running = false
		          and status in ('completed', 'failed', 'cancelled')
		          and $3 = true
		        then status
		        else $2
		    end,
		    running = case
		        when running = false
		          and status in ('completed', 'failed', 'cancelled')
		          and $3 = true
		        then false
		        else $3
		    end,
		    last_event = case
		        when running = false
		          and status in ('completed', 'failed', 'cancelled')
		          and $3 = true
		        then last_event
		        when $3 = true
		          and last_event in (
		              'loading-models',
		              'fetching-comments',
		              'start',
		              'progress'
		          )
		        then last_event
		        else $4
		    end,
		    last_error = case
		        when nullif($5, '') is null then last_error
		        else $5
		    end,
		    started_at = coalesce(started_at, $6),
		    finished_at = case
		        when running = false
		          and status in ('completed', 'failed', 'cancelled')
		          and $3 = true
		        then finished_at
		        when $3 then finished_at
		        else coalesce($7, finished_at, now())
		    end
		where id = $1::uuid
	`,
		jobID,
		status,
		running,
		lastEvent,
		strings.TrimSpace(state.Error),
		state.StartedAt,
		state.CompletedAt,
	)
	return err
}

func (r *NLPJobRepository) Finish(
	ctx context.Context,
	jobID string,
	runErr error,
) error {
	if runErr != nil {
		_, err := r.DB.Exec(ctx, `
			update public.nlp_jobs
			set status = 'failed',
			    running = false,
			    last_error = $2,
			    finished_at = now()
			where id = $1::uuid
		`, jobID, runErr.Error())
		return err
	}

	_, err := r.DB.Exec(ctx, `
		update public.nlp_jobs
		set status = case
		        when status = 'queued' then 'completed'
		        else status
		    end,
		    running = false,
		    finished_at = coalesce(finished_at, now())
		where id = $1::uuid
	`, jobID)
	return err
}

func toInt(value any) int {
	switch typed := value.(type) {
	case int:
		return typed
	case int8:
		return int(typed)
	case int16:
		return int(typed)
	case int32:
		return int(typed)
	case int64:
		return int(typed)
	case uint:
		return int(typed)
	case uint8:
		return int(typed)
	case uint16:
		return int(typed)
	case uint32:
		return int(typed)
	case uint64:
		return int(typed)
	case float32:
		return int(typed)
	case float64:
		return int(typed)
	default:
		return 0
	}
}

func toString(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case []byte:
		return string(typed)
	default:
		return ""
	}
}
