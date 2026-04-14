package handlers

import (
	"context"
	"database/sql"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ctxTxKey string

const ctxDBTx ctxTxKey = "db_tx"

func txFromCtx(ctx context.Context) pgx.Tx {
	tx, _ := ctx.Value(ctxDBTx).(pgx.Tx)
	return tx
}

func query(ctx context.Context, pool *pgxpool.Pool, sql string, args ...any) (pgx.Rows, error) {
	if tx := txFromCtx(ctx); tx != nil {
		return tx.Query(ctx, sql, args...)
	}
	return pool.Query(ctx, sql, args...)
}

func queryRow(ctx context.Context, pool *pgxpool.Pool, sql string, args ...any) pgx.Row {
	if tx := txFromCtx(ctx); tx != nil {
		return tx.QueryRow(ctx, sql, args...)
	}
	return pool.QueryRow(ctx, sql, args...)
}

func exec(ctx context.Context, pool *pgxpool.Pool, sql string, args ...any) (pgconn.CommandTag, error) {
	if tx := txFromCtx(ctx); tx != nil {
		return tx.Exec(ctx, sql, args...)
	}
	return pool.Exec(ctx, sql, args...)
}

func begin(ctx context.Context, pool *pgxpool.Pool) (pgx.Tx, error) {
	if tx := txFromCtx(ctx); tx != nil {
		return tx.Begin(ctx)
	}
	return pool.Begin(ctx)
}

func WithTenantSession(pool *pgxpool.Pool, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		tx, err := pool.Begin(ctx)
		if err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}

		defer func() { _ = tx.Rollback(ctx) }()

		if _, err := tx.Exec(ctx, "select set_config('app.current_is_super_admin', $1, true)", strconv.FormatBool(UserIsSuperAdminFromCtx(ctx))); err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}

		if institucionID, ok := UserInstitucionIDFromCtx(ctx); ok {
			if _, err := tx.Exec(ctx, "select set_config('app.current_institucion_id', $1, true)", strconv.FormatInt(institucionID, 10)); err != nil {
				http.Error(w, "db_error", http.StatusInternalServerError)
				return
			}
		}

		ctx = context.WithValue(ctx, ctxDBTx, tx)
		next.ServeHTTP(w, r.WithContext(ctx))

		if err := tx.Commit(ctx); err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
	})
}

func WithPublicTenantSession(pool *pgxpool.Pool, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		tx, err := pool.Begin(ctx)
		if err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}

		defer func() { _ = tx.Rollback(ctx) }()

		if _, err := tx.Exec(ctx, "select set_config('app.current_is_super_admin', 'false', true)"); err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}

		institucionSlug := strings.TrimSpace(r.Header.Get("X-Institucion-Slug"))
		if institucionSlug == "" {
			institucionSlug = strings.TrimSpace(r.URL.Query().Get("institucion_slug"))
		}
		if institucionSlug == "" {
			institucionSlug = strings.TrimSpace(os.Getenv("DEFAULT_INSTITUCION_SLUG"))
		}
		if institucionSlug == "" {
			http.Error(w, "missing_institucion_slug", http.StatusBadRequest)
			return
		}

		var kind string
		var institucionID sql.NullInt64
		var institucionSlugResolved sql.NullString
		var centroID sql.NullInt64
		var centroSlug sql.NullString
		if err := tx.QueryRow(
			ctx,
			"select kind, institucion_id, institucion_slug, centro_id, centro_slug from public.app_resolve_public_access_slug($1)",
			institucionSlug,
		).Scan(&kind, &institucionID, &institucionSlugResolved, &centroID, &centroSlug); err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		_ = kind
		_ = institucionSlugResolved
		_ = centroID
		_ = centroSlug
		if !institucionID.Valid || institucionID.Int64 <= 0 {
			http.Error(w, "institucion_not_found", http.StatusNotFound)
			return
		}

		if _, err := tx.Exec(ctx, "select set_config('app.current_institucion_id', $1, true)", strconv.FormatInt(institucionID.Int64, 10)); err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}

		ctx = context.WithValue(ctx, ctxDBTx, tx)
		next.ServeHTTP(w, r.WithContext(ctx))

		if err := tx.Commit(ctx); err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
	})
}
