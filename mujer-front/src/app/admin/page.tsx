"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { cacheBranding, readCachedBranding, themeFromBranding } from "@/lib/branding";
import { extractInstitutionSlug, withInstitutionSlug } from "@/lib/routing";

import { Button } from "@/components/ui/button";

import { Building2, Settings, Users } from "lucide-react";

type ConfiguracionInstitucion = {
  institucion_id: number;
  nombre_publico?: string;
  logo_url?: string;
  color_primario?: string;
  color_secundario?: string;
  color_apoyo?: string;
};

export default function AdminPage() {
  const router = useRouter();
  const pathname = usePathname();
  const institucionSlug = extractInstitutionSlug(pathname);
  const [config, setConfig] = useState<ConfiguracionInstitucion | null>(() =>
    readCachedBranding<ConfiguracionInstitucion>(institucionSlug)
  );

  const theme = themeFromBranding(config);

  useEffect(() => {
    async function loadConfig() {
      try {
        const payload = await api<ConfiguracionInstitucion>("/api/admin/configuracion");
        cacheBranding(payload, institucionSlug);
        setConfig(payload);
      } catch {
        setConfig(null);
      }
    }

    function onConfigUpdated(event: Event) {
      const customEvent = event as CustomEvent<ConfiguracionInstitucion>;
      if (customEvent.detail) {
        cacheBranding(customEvent.detail, institucionSlug);
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
  }, [institucionSlug]);

  return (
    <div className="grid gap-6">
      {/* Quick cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div
          className="flex h-full flex-col rounded-2xl border bg-white p-5 shadow-sm"
          style={{ borderColor: theme.border }}
        >
          <p className="text-sm font-semibold text-neutral-900">Centros</p>
          <p className="mt-2 min-h-[3.5rem] text-sm text-neutral-600">
            Administra catálogo y configuración por institución.
          </p>
          <Button
            className="mt-auto w-full rounded-full font-semibold shadow-sm"
            style={{ background: theme.gradient, color: "white" }}
            onClick={() => router.push(withInstitutionSlug(institucionSlug, "/admin/centros"))}
          >
            <Building2 className="mr-2 h-5 w-5" />
            Ir a centros
          </Button>
        </div>

        <div
          className="flex h-full flex-col rounded-2xl border bg-white p-5 shadow-sm"
          style={{ borderColor: theme.border }}
        >
          <p className="text-sm font-semibold text-neutral-900">Usuarios</p>
          <p className="mt-2 min-h-[3.5rem] text-sm text-neutral-600">
            Crea usuarios, roles y asignación a centros.
          </p>
          <Button
            className="mt-auto w-full rounded-full font-semibold shadow-sm"
            style={{
              background: theme.gradient,
              color: "white",
            }}
            onClick={() => router.push(withInstitutionSlug(institucionSlug, "/admin/usuarios"))}
          >
            <Users className="mr-2 h-5 w-5" />
            Ir a usuarios
          </Button>
        </div>

        <div
          className="flex h-full flex-col rounded-2xl border bg-white p-5 shadow-sm"
          style={{ borderColor: theme.border }}
        >
          <p className="text-sm font-semibold text-neutral-900">Configuración</p>
          <p className="mt-2 min-h-[3.5rem] text-sm text-neutral-600">
            Actualiza branding, logotipo y parámetros generales del tenant.
          </p>
          <Button
            className="mt-auto w-full rounded-full font-semibold shadow-sm"
            style={{
              background: theme.gradient,
              color: "white",
            }}
            onClick={() => router.push(withInstitutionSlug(institucionSlug, "/admin/config"))}
          >
            <Settings className="mr-2 h-5 w-5" />
            Ir a configuración
          </Button>
        </div>
      </div>

      
    </div>
  );
}
