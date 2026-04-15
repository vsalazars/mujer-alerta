"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isAdminRole, type UserRole } from "@/lib/auth";
import { api } from "@/lib/api";
import { themeFromBranding } from "@/lib/branding";
import { extractInstitutionSlug, withInstitutionSlug } from "@/lib/routing";

import { Button } from "@/components/ui/button";
import { LogOut, ShieldCheck } from "lucide-react";

type AuthUser = {
  user_id: string;
  email: string;
  nombre: string;
  rol: UserRole;
  centros: number[];
  centro_nombres?: string[];
  expires_at: number;
};

type ConfiguracionInstitucion = {
  institucion_id: number;
  nombre_publico?: string;
  logo_url?: string;
  color_primario?: string;
  color_secundario?: string;
};

function readAuth(): { token: string; user: AuthUser | null } {
  if (typeof window === "undefined") return { token: "", user: null };
  const token = localStorage.getItem("auth_token") || "";
  const raw = localStorage.getItem("auth_user") || "";
  if (!token || !raw) return { token: "", user: null };
  try {
    return { token, user: JSON.parse(raw) as AuthUser };
  } catch {
    return { token: "", user: null };
  }
}

function clearAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_user");
}

function initials(name: string) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const a = parts[0]?.[0] || "U";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (a + b).toUpperCase();
}

export default function CentroLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const institucionSlug = extractInstitutionSlug(pathname);
  const [user] = useState<AuthUser | null>(() => readAuth().user);
  const [config, setConfig] = useState<ConfiguracionInstitucion | null>(null);
  const centroLabel =
    user?.centro_nombres?.filter(Boolean).join(" / ") ||
    (user?.centros?.length ? `Centro #${user.centros.join(", #")}` : "");
  const theme = themeFromBranding(config);

  useEffect(() => {
    async function loadConfig() {
      try {
        const payload = await api<ConfiguracionInstitucion>("/api/tenant/branding");
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

    const { user: sessionUser } = readAuth();
    if (!sessionUser) {
      router.replace("/");
      return;
    }
    if (sessionUser.rol !== "centro") {
      // si es admin, mándalo a admin
      router.replace(
        withInstitutionSlug(institucionSlug, isAdminRole(sessionUser.rol) ? "/admin" : "/")
      );
      return;
    }
    void loadConfig();
    window.addEventListener("institucion-config-updated", onConfigUpdated);

    return () => {
      window.removeEventListener(
        "institucion-config-updated",
        onConfigUpdated
      );
    };
  }, [institucionSlug, router]);

  function onLogout() {
    clearAuth();
    router.replace("/");
  }

  if (!user) return null;

  return (
    <main
      className="min-h-dvh bg-white"
      style={
        {
          "--brand-primary": theme.primary,
          "--brand-secondary": theme.secondary,
        } as CSSProperties
      }
    >
      {/* Header fijo */}
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto w-[90vw] max-w-none px-4 py-4 md:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-4">
                {config?.logo_url ? (
                  <img
                    src={config.logo_url}
                    alt="Logo institucional"
                    className="h-14 w-auto max-w-[84px] shrink-0 object-contain"
                  />
                ) : (
                  <div
                    className="grid h-11 w-11 place-items-center rounded-2xl"
                      style={{ backgroundColor: theme.soft }}
                  >
                    <ShieldCheck className="h-5 w-5" style={{ color: theme.primary }} />
                  </div>
                )}

                <div className="leading-tight">
                  <p className="text-base font-extrabold tracking-tight" style={{ color: theme.primary }}>
                    {config?.nombre_publico?.trim() || "Mujer Alerta"}
                  </p>
                  <p className="text-xs text-neutral-500">Panel de resultados</p>
                  {centroLabel ? (
                    <p className="mt-1 text-xs font-medium text-neutral-700">
                      {centroLabel}
                    </p>
                  ) : null}
                </div>
              </div>

           
            </div>

            <div className="flex items-center gap-3">
              <div
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
                style={{ backgroundColor: theme.soft, color: theme.primary }}
                aria-label="Avatar"
                title={user.nombre}
              >
                <span className="text-sm font-bold">{initials(user.nombre)}</span>
              </div>

              <div className="hidden text-right md:block">
                <p className="text-sm font-semibold text-neutral-900">{user.nombre}</p>
                <p className="text-xs text-neutral-500">{user.email}</p>
              </div>

              <Button onClick={onLogout} variant="outline" className="rounded-full">
                <LogOut className="mr-2 h-4 w-4" />
                Salir
              </Button>
            </div>
          </div>

         
        </div>
      </header>

      {/* Contenido */}
      <div className="mx-auto w-[90vw] max-w-none px-4 py-6 md:px-6">{children}</div>
    </main>
  );
}
