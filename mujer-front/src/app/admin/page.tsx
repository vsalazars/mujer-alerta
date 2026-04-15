"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { UserRole } from "@/lib/auth";
import { api } from "@/lib/api";
import { themeFromBranding } from "@/lib/branding";
import { extractInstitutionSlug, withInstitutionSlug } from "@/lib/routing";

import { Button } from "@/components/ui/button";

import { Building2, Users, ShieldCheck, Sparkles } from "lucide-react";

type AuthUser = {
  user_id: string;
  email: string;
  nombre: string;
  rol: UserRole;
  centros: number[];
  expires_at: number;
};

type ConfiguracionInstitucion = {
  institucion_id: number;
  nombre_publico?: string;
  logo_url?: string;
  color_primario?: string;
  color_secundario?: string;
  color_apoyo?: string;
};

function readAuth(): { token: string; user: AuthUser | null } {
  if (typeof window === "undefined") return { token: "", user: null };
  const token = localStorage.getItem("auth_token") || "";
  const raw = localStorage.getItem("auth_user") || "";
  if (!token || !raw) return { token: "", user: null };
  try {
    const user = JSON.parse(raw) as AuthUser;
    return { token, user };
  } catch {
    return { token: "", user: null };
  }
}

export default function AdminPage() {
  const router = useRouter();
  const pathname = usePathname();
  const institucionSlug = extractInstitutionSlug(pathname);
  const [config, setConfig] = useState<ConfiguracionInstitucion | null>(null);

  // Nota: el guard de auth/admin ya vive en /admin/layout.tsx
  const { user } = useMemo(() => readAuth(), []);
  const theme = themeFromBranding(config);

  const expiresText = useMemo(() => {
    if (!user?.expires_at) return "";
    const d = new Date(user.expires_at * 1000);
    return d.toLocaleString();
  }, [user?.expires_at]);

  useEffect(() => {
    async function loadConfig() {
      try {
        const payload = await api<ConfiguracionInstitucion>("/api/admin/configuracion");
        setConfig(payload);
      } catch {
        setConfig(null);
      }
    }

    function onConfigUpdated(event: Event) {
      const customEvent = event as CustomEvent<ConfiguracionInstitucion>;
      if (customEvent.detail) {
        setConfig(customEvent.detail);
        return;
      }
      void loadConfig();
    }

    void loadConfig();
    window.addEventListener("institucion-config-updated", onConfigUpdated);
    return () => {
      window.removeEventListener("institucion-config-updated", onConfigUpdated);
    };
  }, []);

  return (
    <div className="grid gap-6">
      <div
        className="rounded-[28px] border p-6 shadow-sm"
        style={{
          borderColor: theme.border,
          background: `linear-gradient(135deg, ${theme.soft} 0%, rgba(255,255,255,1) 48%, ${theme.supportSoft} 100%)`,
          boxShadow: `0 20px 60px ${theme.glow}`,
        }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-3xl">
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.26em]"
              style={{
                backgroundColor: theme.supportSoft,
                color: theme.primary,
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Panel institucional
            </div>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-neutral-950">
              Administra tu tenant con identidad propia
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
              Ajusta centros, usuarios y configuración visual de{" "}
              <span className="font-semibold" style={{ color: theme.primary }}>
                {config?.nombre_publico?.trim() || "tu institución"}
              </span>{" "}
              para que el panel admin, la encuesta pública y el tablero de resultados mantengan la misma identidad institucional.
            </p>
          </div>

          <div
            className="inline-flex items-center gap-3 self-start rounded-2xl border px-4 py-3"
            style={{
              borderColor: theme.border,
              backgroundColor: "rgba(255,255,255,0.82)",
            }}
          >
            <div
              className="grid h-11 w-11 place-items-center rounded-2xl"
              style={{ backgroundColor: theme.soft }}
            >
              <ShieldCheck className="h-5 w-5" style={{ color: theme.primary }} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
                Sesión activa
              </p>
              <p className="text-sm font-semibold text-neutral-900">
                Owner institucional
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div
          className="rounded-2xl border bg-white p-5 shadow-sm"
          style={{ borderColor: theme.border }}
        >
          <p className="text-sm font-semibold text-neutral-900">Sesión</p>
          <p className="mt-2 text-sm text-neutral-600">
            Token expira:{" "}
            <span className="font-semibold">{expiresText || "—"}</span>
          </p>
          <div
            className="mt-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              backgroundColor: theme.supportSoft,
              color: theme.primary,
            }}
          >
            Tema institucional activo
          </div>
        </div>

        <div
          className="rounded-2xl border bg-white p-5 shadow-sm"
          style={{ borderColor: theme.border }}
        >
          <p className="text-sm font-semibold text-neutral-900">Centros</p>
          <p className="mt-2 text-sm text-neutral-600">
            Administra catálogo y configuración por institución.
          </p>
          <Button
            className="mt-4 w-full rounded-full font-semibold shadow-sm"
            style={{ background: theme.gradient, color: "white" }}
            onClick={() => router.push(withInstitutionSlug(institucionSlug, "/admin/centros"))}
          >
            <Building2 className="mr-2 h-5 w-5" />
            Ir a centros
          </Button>
        </div>

        <div
          className="rounded-2xl border bg-white p-5 shadow-sm"
          style={{ borderColor: theme.border }}
        >
          <p className="text-sm font-semibold text-neutral-900">Usuarios</p>
          <p className="mt-2 text-sm text-neutral-600">
            Crea usuarios, roles y asignación a centros.
          </p>
          <Button
            variant="outline"
            className="mt-4 w-full rounded-full font-semibold"
            style={{
              borderColor: theme.support,
              color: theme.primary,
              backgroundColor: theme.supportSoft,
            }}
            onClick={() => router.push(withInstitutionSlug(institucionSlug, "/admin/usuarios"))}
          >
            <Users className="mr-2 h-5 w-5" />
            Ir a usuarios
          </Button>
        </div>
      </div>

      {/* Placeholder */}
      <div
        className="rounded-2xl border border-dashed bg-white p-5"
        style={{ borderColor: theme.support }}
      >
        <p className="text-sm text-neutral-700">
          Siguiente: construir{" "}
          <span className="font-semibold">/admin/centros</span> y{" "}
          <span className="font-semibold">/admin/usuarios</span> con tabla para
          escritorio (buscar, paginar, crear/editar).
        </p>
      </div>

      <div className="text-center text-xs text-neutral-500">
        Desarrollado por Investigadores del Instituto Politécnico Nacional
      </div>
    </div>
  );
}
