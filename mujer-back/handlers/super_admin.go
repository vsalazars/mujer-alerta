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

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
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
	ContactoPasswordOK bool   `json:"contacto_password_configurada"`
	CreatedAt          string `json:"created_at"`
	UpdatedAt          string `json:"updated_at"`
}

type ActualizarSolicitudRegistroReq struct {
	Accion string `json:"accion"`
}

type EditarSolicitudRegistroReq struct {
	InstitucionNombre string `json:"institucion_nombre"`
	Tipo              string `json:"tipo"`
	NombreContacto    string `json:"nombre_contacto"`
	CargoContacto     string `json:"cargo_contacto"`
	EmailContacto     string `json:"email_contacto"`
	PasswordContacto  string `json:"password_contacto"`
	TelefonoContacto  string `json:"telefono_contacto"`
	Estado            string `json:"estado"`
	Ciudad            string `json:"ciudad"`
	SitioWeb          string `json:"sitio_web"`
	SlugDeseado       string `json:"slug_deseado"`
}

func ptrInt64(v int64) *int64 { return &v }

type institucionesSchemaSupport struct {
	Activo            bool
	EstatusValidacion bool
	ValidadoAt        bool
	ValidadoPor       bool
}

type solicitudesSchemaSupport struct {
	InstitucionID        bool
	ContactoPasswordHash bool
}

func (h SuperAdminHandler) solicitudesSchema(r *http.Request) (solicitudesSchemaSupport, error) {
	rows, err := query(r.Context(), h.DB, `
		select column_name
		from information_schema.columns
		where table_schema = 'public'
		  and table_name = 'registro_institucional_solicitudes'
		  and column_name in ('institucion_id', 'contacto_password_hash')
	`)
	if err != nil {
		return solicitudesSchemaSupport{}, err
	}
	defer rows.Close()

	support := solicitudesSchemaSupport{}
	for rows.Next() {
		var column string
		if err := rows.Scan(&column); err != nil {
			return solicitudesSchemaSupport{}, err
		}
		switch column {
		case "institucion_id":
			support.InstitucionID = true
		case "contacto_password_hash":
			support.ContactoPasswordHash = true
		}
	}
	if err := rows.Err(); err != nil {
		return solicitudesSchemaSupport{}, err
	}
	return support, nil
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

func hashSolicitudPassword(pass string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(pass), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

func (h SuperAdminHandler) upsertContactoAdminUser(
	r *http.Request,
	tx pgx.Tx,
	institucionID int64,
	nombreContacto string,
	emailContacto string,
	passwordHash string,
) error {
	emailContacto = strings.ToLower(strings.TrimSpace(emailContacto))
	nombreContacto = strings.TrimSpace(nombreContacto)

	if institucionID <= 0 || emailContacto == "" || nombreContacto == "" {
		return fmt.Errorf("missing_contact_user_data")
	}

	var userID string
	err := tx.QueryRow(r.Context(), `
		select id::text
		from public.usuarios
		where institucion_id = $1
		  and lower(email) = $2
		order by created_at asc
		limit 1
	`, institucionID, emailContacto).Scan(&userID)

	if err == nil {
		if passwordHash != "" {
			_, err = tx.Exec(r.Context(), `
				update public.usuarios
				set email = $2,
					nombre = $3,
					rol = 'admin',
					activo = true,
					password_hash = $4
				where id = $1::uuid
			`, userID, emailContacto, nombreContacto, passwordHash)
		} else {
			_, err = tx.Exec(r.Context(), `
				update public.usuarios
				set email = $2,
					nombre = $3,
					rol = 'admin',
					activo = true
				where id = $1::uuid
			`, userID, emailContacto, nombreContacto)
		}
		return err
	}

	if passwordHash == "" {
		return fmt.Errorf("contact_password_required")
	}

	_, err = tx.Exec(r.Context(), `
		insert into public.usuarios (email, nombre, rol, password_hash, activo, institucion_id)
		values ($1, $2, 'admin', $3, true, $4)
	`, emailContacto, nombreContacto, passwordHash, institucionID)
	return err
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
	solicitudesSchema, err := h.solicitudesSchema(r)
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
	if solicitudesSchema.InstitucionID {
		instStatusExpr := `''`
		if instSchema.EstatusValidacion {
			instStatusExpr = `coalesce(i.estatus_validacion::text, '')`
		}
		instActiveExpr := `null::boolean`
		if instSchema.Activo {
			instActiveExpr = `i.activo`
		}
		passwordConfiguredExpr := `false`
		if solicitudesSchema.ContactoPasswordHash {
			passwordConfiguredExpr = `(coalesce(s.contacto_password_hash, '') <> '')`
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
				` + passwordConfiguredExpr + `,
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
		var contactoPasswordOK bool
		var instStatus string
		var instActive sql.NullBool

		if solicitudesSchema.InstitucionID {
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
				&contactoPasswordOK,
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
			item.ContactoPasswordOK = contactoPasswordOK
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
			item.ContactoPasswordOK = true
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
		NombreContacto    string
		EmailContacto     string
		PasswordHash      string
		TelefonoContacto  string
		Estado            string
		Ciudad            string
		SlugDeseado       string
		EstatusSolicitud  string
	}

	var state solicitudState
	var institucionID sql.NullInt64
	solicitudesSchema, err := h.solicitudesSchema(r)
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
				s.nombre_contacto,
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
	if solicitudesSchema.InstitucionID {
		passwordSelect := `''`
		if solicitudesSchema.ContactoPasswordHash {
			passwordSelect = `coalesce(s.contacto_password_hash, '')`
		}
		scanErr = tx.QueryRow(r.Context(), `
			select
				s.institucion_id,
				s.institucion_nombre,
				s.tipo,
				s.nombre_contacto,
				s.email_contacto,
				`+passwordSelect+`,
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
			&state.NombreContacto,
			&state.EmailContacto,
			&state.PasswordHash,
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
			&state.NombreContacto,
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

		if solicitudesSchema.InstitucionID {
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

		if err := h.upsertContactoAdminUser(
			r,
			tx,
			*state.InstitucionID,
			state.NombreContacto,
			state.EmailContacto,
			state.PasswordHash,
		); err != nil {
			if err.Error() == "contact_password_required" {
				http.Error(w, "contact_password_required", http.StatusConflict)
				return
			}
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
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

func (h SuperAdminHandler) EditSolicitud(w http.ResponseWriter, r *http.Request, id int64) {
	var req EditarSolicitudRegistroReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad_json", http.StatusBadRequest)
		return
	}

	institucionNombre := normalizeOptional(req.InstitucionNombre)
	tipo := normalizeOptional(req.Tipo)
	nombreContacto := normalizeOptional(req.NombreContacto)
	cargoContacto := normalizeOptional(req.CargoContacto)
	emailContacto := normalizeEmailRegistro(req.EmailContacto)
	passwordContacto := strings.TrimSpace(req.PasswordContacto)
	telefonoContacto := normalizeOptional(req.TelefonoContacto)
	estado := normalizeOptional(req.Estado)
	ciudad := normalizeOptional(req.Ciudad)
	sitioWeb := normalizeOptional(req.SitioWeb)
	slugDeseado := strings.ToLower(normalizeOptional(req.SlugDeseado))

	if tipo == "" {
		tipo = "institucion"
	}
	if tipo != "universidad" && tipo != "empresa" && tipo != "institucion" {
		http.Error(w, "bad_tipo", http.StatusBadRequest)
		return
	}
	if institucionNombre == "" || nombreContacto == "" || emailContacto == "" {
		http.Error(w, "missing_required_fields", http.StatusBadRequest)
		return
	}
	if !strings.Contains(emailContacto, "@") {
		http.Error(w, "bad_email", http.StatusBadRequest)
		return
	}
	if slugDeseado == "" {
		http.Error(w, "missing_slug", http.StatusBadRequest)
		return
	}
	if !registroSlugRegex.MatchString(slugDeseado) {
		http.Error(w, "bad_slug", http.StatusBadRequest)
		return
	}
	passwordHash := ""
	if passwordContacto != "" {
		if len(passwordContacto) < 8 {
			http.Error(w, "weak_password", http.StatusBadRequest)
			return
		}
		hashedPassword, hashErr := hashSolicitudPassword(passwordContacto)
		if hashErr != nil {
			http.Error(w, "hash_error", http.StatusInternalServerError)
			return
		}
		passwordHash = hashedPassword
	}

	tx, err := begin(r.Context(), h.DB)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(r.Context())

	var linkedInstitucionID sql.NullInt64
	var currentSlug string
	var currentStatus string
	solicitudesSchema, err := h.solicitudesSchema(r)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	if err := tx.QueryRow(r.Context(), `
		select institucion_id, coalesce(slug_deseado, ''), estatus
		from public.registro_institucional_solicitudes
		where id = $1
	`, id).Scan(&linkedInstitucionID, &currentSlug, &currentStatus); err != nil {
		http.Error(w, "not_found", http.StatusNotFound)
		return
	}

	if !strings.EqualFold(currentSlug, slugDeseado) {
		exists, err := h.slugExists(r, slugDeseado)
		if err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		if exists {
			http.Error(w, "slug_exists", http.StatusConflict)
			return
		}
	}

	updateClauses := []string{
		"institucion_nombre = $2",
		"tipo = $3",
		"nombre_contacto = $4",
		"cargo_contacto = $5",
		"email_contacto = $6",
		"telefono_contacto = $7",
		"estado = $8",
		"ciudad = $9",
		"sitio_web = $10",
		"slug_deseado = $11",
	}
	args := []any{id, institucionNombre, tipo, nombreContacto, cargoContacto, emailContacto, telefonoContacto, estado, ciudad, sitioWeb, slugDeseado}
	if solicitudesSchema.ContactoPasswordHash && passwordHash != "" {
		updateClauses = append(updateClauses, "contacto_password_hash = $12")
		args = append(args, passwordHash)
	}
	updateSQL := fmt.Sprintf(`
		update public.registro_institucional_solicitudes
		set %s
		where id = $1
	`, strings.Join(updateClauses, ",\n\t\t\t"))
	if _, err := tx.Exec(r.Context(), updateSQL, args...); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	if linkedInstitucionID.Valid {
		if _, err := tx.Exec(r.Context(), `
			update public.instituciones
			set nombre = $2,
				slug = $3,
				tipo = $4,
				email_contacto = $5,
				telefono = $6,
				estado = $7,
				ciudad = $8
			where id = $1
		`, linkedInstitucionID.Int64, institucionNombre, slugDeseado, tipo, emailContacto, telefonoContacto, estado, ciudad); err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		if passwordHash != "" {
			if err := h.upsertContactoAdminUser(r, tx, linkedInstitucionID.Int64, nombreContacto, emailContacto, passwordHash); err != nil {
				http.Error(w, "db_error", http.StatusInternalServerError)
				return
			}
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	_ = currentStatus
	h.GetSolicitud(w, r, id)
}

func (h SuperAdminHandler) EditInstitucion(w http.ResponseWriter, r *http.Request, id int64) {
	var req EditarSolicitudRegistroReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad_json", http.StatusBadRequest)
		return
	}

	institucionNombre := normalizeOptional(req.InstitucionNombre)
	tipo := normalizeOptional(req.Tipo)
	emailContacto := normalizeEmailRegistro(req.EmailContacto)
	telefonoContacto := normalizeOptional(req.TelefonoContacto)
	estado := normalizeOptional(req.Estado)
	ciudad := normalizeOptional(req.Ciudad)
	slugDeseado := strings.ToLower(normalizeOptional(req.SlugDeseado))

	if tipo == "" {
		tipo = "institucion"
	}
	if tipo != "universidad" && tipo != "empresa" && tipo != "institucion" {
		http.Error(w, "bad_tipo", http.StatusBadRequest)
		return
	}
	if institucionNombre == "" {
		http.Error(w, "missing_required_fields", http.StatusBadRequest)
		return
	}
	if emailContacto != "" && !strings.Contains(emailContacto, "@") {
		http.Error(w, "bad_email", http.StatusBadRequest)
		return
	}
	if slugDeseado == "" {
		http.Error(w, "missing_slug", http.StatusBadRequest)
		return
	}
	if !registroSlugRegex.MatchString(slugDeseado) {
		http.Error(w, "bad_slug", http.StatusBadRequest)
		return
	}

	tx, err := begin(r.Context(), h.DB)
	if err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(r.Context())

	var currentSlug string
	var createdAt string
	var updatedAt string
	var estatusInstitucion string
	var activo sql.NullBool
	if err := tx.QueryRow(r.Context(), `
		select
			coalesce(slug, ''),
			created_at::text,
			updated_at::text,
			coalesce(estatus_validacion::text, ''),
			activo
		from public.instituciones
		where id = $1
	`, id).Scan(&currentSlug, &createdAt, &updatedAt, &estatusInstitucion, &activo); err != nil {
		http.Error(w, "not_found", http.StatusNotFound)
		return
	}

	if !strings.EqualFold(currentSlug, slugDeseado) {
		exists, err := h.slugExists(r, slugDeseado)
		if err != nil {
			http.Error(w, "db_error", http.StatusInternalServerError)
			return
		}
		if exists {
			http.Error(w, "slug_exists", http.StatusConflict)
			return
		}
	}

	if _, err := tx.Exec(r.Context(), `
		update public.instituciones
		set nombre = $2,
			slug = $3,
			tipo = $4,
			email_contacto = $5,
			telefono = $6,
			estado = $7,
			ciudad = $8
		where id = $1
	`, id, institucionNombre, slugDeseado, tipo, emailContacto, telefonoContacto, estado, ciudad); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		http.Error(w, "db_error", http.StatusInternalServerError)
		return
	}

	item := RegistroSolicitudAdminDTO{
		ID:                 -id,
		InstitucionID:      ptrInt64(id),
		Origen:             "institucion",
		SoloLectura:        true,
		InstitucionNombre:  institucionNombre,
		Tipo:               tipo,
		NombreContacto:     "Registro previo",
		EmailContacto:      emailContacto,
		TelefonoContacto:   telefonoContacto,
		Estado:             estado,
		Ciudad:             ciudad,
		SlugDeseado:        slugDeseado,
		EstatusSolicitud:   "aprobado",
		EstatusInstitucion: estatusInstitucion,
		CreatedAt:          createdAt,
		UpdatedAt:          updatedAt,
	}
	if activo.Valid {
		item.InstitucionActiva = &activo.Bool
	}
	writeJSON(w, http.StatusOK, item)
}

func (h SuperAdminHandler) GetSolicitud(w http.ResponseWriter, r *http.Request, id int64) {
	solicitudesSchema, err := h.solicitudesSchema(r)
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

	if solicitudesSchema.InstitucionID {
		instStatusExpr := `''`
		if instSchema.EstatusValidacion {
			instStatusExpr = `coalesce(i.estatus_validacion::text, '')`
		}
		instActiveExpr := `null::boolean`
		if instSchema.Activo {
			instActiveExpr = `i.activo`
		}
		passwordConfiguredExpr := `false`
		if solicitudesSchema.ContactoPasswordHash {
			passwordConfiguredExpr = `(coalesce(s.contacto_password_hash, '') <> '')`
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
				` + passwordConfiguredExpr + `,
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
			&item.ContactoPasswordOK,
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
