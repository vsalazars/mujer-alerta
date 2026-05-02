package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type SuperAdminHandler struct {
	DB *pgxpool.Pool
}

type RegistroSolicitudAdminDTO struct {
	ID                 int64  `json:"id"`
	InstitucionID      *int64 `json:"institucion_id,omitempty"`
	Origen             string `json:"origen,omitempty"`
	SoloLectura        bool   `json:"solo_lectura,omitempty"`
	InstitucionNombre  string `json:"institucion_nombre"`
	Tipo               string `json:"tipo"`
	NombreContacto     string `json:"nombre_contacto"`
	CargoContacto      string `json:"cargo_contacto,omitempty"`
	EmailContacto      string `json:"email_contacto"`
	TelefonoContacto   string `json:"telefono_contacto,omitempty"`
	Estado             string `json:"estado,omitempty"`
	Ciudad             string `json:"ciudad,omitempty"`
	SitioWeb           string `json:"sitio_web,omitempty"`
	SlugDeseado        string `json:"slug_deseado"`
	EstatusSolicitud   string `json:"estatus_solicitud"`
	EstatusInstitucion string `json:"estatus_institucion,omitempty"`
	InstitucionActiva  *bool  `json:"institucion_activa,omitempty"`
	CreatedAt          string `json:"created_at"`
	UpdatedAt          string `json:"updated_at"`
}

type ActualizarSolicitudRegistroReq struct {
	Accion string `json:"accion"`
}

func ptrInt64(v int64) *int64 { return &v }

type institucionesSchemaSupport struct {
	Activo            bool
	EstatusValidacion bool
	ValidadoAt        bool
	ValidadoPor       bool
}

func (h SuperAdminHandler) solicitudesHasInstitucionID(r *http.Request) (bool, error) {
	var exists bool
	if err := queryRow(r.Context(), h.DB, `
		select exists (
			select 1
			from information_schema.columns
			where table_schema = 'public'
			  and table_name = 'registro_institucional_solicitudes'
			  and column_name = 'institucion_id'
		)
	`).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

func (h SuperAdminHandler) institucionesSchema(r *http.Request) (institucionesSchemaSupport, error) {
	rows, err := query(r.Context(), h.DB, `
		select column_name
		from information_schema.columns
		where table_schema = 'public'
		  and table_name = 'instituciones'
		  and column_name in ('activo', 'estatus_validacion', 'validado_at', 'validado_por')
	`)
	if err != nil {
		return institucionesSchemaSupport{}, err
	}
	defer rows.Close()

	support := institucionesSchemaSupport{}
	for rows.Next() {
		var column string
		if err := rows.Scan(&column); err != nil {
			return institucionesSchemaSupport{}, err
		}
		switch column {
		case "activo":
			support.Activo = true
		case "estatus_validacion":
			support.EstatusValidacion = true
		case "validado_at":
			support.ValidadoAt = true
		case "validado_por":
			support.ValidadoPor = true
		}
	}
	if err := rows.Err(); err != nil {
		return institucionesSchemaSupport{}, err
	}
	return support, nil
}

func (h SuperAdminHandler) slugExists(r *http.Request, slug string) (bool, error) {
	var exists bool
	if err := queryRow(r.Context(), h.DB, `
		select exists(
			select 1 from public.instituciones where lower(slug) = $1
			union all
			select 1 from public.registro_institucional_solicitudes where lower(slug_deseado) = $1
		)
	`, strings.ToLower(slug)).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

func (h SuperAdminHandler) buildUniqueSlug(r *http.Request, institucionNombre string) (string, error) {
	base := slugifyRegistroBase(institucionNombre)
	if base == "" {
		base = "institucion"
	}
	if !registroSlugRegex.MatchString(base) {
		base = "institucion"
	}

	candidate := base
	for n := 0; n < 500; n++ {
		if n > 0 {
			candidate = fmt.Sprintf("%s-%d", base, n+1)
		}
		exists, err := h.slugExists(r, candidate)
		if err != nil {
			return "", err
		}
		if !exists {
			return candidate, nil
		}
	}

	return "", fmt.Errorf("unique slug not found")
}

func (h SuperAdminHandler) ListSolicitudes(w http.ResponseWriter, r *http.Request) {
	statusFilter := strings.TrimSpace(r.URL.Query().Get("estatus"))
	hasInstitucionID, err := h.solicitudesHasInstitucionID(r)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	instSchema, err := h.institucionesSchema(r)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	base := `
		select
			s.id,
			s.institucion_nombre,
			s.tipo,
			s.nombre_contacto,
			coalesce(s.cargo_contacto, ''),
			s.email_contacto,
			coalesce(s.telefono_contacto, ''),
			coalesce(s.estado, ''),
			coalesce(s.ciudad, ''),
			coalesce(s.sitio_web, ''),
			coalesce(s.slug_deseado, ''),
			s.estatus,
			s.created_at::text,
			s.updated_at::text
		from public.registro_institucional_solicitudes s
	`
	if hasInstitucionID {
		instStatusExpr := `''`
		if instSchema.EstatusValidacion {
			instStatusExpr = `coalesce(i.estatus_validacion::text, '')`
		}
		instActiveExpr := `null::boolean`
		if instSchema.Activo {
			instActiveExpr = `i.activo`
		}
		base = `
			select
				s.id,
				s.institucion_id,
				s.institucion_nombre,
				s.tipo,
				s.nombre_contacto,
				coalesce(s.cargo_contacto, ''),
				s.email_contacto,
				coalesce(s.telefono_contacto, ''),
				coalesce(s.estado, ''),
				coalesce(s.ciudad, ''),
				coalesce(s.sitio_web, ''),
				coalesce(s.slug_deseado, ''),
				s.estatus,
				` + instStatusExpr + `,
				` + instActiveExpr + `,
				s.created_at::text,
				s.updated_at::text
			from public.registro_institucional_solicitudes s
			left join public.instituciones i on i.id = s.institucion_id
		`
	}

	listSQL := base + ` order by s.created_at desc`
	args := []any{}
	if statusFilter != "" && statusFilter != "all" {
		listSQL = base + ` where s.estatus = $1 order by s.created_at desc`
		args = append(args, statusFilter)
	}
	rows, err := query(r.Context(), h.DB, listSQL, args...)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	out := make([]RegistroSolicitudAdminDTO, 0, 32)
	for rows.Next() {
		var item RegistroSolicitudAdminDTO
		var institucionID sql.NullInt64
		var instStatus string
		var instActive sql.NullBool

		if hasInstitucionID {
			if err := rows.Scan(
				&item.ID,
				&institucionID,
				&item.InstitucionNombre,
				&item.Tipo,
				&item.NombreContacto,
				&item.CargoContacto,
				&item.EmailContacto,
				&item.TelefonoContacto,
				&item.Estado,
				&item.Ciudad,
				&item.SitioWeb,
				&item.SlugDeseado,
				&item.EstatusSolicitud,
				&instStatus,
				&instActive,
				&item.CreatedAt,
				&item.UpdatedAt,
			); err != nil {
				http.Error(w, "db_error", http.StatusInternalServerError)
				return
			}
			if institucionID.Valid {
				item.InstitucionID = ptrInt64(institucionID.Int64)
			}
			item.Origen = "solicitud"
			item.EstatusInstitucion = instStatus
			if instActive.Valid {
				item.InstitucionActiva = &instActive.Bool
			}
		} else {
			if err := rows.Scan(
				&item.ID,
				&item.InstitucionNombre,
				&item.Tipo,
				&item.NombreContacto,
				&item.CargoContacto,
				&item.EmailContacto,
				&item.TelefonoContacto,
				&item.Estado,
				&item.Ciudad,
				&item.SitioWeb,
				&item.SlugDeseado,
				&item.EstatusSolicitud,
				&item.CreatedAt,
				&item.UpdatedAt,
			); err != nil {
				http.Error(w, "db_error", http.StatusInternalServerError)
				return
			}
			item.Origen = "solicitud"
		}
		out = append(out, item)
	}
	if rows.Err() != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	if statusFilter == "" || statusFilter == "all" || statusFilter == "aprobado" {
		instStatusExpr := `'aprobado'`
		if instSchema.EstatusValidacion {
			instStatusExpr = `coalesce(i.estatus_validacion::text, 'aprobado')`
		}
		instActiveExpr := `true`
		if instSchema.Activo {
			instActiveExpr = `i.activo`
		}

		institucionesSQL := `
			select
				i.id,
				i.nombre,
				i.tipo,
				coalesce(i.email_contacto, ''),
				coalesce(i.telefono, ''),
				coalesce(i.estado, ''),
				coalesce(i.ciudad, ''),
				i.slug,
				` + instStatusExpr + `,
				` + instActiveExpr + `,
				i.created_at::text,
				i.updated_at::text
			from public.instituciones i
			where not exists (
				select 1
				from public.registro_institucional_solicitudes s
				where s.institucion_id = i.id
			)
		`
		if statusFilter == "aprobado" {
			if instSchema.EstatusValidacion {
				institucionesSQL += ` and coalesce(i.estatus_validacion::text, '') <> 'rechazada'`
			}
		}
		institucionesSQL += ` order by i.updated_at desc, i.created_at desc`

		instRows, err := query(r.Context(), h.DB, institucionesSQL)
		if err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		defer instRows.Close()

		for instRows.Next() {
			var item RegistroSolicitudAdminDTO
			var institucionID int64
			var instStatus string
			var instActive sql.NullBool
			if err := instRows.Scan(
				&institucionID,
				&item.InstitucionNombre,
				&item.Tipo,
				&item.EmailContacto,
				&item.TelefonoContacto,
				&item.Estado,
				&item.Ciudad,
				&item.SlugDeseado,
				&instStatus,
				&instActive,
				&item.CreatedAt,
				&item.UpdatedAt,
			); err != nil {
				http.Error(w, "db_error", http.StatusInternalServerError)
				return
			}
			item.ID = -institucionID
			item.InstitucionID = ptrInt64(institucionID)
			item.Origen = "institucion"
			item.SoloLectura = true
			item.EstatusSolicitud = "aprobado"
			item.EstatusInstitucion = instStatus
			item.NombreContacto = "Registro previo"
			if instActive.Valid {
				item.InstitucionActiva = &instActive.Bool
			}
			out = append(out, item)
		}
		if err := instRows.Err(); err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
	}

	sort.Slice(out, func(i, j int) bool {
		return out[i].UpdatedAt > out[j].UpdatedAt
	})

	writeJSON(w, http.StatusOK, out)
}

func (h SuperAdminHandler) UpdateSolicitud(w http.ResponseWriter, r *http.Request, id int64) {
	var req ActualizarSolicitudRegistroReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad_json", http.StatusBadRequest)
		return
	}

	accion := strings.TrimSpace(req.Accion)
	switch accion {
	case "aprobar", "rechazar", "activar", "desactivar":
	default:
		http.Error(w, "bad_action", http.StatusBadRequest)
		return
	}

	tx, err := begin(r.Context(), h.DB)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(r.Context())

	type solicitudState struct {
		InstitucionID     *int64
		InstitucionNombre string
		Tipo              string
		EmailContacto     string
		TelefonoContacto  string
		Estado            string
		Ciudad            string
		SlugDeseado       string
		EstatusSolicitud  string
	}

	var state solicitudState
	var institucionID sql.NullInt64
	hasInstitucionID, err := h.solicitudesHasInstitucionID(r)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	instSchema, err := h.institucionesSchema(r)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	stateQuery := `
		select
			s.institucion_nombre,
			s.tipo,
			s.email_contacto,
			coalesce(s.telefono_contacto, ''),
			coalesce(s.estado, ''),
			coalesce(s.ciudad, ''),
			coalesce(s.slug_deseado, ''),
			s.estatus
		from public.registro_institucional_solicitudes s
		where s.id = $1
	`
	var scanErr error
	if hasInstitucionID {
		scanErr = tx.QueryRow(r.Context(), `
			select
				s.institucion_id,
				s.institucion_nombre,
				s.tipo,
				s.email_contacto,
				coalesce(s.telefono_contacto, ''),
				coalesce(s.estado, ''),
				coalesce(s.ciudad, ''),
				coalesce(s.slug_deseado, ''),
				s.estatus
			from public.registro_institucional_solicitudes s
			where s.id = $1
		`, id).Scan(
			&institucionID,
			&state.InstitucionNombre,
			&state.Tipo,
			&state.EmailContacto,
			&state.TelefonoContacto,
			&state.Estado,
			&state.Ciudad,
			&state.SlugDeseado,
			&state.EstatusSolicitud,
		)
	} else {
		scanErr = tx.QueryRow(r.Context(), stateQuery, id).Scan(
			&state.InstitucionNombre,
			&state.Tipo,
			&state.EmailContacto,
			&state.TelefonoContacto,
			&state.Estado,
			&state.Ciudad,
			&state.SlugDeseado,
			&state.EstatusSolicitud,
		)
	}
	if scanErr != nil {
		http.Error(w, "not_found", http.StatusNotFound)
		return
	}
	if institucionID.Valid {
		state.InstitucionID = ptrInt64(institucionID.Int64)
	}

	userID := strings.TrimSpace(UserIDFromCtx(r.Context()))
	now := time.Now()

	switch accion {
	case "aprobar":
		slugFinal, err := h.buildUniqueSlug(r, state.InstitucionNombre)
		if err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		if state.SlugDeseado != "" {
			exists, err := h.slugExists(r, state.SlugDeseado)
			if err != nil {
				http.Error(w, "db_error", http.StatusInternalServerError)
				return
			}
			if !exists || strings.EqualFold(state.SlugDeseado, slugFinal) {
				slugFinal = state.SlugDeseado
			}
		}

		if state.InstitucionID == nil {
			var newInstitucionID int64
			insertCols := []string{
				"nombre",
				"slug",
				"tipo",
				"email_contacto",
				"telefono",
				"estado",
				"ciudad",
			}
			insertVals := []string{"$1", "$2", "$3", "$4", "$5", "$6", "$7"}
			args := []any{
				state.InstitucionNombre,
				slugFinal,
				state.Tipo,
				state.EmailContacto,
				state.TelefonoContacto,
				state.Estado,
				state.Ciudad,
			}
			nextArg := 8
			if instSchema.Activo {
				insertCols = append(insertCols, "activo")
				insertVals = append(insertVals, "true")
			}
			if instSchema.EstatusValidacion {
				insertCols = append(insertCols, "estatus_validacion")
				insertVals = append(insertVals, "'activa'")
			}
			if instSchema.ValidadoAt {
				insertCols = append(insertCols, "validado_at")
				insertVals = append(insertVals, fmt.Sprintf("$%d", nextArg))
				args = append(args, now)
				nextArg++
			}
			if instSchema.ValidadoPor && userID != "" {
				insertCols = append(insertCols, "validado_por")
				insertVals = append(insertVals, fmt.Sprintf("$%d::uuid", nextArg))
				args = append(args, userID)
				nextArg++
			}
			insertSQL := fmt.Sprintf(`
				insert into public.instituciones (%s)
				values (%s)
				returning id
			`, strings.Join(insertCols, ",\n\t\t\t\t\t"), strings.Join(insertVals, ","))
			if err := tx.QueryRow(r.Context(), insertSQL, args...).Scan(&newInstitucionID); err != nil {
				http.Error(w, "db_error", http.StatusInternalServerError)
				return
			}
			state.InstitucionID = ptrInt64(newInstitucionID)
		} else {
			setClauses := []string{
				"nombre = $2",
				"slug = $3",
				"tipo = $4",
				"email_contacto = $5",
				"telefono = $6",
				"estado = $7",
				"ciudad = $8",
			}
			args := []any{
				*state.InstitucionID,
				state.InstitucionNombre,
				slugFinal,
				state.Tipo,
				state.EmailContacto,
				state.TelefonoContacto,
				state.Estado,
				state.Ciudad,
			}
			nextArg := 9
			if instSchema.Activo {
				setClauses = append(setClauses, "activo = true")
			}
			if instSchema.EstatusValidacion {
				setClauses = append(setClauses, "estatus_validacion = 'activa'")
			}
			if instSchema.ValidadoAt {
				setClauses = append(setClauses, fmt.Sprintf("validado_at = $%d", nextArg))
				args = append(args, now)
				nextArg++
			}
			if instSchema.ValidadoPor && userID != "" {
				setClauses = append(setClauses, fmt.Sprintf("validado_por = $%d::uuid", nextArg))
				args = append(args, userID)
				nextArg++
			}
			updateSQL := fmt.Sprintf(`
				update public.instituciones
				set %s
				where id = $1
			`, strings.Join(setClauses, ",\n\t\t\t\t\t"))
			if _, err := tx.Exec(r.Context(), updateSQL, args...); err != nil {
				http.Error(w, "db_error", http.StatusInternalServerError)
				return
			}
		}

		if hasInstitucionID {
			if _, err := tx.Exec(r.Context(), `
				update public.registro_institucional_solicitudes
				set estatus = 'aprobado',
					slug_deseado = $2,
					institucion_id = $3
				where id = $1
			`, id, slugFinal, *state.InstitucionID); err != nil {
				http.Error(w, "db_error", http.StatusInternalServerError)
				return
			}
		} else {
			if _, err := tx.Exec(r.Context(), `
				update public.registro_institucional_solicitudes
				set estatus = 'aprobado',
					slug_deseado = $2
				where id = $1
			`, id, slugFinal); err != nil {
				http.Error(w, "db_error", http.StatusInternalServerError)
				return
			}
		}

	case "rechazar":
		if _, err := tx.Exec(r.Context(), `
			update public.registro_institucional_solicitudes
			set estatus = 'rechazado'
			where id = $1
		`, id); err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		if state.InstitucionID != nil {
			setClauses := make([]string, 0, 4)
			args := []any{*state.InstitucionID}
			nextArg := 2
			if instSchema.Activo {
				setClauses = append(setClauses, "activo = false")
			}
			if instSchema.EstatusValidacion {
				setClauses = append(setClauses, "estatus_validacion = 'rechazada'")
			}
			if instSchema.ValidadoAt {
				setClauses = append(setClauses, fmt.Sprintf("validado_at = $%d", nextArg))
				args = append(args, now)
				nextArg++
			}
			if instSchema.ValidadoPor && userID != "" {
				setClauses = append(setClauses, fmt.Sprintf("validado_por = $%d::uuid", nextArg))
				args = append(args, userID)
				nextArg++
			}
			if len(setClauses) > 0 {
				updateSQL := fmt.Sprintf(`
					update public.instituciones
					set %s
					where id = $1
				`, strings.Join(setClauses, ",\n\t\t\t\t\t"))
				if _, err := tx.Exec(r.Context(), updateSQL, args...); err != nil {
					http.Error(w, "db_error", http.StatusInternalServerError)
					return
				}
			}
		}

	case "activar":
		if state.InstitucionID == nil {
			http.Error(w, "institution_missing", http.StatusConflict)
			return
		}
		if _, err := tx.Exec(r.Context(), `
			update public.registro_institucional_solicitudes
			set estatus = 'aprobado'
			where id = $1
		`, id); err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		setClauses := make([]string, 0, 4)
		args := []any{*state.InstitucionID}
		nextArg := 2
		if instSchema.Activo {
			setClauses = append(setClauses, "activo = true")
		}
		if instSchema.EstatusValidacion {
			setClauses = append(setClauses, "estatus_validacion = 'activa'")
		}
		if instSchema.ValidadoAt {
			setClauses = append(setClauses, fmt.Sprintf("validado_at = $%d", nextArg))
			args = append(args, now)
			nextArg++
		}
		if instSchema.ValidadoPor && userID != "" {
			setClauses = append(setClauses, fmt.Sprintf("validado_por = $%d::uuid", nextArg))
			args = append(args, userID)
			nextArg++
		}
		if len(setClauses) > 0 {
			updateSQL := fmt.Sprintf(`
				update public.instituciones
				set %s
				where id = $1
			`, strings.Join(setClauses, ",\n\t\t\t\t"))
			if _, err := tx.Exec(r.Context(), updateSQL, args...); err != nil {
				http.Error(w, "db_error", http.StatusInternalServerError)
				return
			}
		}

	case "desactivar":
		if state.InstitucionID == nil {
			http.Error(w, "institution_missing", http.StatusConflict)
			return
		}
		setClauses := make([]string, 0, 4)
		args := []any{*state.InstitucionID}
		nextArg := 2
		if instSchema.Activo {
			setClauses = append(setClauses, "activo = false")
		}
		if instSchema.EstatusValidacion {
			setClauses = append(setClauses, "estatus_validacion = 'inactiva'")
		}
		if instSchema.ValidadoAt {
			setClauses = append(setClauses, fmt.Sprintf("validado_at = $%d", nextArg))
			args = append(args, now)
			nextArg++
		}
		if instSchema.ValidadoPor && userID != "" {
			setClauses = append(setClauses, fmt.Sprintf("validado_por = $%d::uuid", nextArg))
			args = append(args, userID)
			nextArg++
		}
		if len(setClauses) > 0 {
			updateSQL := fmt.Sprintf(`
				update public.instituciones
				set %s
				where id = $1
			`, strings.Join(setClauses, ",\n\t\t\t\t"))
			if _, err := tx.Exec(r.Context(), updateSQL, args...); err != nil {
				http.Error(w, "db_error", http.StatusInternalServerError)
				return
			}
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	h.GetSolicitud(w, r, id)
}

func (h SuperAdminHandler) GetSolicitud(w http.ResponseWriter, r *http.Request, id int64) {
	hasInstitucionID, err := h.solicitudesHasInstitucionID(r)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	instSchema, err := h.institucionesSchema(r)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	var item RegistroSolicitudAdminDTO
	var instID sql.NullInt64
	var instStatus string
	var instActive sql.NullBool

	if hasInstitucionID {
		instStatusExpr := `''`
		if instSchema.EstatusValidacion {
			instStatusExpr = `coalesce(i.estatus_validacion::text, '')`
		}
		instActiveExpr := `null::boolean`
		if instSchema.Activo {
			instActiveExpr = `i.activo`
		}
		querySQL := `
			select
				s.id,
				s.institucion_id,
				s.institucion_nombre,
				s.tipo,
				s.nombre_contacto,
				coalesce(s.cargo_contacto, ''),
				s.email_contacto,
				coalesce(s.telefono_contacto, ''),
				coalesce(s.estado, ''),
				coalesce(s.ciudad, ''),
				coalesce(s.sitio_web, ''),
				coalesce(s.slug_deseado, ''),
				s.estatus,
				` + instStatusExpr + `,
				` + instActiveExpr + `,
				s.created_at::text,
				s.updated_at::text
			from public.registro_institucional_solicitudes s
			left join public.instituciones i on i.id = s.institucion_id
			where s.id = $1
		`
		err = queryRow(r.Context(), h.DB, querySQL, id).Scan(
			&item.ID,
			&instID,
			&item.InstitucionNombre,
			&item.Tipo,
			&item.NombreContacto,
			&item.CargoContacto,
			&item.EmailContacto,
			&item.TelefonoContacto,
			&item.Estado,
			&item.Ciudad,
			&item.SitioWeb,
			&item.SlugDeseado,
			&item.EstatusSolicitud,
			&instStatus,
			&instActive,
			&item.CreatedAt,
			&item.UpdatedAt,
		)
	} else {
		err = queryRow(r.Context(), h.DB, `
			select
				s.id,
				s.institucion_nombre,
				s.tipo,
				s.nombre_contacto,
				coalesce(s.cargo_contacto, ''),
				s.email_contacto,
				coalesce(s.telefono_contacto, ''),
				coalesce(s.estado, ''),
				coalesce(s.ciudad, ''),
				coalesce(s.sitio_web, ''),
				coalesce(s.slug_deseado, ''),
				s.estatus,
				s.created_at::text,
				s.updated_at::text
			from public.registro_institucional_solicitudes s
			where s.id = $1
		`, id).Scan(
			&item.ID,
			&item.InstitucionNombre,
			&item.Tipo,
			&item.NombreContacto,
			&item.CargoContacto,
			&item.EmailContacto,
			&item.TelefonoContacto,
			&item.Estado,
			&item.Ciudad,
			&item.SitioWeb,
			&item.SlugDeseado,
			&item.EstatusSolicitud,
			&item.CreatedAt,
			&item.UpdatedAt,
		)
	}
	if err != nil {
		http.Error(w, "not_found", http.StatusNotFound)
		return
	}

	if instID.Valid {
		item.InstitucionID = ptrInt64(instID.Int64)
	}
	item.EstatusInstitucion = instStatus
	if instActive.Valid {
		item.InstitucionActiva = &instActive.Bool
	}
	writeJSON(w, http.StatusOK, item)
}

func ParseSolicitudID(path string) (int64, error) {
	idStr := strings.TrimPrefix(path, "/api/super-admin/registro-institucional/")
	idStr = strings.Trim(idStr, "/")
	return strconv.ParseInt(idStr, 10, 64)
}

func RequireSuperAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !UserIsSuperAdminFromCtx(r.Context()) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (h SuperAdminHandler) BuildDiagnosticNote() string {
	return fmt.Sprintf("super admin active")
}
