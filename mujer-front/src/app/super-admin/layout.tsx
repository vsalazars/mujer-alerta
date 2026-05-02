"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ShieldCheck, LogOut, ClipboardList } from "lucide-react";
import type { UserRole } from "@/lib/auth";

type AuthUser = {
  user_id: string;
  email: string;
  nombre: string;
  rol: UserRole;
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
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "S";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (a + b).toUpperCase();
}

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const { user: authUser, token } = readAuth();
    if (!authUser || !token) {
      setUser(null);
      setSessionChecked(true);
      router.replace("/");
      return;
    }
    setUser(authUser);
    setSessionChecked(true);
  }, [router]);

  useEffect(() => {
    if (!sessionChecked) return;
    if (!user) {
      router.replace("/");
      return;
    }
    if (user.rol !== "super_admin") {
      router.replace("/");
    }
  }, [router, sessionChecked, user]);

  function onLogout() {
    clearAuth();
    router.replace("/");
  }

  if (!sessionChecked || !user) return null;

  return (
    <main className="min-h-dvh bg-[#f7f4ef] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="grid gap-6 md:grid-cols-[260px_1fr]">
          <aside className="md:sticky md:top-6 md:h-[calc(100dvh-3rem)]">
            <div className="flex h-full flex-col rounded-[1.75rem] border border-white/80 bg-white/85 p-5 shadow-sm backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#faf5ff]">
                  <ShieldCheck className="h-5 w-5 text-[#7F017F]" />
                </div>
                <div>
                  <p className="text-base font-black" style={{ color: "#7F017F" }}>
                    Super Admin
                  </p>
                  <p className="text-xs text-slate-500">Validación global</p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-[#efe7fb] text-[#7F017F]">
                    <span className="text-sm font-bold">{initials(user.nombre)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{user.nombre}</p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => router.push("/super-admin")}
                className={`mt-6 flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                  pathname === "/super-admin"
                    ? "bg-[#f7ecfb] text-[#7F017F]"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <ClipboardList className="h-4 w-4" />
                Solicitudes
              </button>

              <div className="mt-auto">
                <Button onClick={onLogout} variant="outline" className="w-full rounded-full font-semibold">
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar sesión
                </Button>
              </div>
            </div>
          </aside>

          <section>{children}</section>
        </div>
      </div>
    </main>
  );
}
