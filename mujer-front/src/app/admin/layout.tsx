"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, type CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isAdminRole, type UserRole } from "@/lib/auth";
import { api } from "@/lib/api";
import { themeFromBranding } from "@/lib/branding";
import { extractInstitutionSlug, withInstitutionSlug } from "@/lib/routing";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import {
  Building2,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

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

function headerFor(pathname: string) {
  const clean = pathname.replace(/^\/[^/]+/, "");
  if (clean.startsWith("/admin/centros")) {
    return {
      title: "Centros",
      desc: "Alta, edición y desactivación de centros.",
    };
  }
  if (clean.startsWith("/admin/usuarios")) {
    return {
      title: "Usuarios",
      desc: "Gestión de usuarios, roles y asignación a centros.",
    };
  }
  if (clean.startsWith("/admin/config")) {
    return {
      title: "Configuración",
      desc: "Parámetros del sistema y ajustes generales.",
    };
  }
  return {
    title: "Dashboard",
    desc: "Gestión central del sistema (centros, usuarios y control de acceso).",
  };
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const institucionSlug = extractInstitutionSlug(pathname);
  const [user] = useState<AuthUser | null>(() => readAuth().user);
  const [config, setConfig] = useState<ConfiguracionInstitucion | null>(null);

  const theme = themeFromBranding(config);

  useEffect(() => {
    async function loadConfig() {
      try {
        const payload = await api<ConfiguracionInstitucion>(
          "/api/admin/configuracion"
        );
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
    if (!isAdminRole(sessionUser.rol)) {
      router.replace(withInstitutionSlug(institucionSlug, "/centro"));
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

  const nav = [
    { label: "Dashboard", href: withInstitutionSlug(institucionSlug, "/admin"), icon: LayoutDashboard, exact: true },
    { label: "Centros", href: withInstitutionSlug(institucionSlug, "/admin/centros"), icon: Building2 },
    { label: "Usuarios", href: withInstitutionSlug(institucionSlug, "/admin/usuarios"), icon: Users },
    { label: "Configuración", href: withInstitutionSlug(institucionSlug, "/admin/config"), icon: Settings },
  ];

  const hdr = headerFor(pathname || withInstitutionSlug(institucionSlug, "/admin"));

  return (
    <main
      className="min-h-dvh bg-white"
      style={
        {
          "--brand-primary": theme.primary,
          "--brand-secondary": theme.secondary,
          "--brand-support": theme.support,
          "--brand-soft": theme.soft,
          "--brand-soft-strong": theme.softStrong,
          "--brand-support-soft": theme.supportSoft,
          "--brand-border": theme.border,
          "--brand-glow": theme.glow,
        } as CSSProperties
      }
    >
      <div className="mx-auto w-[90vw] max-w-none px-4 py-6 md:px-6">
        <div className="grid min-h-[calc(100dvh-3rem)] grid-cols-1 gap-6 md:grid-cols-[260px_1fr]">
          {/* Sidebar fijo */}
          <aside className="md:sticky md:top-6 md:h-[calc(100dvh-3rem)]">
            <div className="flex h-full flex-col rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="p-5">
                <div className="flex flex-col items-center gap-3 text-center">
                  {config?.logo_url ? (
                    <img
                      src={config.logo_url}
                      alt="Logo institucional"
                      className="h-28 w-auto max-w-[280px] shrink-0 object-contain"
                    />
                  ) : (
                    <div
                      className="grid h-11 w-11 place-items-center rounded-2xl"
                      style={{ backgroundColor: theme.soft }}
                    >
                      <ShieldCheck
                        className="h-5 w-5"
                        style={{ color: theme.primary }}
                      />
                    </div>
                  )}

                  <div className="leading-tight text-center">
                    <p
                      className="text-base font-extrabold tracking-tight break-words"
                      style={{ color: theme.primary }}
                    >
                      {config?.nombre_publico?.trim() || "Mujer Alerta"}
                    </p>
                    <p className="text-xs text-neutral-500">
                      Panel administrador
                    </p>
                  </div>
                </div>

                <Separator className="my-5" />

                <nav className="grid gap-2">
                  {nav.map((item) => {
                    const Icon = item.icon;
                    const active = item.exact
                      ? pathname === item.href
                      : pathname === item.href || pathname?.startsWith(`${item.href}/`);
                    return (
                      <button
                        key={item.href}
                        onClick={() => router.push(item.href)}
                        className="group flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-all duration-200 ease-out hover:-translate-y-[1px]"
                        style={
                          active
                            ? {
                                background: `linear-gradient(135deg, ${theme.softStrong} 0%, ${theme.supportSoft} 100%)`,
                                borderColor: theme.border,
                                color: theme.primary,
                                boxShadow: `0 10px 24px ${theme.soft}`,
                              }
                            : {
                                background:
                                  "linear-gradient(135deg, rgba(255,255,255,0.96) 0%, color-mix(in srgb, var(--brand-support, #EAD5F1) 18%, white) 100%)",
                                borderColor: "color-mix(in srgb, var(--brand-border, rgba(127,1,127,0.18)) 50%, transparent)",
                                color: "rgb(64 64 64)",
                                boxShadow: "0 0 0 rgba(0,0,0,0)",
                              }
                        }
                        onMouseEnter={(e) => {
                          if (active) return;
                          e.currentTarget.style.borderColor = theme.border;
                          e.currentTarget.style.color = theme.primary;
                          e.currentTarget.style.boxShadow = `0 12px 28px ${theme.soft}`;
                          e.currentTarget.style.background = `linear-gradient(135deg, ${theme.soft} 0%, ${theme.supportSoft} 100%)`;
                        }}
                        onMouseLeave={(e) => {
                          if (active) return;
                          e.currentTarget.style.borderColor =
                            "color-mix(in srgb, var(--brand-border, rgba(127,1,127,0.18)) 50%, transparent)";
                          e.currentTarget.style.color = "rgb(64 64 64)";
                          e.currentTarget.style.boxShadow = "0 0 0 rgba(0,0,0,0)";
                          e.currentTarget.style.background =
                            "linear-gradient(135deg, rgba(255,255,255,0.96) 0%, color-mix(in srgb, var(--brand-support, #EAD5F1) 18%, white) 100%)";
                        }}
                      >
                        <Icon
                          className="h-4 w-4 transition-all duration-200 ease-out group-hover:scale-110 group-hover:-translate-y-[1px]"
                          style={{
                            color: active ? theme.primary : "color-mix(in srgb, var(--brand-primary, #7F017F) 68%, #475569)",
                          }}
                        />
                        <span
                          className={`transition-all duration-200 ease-out group-hover:translate-x-[1px] ${
                            active ? "font-semibold" : "font-medium"
                          }`}
                        >
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </nav>

                <Separator className="my-5" />

                
              </div>

              <div className="mt-auto border-t border-neutral-200 p-4">
                <Button
                  onClick={onLogout}
                  variant="ghost"
                  className="group w-full justify-start rounded-xl border transition-all duration-200 ease-out hover:-translate-y-[1px]"
                  style={{
                    backgroundColor: theme.supportSoft,
                    borderColor: theme.support,
                    color: theme.primary,
                    boxShadow: "0 0 0 rgba(0,0,0,0)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `linear-gradient(135deg, ${theme.soft} 0%, ${theme.supportSoft} 100%)`;
                    e.currentTarget.style.borderColor = theme.border;
                    e.currentTarget.style.boxShadow = `0 12px 28px ${theme.soft}`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = theme.supportSoft;
                    e.currentTarget.style.borderColor = theme.support;
                    e.currentTarget.style.boxShadow = "0 0 0 rgba(0,0,0,0)";
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4 transition-transform duration-200 ease-out group-hover:-translate-y-[1px] group-hover:scale-110" />
                  Cerrar sesión
                </Button>
              </div>
            </div>
          </aside>

          {/* Main */}
          <section className="min-w-0">
            {/* Header fijo (compartido) */}
            <header
              className="sticky top-0 z-10 -mx-4 mb-6 px-4 py-4 backdrop-blur md:-mx-0 md:rounded-2xl md:border md:px-5 md:py-4 md:shadow-sm"
              style={{
                borderColor: theme.border,
                background: `linear-gradient(135deg, ${theme.soft} 0%, rgba(255,255,255,0.96) 48%, ${theme.supportSoft} 100%)`,
                boxShadow: `0 16px 42px ${theme.glow}`,
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h1
                    className="truncate text-xl font-extrabold tracking-tight md:text-2xl"
                    style={{ color: theme.primary }}
                  >
                    {hdr.title}
                  </h1>
                  <p className="mt-1 truncate text-sm text-neutral-600">
                    {hdr.desc}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
                    style={{
                      backgroundColor: theme.soft,
                      color: theme.primary,
                    }}
                    aria-label="Avatar"
                    title={user.nombre}
                  >
                    <span className="text-sm font-bold">
                      {initials(user.nombre)}
                    </span>
                  </div>

                  <div className="hidden text-right md:block">
                    <p className="text-sm font-semibold text-neutral-900">
                      {user.nombre}
                    </p>
                    <p className="text-xs text-neutral-500">{user.email}</p>
                  </div>

                </div>
              </div>
            </header>

            {/* contenido de cada page */}
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
