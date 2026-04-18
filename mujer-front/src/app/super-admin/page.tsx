"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Building2, CheckCircle2, Clock3, Power, XCircle } from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/lib/auth";
import { toast } from "sonner";

type Solicitud = {
  id: number;
  institucion_id?: number;
  institucion_nombre: string;
  tipo: string;
  nombre_contacto: string;
  cargo_contacto?: string;
  email_contacto: string;
  telefono_contacto?: string;
  estado?: string;
  ciudad?: string;
  sitio_web?: string;
  slug_deseado: string;
  estatus_solicitud: string;
  estatus_institucion?: string;
  institucion_activa?: boolean;
  created_at: string;
  updated_at: string;
};

const BRAND = "#7F017F";

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

export default function SuperAdminPage() {
  const router = useRouter();
  const [items, setItems] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [filter, setFilter] = useState("all");
  const [sessionChecked, setSessionChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);

  async function load(status: string) {
    setLoading(true);
    try {
      const path =
        status === "all"
          ? "/api/super-admin/registro-institucional"
          : `/api/super-admin/registro-institucional?estatus=${encodeURIComponent(status)}`;
      const data = await api<Solicitud[]>(path);
      setItems(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      toast.error(
        msg.includes("forbidden")
          ? "Tu sesión no tiene permisos de super admin."
          : msg
            ? `No se pudieron cargar las solicitudes: ${msg}`
            : "No se pudieron cargar las solicitudes."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const { user, token } = readAuth();
    if (!user || !token) {
      router.replace("/");
      return;
    }
    if (user.rol !== "super_admin") {
      setAllowed(false);
      setSessionChecked(true);
      setLoading(false);
      toast.error("Esta pantalla solo se puede usar con una cuenta super admin.");
      return;
    }
    setAllowed(true);
    setSessionChecked(true);
  }, [router]);

  useEffect(() => {
    if (!sessionChecked || !allowed) return;
    void load(filter);
  }, [allowed, filter, sessionChecked]);

  async function runAction(id: number, accion: "aprobar" | "rechazar" | "activar" | "desactivar") {
    setBusyId(id);
    try {
      const updated = await api<Solicitud>(`/api/super-admin/registro-institucional/${id}`, {
        method: "PUT",
        body: JSON.stringify({ accion }),
      });
      setItems((current) => current.map((item) => (item.id === id ? updated : item)));
      const successMessage =
        accion === "aprobar"
          ? "Solicitud aprobada y activada."
          : accion === "rechazar"
            ? "Solicitud rechazada."
            : accion === "activar"
              ? "Institución reactivada."
              : "Institución desactivada.";
      toast.success(successMessage);
    } catch {
      toast.error("No se pudo actualizar la solicitud.");
    } finally {
      setBusyId(null);
    }
  }

  const summary = useMemo(() => {
    return {
      pendientes: items.filter((item) => item.estatus_solicitud === "pendiente").length,
      aprobadas: items.filter((item) => item.estatus_solicitud === "aprobado").length,
      rechazadas: items.filter((item) => item.estatus_solicitud === "rechazado").length,
    };
  }, [items]);

  if (!sessionChecked || !allowed) return null;

  return (
    <div className="grid gap-6">
      <div className="rounded-[1.75rem] border border-white/80 bg-white/85 p-6 shadow-sm backdrop-blur">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-slate-500">
          Panel global
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight" style={{ color: BRAND }}>
          Validación de registros institucionales
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          Aquí revisas solicitudes nuevas, apruebas el alta del tenant y puedes activar o desactivar instituciones ya validadas.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/80 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Pendientes</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{summary.pendientes}</p>
        </div>
        <div className="rounded-3xl border border-white/80 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Aprobadas</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{summary.aprobadas}</p>
        </div>
        <div className="rounded-3xl border border-white/80 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Rechazadas</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{summary.rechazadas}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {["all", "pendiente", "aprobado", "rechazado"].map((value) => (
          <Button
            key={value}
            type="button"
            variant={filter === value ? "default" : "outline"}
            className="rounded-full font-semibold"
            style={filter === value ? { backgroundColor: BRAND } : undefined}
            onClick={() => setFilter(value)}
          >
            {value === "all" ? "Todas" : value}
          </Button>
        ))}
      </div>
      {loading ? (
        <div className="rounded-[1.75rem] border border-white/80 bg-white p-8 text-sm text-slate-600 shadow-sm">
          Cargando solicitudes...
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => {
            const isApproved = item.estatus_solicitud === "aprobado";
            const isBusy = busyId === item.id;
            return (
              <article key={item.id} className="rounded-[1.75rem] border border-white/80 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#f7ecfb] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#7F017F]">
                        {item.estatus_solicitud}
                      </span>
                      {item.estatus_institucion ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          Institución: {item.estatus_institucion}
                        </span>
                      ) : null}
                    </div>

                    <h2 className="mt-3 text-2xl font-black text-slate-950">{item.institucion_nombre}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Slug asignado: <span className="font-semibold text-slate-800">{item.slug_deseado}</span>
                    </p>

                    <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                      <p><strong>Contacto:</strong> {item.nombre_contacto}</p>
                      <p><strong>Correo:</strong> {item.email_contacto}</p>
                      <p><strong>Cargo:</strong> {item.cargo_contacto || "—"}</p>
                      <p><strong>Teléfono:</strong> {item.telefono_contacto || "—"}</p>
                      <p><strong>Ubicación:</strong> {[item.ciudad, item.estado].filter(Boolean).join(", ") || "—"}</p>
                      <p><strong>Tipo:</strong> {item.tipo}</p>
                      <p><strong>Creada:</strong> {new Date(item.created_at).toLocaleString()}</p>
                      <p><strong>Actualizada:</strong> {new Date(item.updated_at).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex min-w-[240px] flex-col gap-3">
                    <Button
                      type="button"
                      className="rounded-full font-semibold"
                      style={{ backgroundColor: BRAND }}
                      disabled={isBusy}
                      onClick={() => runAction(item.id, "aprobar")}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Aprobar y activar
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full font-semibold"
                      disabled={isBusy}
                      onClick={() => runAction(item.id, "rechazar")}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Rechazar
                    </Button>

                    {isApproved ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full font-semibold"
                        disabled={isBusy}
                        onClick={() => runAction(item.id, item.institucion_activa ? "desactivar" : "activar")}
                      >
                        {item.institucion_activa ? (
                          <>
                            <Power className="mr-2 h-4 w-4" />
                            Desactivar institución
                          </>
                        ) : (
                          <>
                            <Clock3 className="mr-2 h-4 w-4" />
                            Reactivar institución
                          </>
                        )}
                      </Button>
                    ) : null}

                    {item.institucion_id ? (
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
                        <Building2 className="mb-2 h-4 w-4 text-slate-400" />
                        Institución vinculada: #{item.institucion_id}
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}

          {!items.length ? (
            <div className="rounded-[1.75rem] border border-white/80 bg-white p-8 text-sm text-slate-500 shadow-sm">
              No hay solicitudes para este filtro.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
