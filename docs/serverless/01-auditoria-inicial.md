# Auditoría inicial para migración serverless

## Proyecto

**Nombre:** Mujer Alerta  
**Repositorio:** `vsalazars/mujer-alerta`  
**Rama:** `migracion/serverless-mujer-alerta`  
**Arquitectura objetivo:** Cloud Run, Neon PostgreSQL y servicios administrados de Google Cloud.

## Objetivo

Migrar Mujer Alerta a una arquitectura serverless que:

- escale a cero cuando no tenga uso;
- no dependa de máquinas virtuales;
- no dependa de almacenamiento local permanente;
- utilice PostgreSQL serverless mediante Neon;
- proteja secretos mediante Secret Manager;
- use contenedores reproducibles;
- conserve las funcionalidades actuales;
- mantenga los costos fijos al mínimo.

## Componentes actuales

### Frontend

- Next.js 16.
- React 19.
- App Router.
- Aplicación multi-tenant mediante `institucionSlug`.
- Superadministración.
- Administración institucional.
- Panel de centros.
- Diagnóstico público.
- Resultados y gráficas.
- Configuración local mediante `.env.local`.
- Despliegue actual vinculado con Vercel.

### Backend

- Go 1.24.
- Servidor basado en `net/http`.
- PostgreSQL mediante `pgxpool`.
- Autenticación JWT.
- Roles de superadministrador, administrador institucional y centro.
- Middleware CORS propio.
- API multi-tenant.
- Procesamiento NLP invocado desde el backend.
- Configuración mediante variables de entorno.

### Procesamiento NLP

- Módulo Python separado en `mujer-nlp`.
- Procesamiento de comentarios.
- Uso de PostgreSQL.
- Ejecución coordinada actualmente desde el backend Go.
- Estado de trabajos mantenido en memoria.

### Base de datos

- PostgreSQL local.
- Base de desarrollo: `mujer_alerta`.
- Existen migraciones SQL y respaldos en la raíz.
- La estructura y los datos deberán migrarse a Neon con validación.

La URL local de desarrollo no se utilizará en producción. La URL productiva será almacenada en Secret Manager.

## Compatibilidad inicial

### Elementos favorables

- El backend ya utiliza variables de entorno.
- La conexión utiliza `DATABASE_URL`.
- PostgreSQL se consume mediante `pgxpool`.
- El frontend usa una versión moderna de Next.js.
- La autenticación JWT no depende de sesiones locales.
- Frontend, backend y NLP ya están separados.
- Los instrumentos JSON pueden incluirse dentro del contenedor.

### Adaptaciones necesarias

#### Puerto

Cloud Run asigna el puerto mediante `PORT`.

El backend deberá escuchar en `0.0.0.0:$PORT`, conservando un valor local predeterminado para desarrollo.

#### Pool PostgreSQL

El pool actual utiliza valores fijos:

- `MaxConns = 10`
- `MinConns = 1`

Se harán configurables:

- `DB_MAX_CONNS`
- `DB_MIN_CONNS`
- `DB_MAX_CONN_IDLE_TIME`
- `DB_MAX_CONN_LIFETIME`
- `DB_HEALTH_CHECK_PERIOD`

Configuración inicial propuesta para Cloud Run:

- `DB_MAX_CONNS=3`
- `DB_MIN_CONNS=0`

La conexión de Neon deberá utilizar su endpoint agrupado cuando corresponda.

#### NLP y trabajos en memoria

El procesamiento NLP actual no es completamente compatible con Cloud Run porque:

- una instancia puede apagarse;
- pueden existir varias instancias;
- el estado en memoria no se comparte;
- una nueva solicitud puede llegar a otra instancia;
- los procesos en segundo plano pueden interrumpirse;
- el escalado a cero elimina el estado local.

Alternativas por analizar:

1. Cloud Run Job.
2. Servicio Cloud Run dedicado invocado por Cloud Tasks.
3. Cola persistente respaldada por PostgreSQL.
4. Procesamiento síncrono, únicamente si su duración es corta.

#### CORS

Los orígenes permitidos deberán configurarse mediante `CORS_ALLOWED_ORIGINS`.

No deben quedar dominios productivos codificados directamente en Go.

#### Salud del servicio

Se crearán:

- `/healthz`: confirma que el proceso está activo.
- `/readyz`: confirma acceso a PostgreSQL.

#### Apagado controlado

El backend deberá manejar `SIGTERM` y `SIGINT`, cerrando ordenadamente:

- servidor HTTP;
- pool PostgreSQL;
- recursos auxiliares.

#### Secretos

Secretos previstos:

- `DATABASE_URL`
- `JWT_SECRET`

No se guardarán en:

- Git;
- Dockerfiles;
- imágenes;
- variables públicas del frontend;
- documentación con valores reales.

#### Contenedores

Se deberán crear:

- `mujer-back/Dockerfile`
- `mujer-back/.dockerignore`
- `mujer-front/Dockerfile`
- `mujer-front/.dockerignore`
- `mujer-nlp/Dockerfile`
- `mujer-nlp/.dockerignore`

#### Frontend

Next.js deberá utilizar `output: "standalone"`.

El contenedor deberá respetar:

- `PORT`
- `HOSTNAME=0.0.0.0`

También se separarán correctamente las URLs usadas por:

- navegador;
- renderizado del servidor;
- desarrollo local;
- producción.

#### Archivos locales

Cloud Run proporciona disco temporal.

Se verificará que ninguna función dependa de:

- cargas persistidas localmente;
- archivos generados de forma permanente;
- resultados NLP guardados solo en disco;
- cachés imprescindibles.

## Arquitectura objetivo preliminar

Usuarios → Frontend Next.js en Cloud Run → Backend Go en Cloud Run → Neon PostgreSQL.

El procesamiento NLP se ejecutará como Cloud Run Job o como servicio dedicado, según la auditoría del módulo Python.

Servicios auxiliares previstos:

- Artifact Registry;
- Secret Manager;
- Cloud Build;
- Cloud Logging;
- Cloud Tasks, si resulta necesario.

## Riesgos iniciales

| Riesgo | Nivel | Tratamiento |
|---|---:|---|
| Trabajo NLP perdido al apagarse una instancia | Alto | Separar del proceso HTTP |
| Estado NLP no compartido | Alto | Persistir estado o usar Jobs |
| Exceso de conexiones a Neon | Alto | Pool configurable y conservador |
| Configuración incorrecta de URL API | Alto | Separar URL pública e interna |
| CORS bloqueando producción | Medio | Configuración por entorno |
| Puerto incompatible con Cloud Run | Medio | Utilizar `PORT` |
| Dependencia de disco local | Medio | Auditar y reemplazar |
| Secretos expuestos | Alto | Secret Manager |
| Migración incompleta de PostgreSQL | Alto | Inventario y comparación |
| Cold start | Bajo | Aceptable para el uso actual |

## Estrategia

### Etapa 1: backend

- configuración centralizada;
- puerto dinámico;
- pool configurable;
- health checks;
- apagado ordenado;
- CORS configurable;
- pruebas;
- Dockerfile.

### Etapa 2: NLP

- identificar dependencias;
- medir duración;
- definir mecanismo serverless;
- persistir estados;
- crear contenedor.

### Etapa 3: frontend

- habilitar standalone;
- separar configuración;
- crear contenedor;
- validar SSR y cliente.

### Etapa 4: PostgreSQL

- inventario;
- respaldo;
- suma SHA-256;
- restauración en Neon;
- comparación estructural;
- comparación de conteos;
- validación funcional.

### Etapa 5: Google Cloud

- proyecto;
- APIs;
- Artifact Registry;
- cuentas de servicio;
- Secret Manager;
- Cloud Run;
- permisos mínimos.

### Etapa 6: producción

- pruebas funcionales;
- validación multi-tenant;
- revisión de logs;
- dominio y HTTPS;
- monitoreo de costos;
- plan de reversión.

## Criterios de aceptación

La migración terminará cuando:

- frontend y backend funcionen en Cloud Run;
- los servicios escalen a cero;
- PostgreSQL opere desde Neon;
- NLP resista reinicios;
- no haya secretos en Git;
- no exista dependencia de disco persistente local;
- los dominios funcionen con HTTPS;
- todos los roles y flujos multi-tenant estén validados;
- los datos locales coincidan con Neon;
- exista procedimiento de rollback;
- no quede infraestructura fija innecesaria.

## Estado

- [x] Baseline y rama de migración.
- [x] Auditoría inicial documental.
- [ ] Auditoría detallada de `main.go`.
- [ ] Configuración serverless del backend.
- [ ] Separación del procesamiento NLP.
- [ ] Contenedor del backend.
- [ ] Contenedor del frontend.
- [ ] Contenedor NLP.
- [ ] Migración a Neon.
- [ ] Despliegue en Google Cloud.
- [ ] Validación productiva.
