"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { LogOut, ShieldCheck } from "lucide-react";

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
    if (user.rol !== "centro") {
      // si es admin, mándalo a admin
      router.replace("/admin");
      return;
    }
    setUser(user);
  }, [router]);

  function onLogout() {
    clearAuth();
    router.replace("/");
  }

  if (!user) return null;

  return (
    <main className="min-h-dvh bg-white">
      {/* Header fijo */}
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto w-[90vw] max-w-none px-4 py-4 md:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div
                  className="grid h-10 w-10 place-items-center rounded-2xl"
                  style={{ backgroundColor: "rgba(127,1,127,0.10)" }}
                >
                  <ShieldCheck className="h-5 w-5" style={{ color: "#7F017F" }} />
                </div>

                <div className="leading-tight">
                  <p className="text-base font-extrabold tracking-tight" style={{ color: "#7F017F" }}>
                    Mujer Alerta
                  </p>
                  <p className="text-xs text-neutral-500">Panel de resultados</p>
                </div>
              </div>

           
            </div>

            <div className="flex items-center gap-3">
              <div
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
                style={{ backgroundColor: "rgba(127,1,127,0.10)", color: "#7F017F" }}
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
