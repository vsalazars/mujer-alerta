-- FASE 1: enums y commit independiente

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'estatus_institucion_enum'
  ) THEN
    CREATE TYPE public.estatus_institucion_enum AS ENUM (
      'pendiente',
      'activa',
      'inactiva',
      'rechazada',
      'suspendida'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'accion_auditoria_enum'
  ) THEN
    CREATE TYPE public.accion_auditoria_enum AS ENUM (
      'crear',
      'actualizar',
      'eliminar',
      'activar',
      'desactivar',
      'validar',
      'rechazar',
      'login',
      'logout',
      'exportar'
    );
  END IF;
END$$;

ALTER TYPE public.rol_usuario_enum ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.rol_usuario_enum ADD VALUE IF NOT EXISTS 'owner_institucion';
ALTER TYPE public.rol_usuario_enum ADD VALUE IF NOT EXISTS 'admin_institucion';
ALTER TYPE public.rol_usuario_enum ADD VALUE IF NOT EXISTS 'analista';
ALTER TYPE public.rol_usuario_enum ADD VALUE IF NOT EXISTS 'operador';
