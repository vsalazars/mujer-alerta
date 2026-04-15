WITH target_institucion AS (
  SELECT id
  FROM public.instituciones
  WHERE slug = 'institucion-demo-inicial'
  UNION ALL
  SELECT id
  FROM public.instituciones
  ORDER BY id
  LIMIT 1
)
INSERT INTO public.usuarios (
  email,
  nombre,
  rol,
  password_hash,
  activo,
  institucion_id
)
SELECT
  'superadmin@mujeralerta.local',
  'Super Admin',
  'super_admin',
  crypt('SuperAdmin123!', gen_salt('bf')),
  true,
  ti.id
FROM target_institucion ti
WHERE NOT EXISTS (
  SELECT 1
  FROM public.usuarios u
  WHERE lower(u.email) = 'superadmin@mujeralerta.local'
);
