"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

import { Building2, Users } from "lucide-react";

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

export default function AdminPage() {
  const router = useRouter();

  // Nota: el guard de auth/admin ya vive en /admin/layout.tsx
  const { user } = useMemo(() => readAuth(), []);

  const expiresText = useMemo(() => {
    if (!user?.expires_at) return "";
    const d = new Date(user.expires_at * 1000);
    return d.toLocaleString();
  }, [user?.expires_at]);

  return (
    <div className="grid gap-6">
      {/* Quick cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-neutral-900">Sesión</p>
          <p className="mt-2 text-sm text-neutral-600">
            Token expira:{" "}
            <span className="font-semibold">{expiresText || "—"}</span>
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-neutral-900">Centros</p>
          <p className="mt-2 text-sm text-neutral-600">
            Administra catálogo y configuración por institución.
          </p>
          <Button
            className="mt-4 w-full rounded-full font-semibold shadow-sm"
            style={{ backgroundColor: "#7F017F" }}
            onClick={() => router.push("/admin/centros")}
          >
            <Building2 className="mr-2 h-5 w-5" />
            Ir a centros
          </Button>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-neutral-900">Usuarios</p>
          <p className="mt-2 text-sm text-neutral-600">
            Crea usuarios, roles y asignación a centros.
          </p>
          <Button
            variant="outline"
            className="mt-4 w-full rounded-full font-semibold"
            style={{ borderColor: "#7F017F", color: "#7F017F" }}
            onClick={() => router.push("/admin/usuarios")}
          >
            <Users className="mr-2 h-5 w-5" />
            Ir a usuarios
          </Button>
        </div>
      </div>

      {/* Placeholder */}
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-5">
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
