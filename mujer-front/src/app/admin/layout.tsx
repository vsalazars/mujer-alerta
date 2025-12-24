"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

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
  rol: "admin" | "centro";
  centros: number[];
  expires_at: number;
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

function cx(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

function headerFor(pathname: string) {
  if (pathname.startsWith("/admin/centros")) {
    return {
      title: "Centros",
      desc: "Alta, edición y desactivación de centros.",
    };
  }
  if (pathname.startsWith("/admin/usuarios")) {
    return {
      title: "Usuarios",
      desc: "Gestión de usuarios, roles y asignación a centros.",
    };
  }
  if (pathname.startsWith("/admin/config")) {
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

  const [user, setUser] = useState<AuthUser | null>(null);

  const expiresText = useMemo(() => {
    if (!user?.expires_at) return "";
    const d = new Date(user.expires_at * 1000);
    return d.toLocaleString();
  }, [user?.expires_at]);

  useEffect(() => {
    const { user } = readAuth();
    if (!user) {
      router.replace("/");
      return;
    }
    if (user.rol !== "admin") {
      router.replace("/centro");
      return;
    }
    setUser(user);
  }, [router]);

  function onLogout() {
    clearAuth();
    router.replace("/");
  }

  if (!user) return null;

  const nav = [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "Centros", href: "/admin/centros", icon: Building2 },
    { label: "Usuarios", href: "/admin/usuarios", icon: Users },
    { label: "Configuración", href: "/admin/config", icon: Settings },
  ];

  const hdr = headerFor(pathname || "/admin");

  return (
    <main className="min-h-dvh bg-white">
      <div className="mx-auto w-[90vw] max-w-none px-4 py-6 md:px-6">
        <div className="grid min-h-[calc(100dvh-3rem)] grid-cols-1 gap-6 md:grid-cols-[260px_1fr]">
          {/* Sidebar fijo */}
          <aside className="md:sticky md:top-6 md:h-[calc(100dvh-3rem)]">
            <div className="flex h-full flex-col rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="p-5">
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-11 w-11 place-items-center rounded-2xl"
                    style={{ backgroundColor: "rgba(127,1,127,0.10)" }}
                  >
                    <ShieldCheck
                      className="h-5 w-5"
                      style={{ color: "#7F017F" }}
                    />
                  </div>

                  <div className="leading-tight">
                    <p
                      className="text-base font-extrabold tracking-tight"
                      style={{ color: "#7F017F" }}
                    >
                      Mujer Alerta
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
                    const active =
                      pathname === item.href ||
                      (item.href !== "/admin" &&
                        pathname?.startsWith(item.href));
                    return (
                      <button
                        key={item.href}
                        onClick={() => router.push(item.href)}
                        className={cx(
                          "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition",
                          active
                            ? "bg-neutral-100 text-neutral-900"
                            : "text-neutral-700 hover:bg-neutral-50"
                        )}
                      >
                        <Icon
                          className={cx(
                            "h-4 w-4",
                            active ? "" : "text-neutral-500"
                          )}
                          style={active ? { color: "#7F017F" } : undefined}
                        />
                        <span
                          className={cx(
                            active ? "font-semibold" : "font-medium"
                          )}
                        >
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </nav>

                <Separator className="my-5" />

                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="text-xs text-neutral-600">
                    Token expira:{" "}
                    <span className="font-semibold text-neutral-900">
                      {expiresText || "—"}
                    </span>
                  </p>
                </div>
              </div>

              <div className="mt-auto border-t border-neutral-200 p-4">
                <Button
                  onClick={onLogout}
                  variant="ghost"
                  className="w-full justify-start rounded-xl"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar sesión
                </Button>
              </div>
            </div>
          </aside>

          {/* Main */}
          <section className="min-w-0">
            {/* Header fijo (compartido) */}
            <header className="sticky top-0 z-10 -mx-4 mb-6 bg-white/90 px-4 py-4 backdrop-blur md:-mx-0 md:rounded-2xl md:border md:border-neutral-200 md:px-5 md:py-4 md:shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-extrabold tracking-tight text-neutral-900 md:text-2xl">
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
                      backgroundColor: "rgba(127,1,127,0.10)",
                      color: "#7F017F",
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

                  <span
                    className="hidden rounded-full px-3 py-1 text-xs font-semibold md:inline-flex"
                    style={{
                      backgroundColor: "rgba(127,1,127,0.10)",
                      color: "#7F017F",
                    }}
                  >
                    {user.rol.toUpperCase()}
                  </span>
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
