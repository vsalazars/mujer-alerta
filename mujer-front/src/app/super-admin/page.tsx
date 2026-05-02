"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Building2, CheckCircle2, Clock3, Pencil, Power, XCircle } from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserRole } from "@/lib/auth";
import { toast } from "sonner";

type Solicitud = {
  id: number;
  institucion_id?: number;
  origen?: string;
  solo_lectura?: boolean;
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

type EditForm = {
  institucion_nombre: string;
  tipo: string;
  nombre_contacto: string;
  cargo_contacto: string;
  email_contacto: string;
  telefono_contacto: string;
  estado: string;
  ciudad: string;
  sitio_web: string;
  slug_deseado: string;
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
  const [editingItem, setEditingItem] = useState<Solicitud | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    institucion_nombre: "",
    tipo: "institucion",
    nombre_contacto: "",
    cargo_contacto: "",
    email_contacto: "",
    telefono_contacto: "",
    estado: "",
    ciudad: "",
    sitio_web: "",
    slug_deseado: "",
  });

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

  function openEdit(item: Solicitud) {
    setEditingItem(item);
    setEditForm({
      institucion_nombre: item.institucion_nombre || "",
      tipo: item.tipo || "institucion",
      nombre_contacto: item.nombre_contacto || "",
      cargo_contacto: item.cargo_contacto || "",
      email_contacto: item.email_contacto || "",
      telefono_contacto: item.telefono_contacto || "",
      estado: item.estado || "",
      ciudad: item.ciudad || "",
      sitio_web: item.sitio_web || "",
      slug_deseado: item.slug_deseado || "",
    });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem) return;
    setEditLoading(true);
    try {
      const isExistingInstitution = editingItem.origen === "institucion" || editingItem.solo_lectura;
      const path = isExistingInstitution
        ? `/api/super-admin/instituciones/${editingItem.institucion_id}`
        : `/api/super-admin/registro-institucional/${editingItem.id}`;
      const updated = await api<Solicitud>(path, {
        method: "PATCH",
        body: JSON.stringify(editForm),
      });
      setItems((current) => current.map((item) => (item.id === editingItem.id ? updated : item)));
      setEditingItem(null);
      toast.success("Información actualizada.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("slug_exists")) toast.error("El slug ya está en uso.");
      else if (msg.includes("bad_email")) toast.error("El correo no es válido.");
      else if (msg.includes("missing_required_fields")) toast.error("Completa los campos obligatorios.");
      else if (msg.includes("method_not_allowed")) toast.error("El backend aún no permite esta edición. Reinicia el servidor.");
      else if (msg.includes("Failed to fetch")) toast.error("La edición fue bloqueada por conexión o CORS. Reinicia el backend y vuelve a intentar.");
      else toast.error("No se pudo guardar la información.");
    } finally {
      setEditLoading(false);
    }
  }

  const summary = useMemo(() => {
    return {
      pendientes: items.filter((item) => item.estatus_solicitud === "pendiente").length,
      aprobadas: items.filter((item) => item.estatus_solicitud === "aprobado").length,
      rechazadas: items.filter((item) => item.estatus_solicitud === "rechazado").length,
    };
  }, [items]);

  const editingExistingInstitution = editingItem?.origen === "institucion" || editingItem?.solo_lectura;

  if (!sessionChecked || !allowed) return null;

  return (
    <div className="grid gap-6">
      <Dialog open={Boolean(editingItem)} onOpenChange={(open) => (!open ? setEditingItem(null) : null)}>
        <DialogContent className="max-w-2xl rounded-[1.75rem]">
          <DialogHeader>
            <DialogTitle style={{ color: BRAND }}>
              {editingExistingInstitution ? "Editar institución" : "Editar solicitud"}
            </DialogTitle>
            <DialogDescription>
              {editingExistingInstitution
                ? "Modifica los datos base de la institución ya registrada en el sistema."
                : "Ajusta la información antes de aprobar o para corregir una solicitud ya vinculada."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={saveEdit} className="grid gap-4">
            {editingExistingInstitution ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                En esta vista solo se editan campos que existen en la tabla de instituciones. Los datos de contacto extendidos
                como cargo o sitio web requieren una solicitud vinculada.
              </div>
            ) : null}
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="institucion_nombre">Institución</Label>
                <Input
                  id="institucion_nombre"
                  value={editForm.institucion_nombre}
                  onChange={(e) => setEditForm((current) => ({ ...current, institucion_nombre: e.target.value }))}
                  disabled={editLoading}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tipo">Tipo</Label>
                <Select
                  value={editForm.tipo}
                  onValueChange={(value) => setEditForm((current) => ({ ...current, tipo: value }))}
                  disabled={editLoading}
                >
                  <SelectTrigger id="tipo" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="institucion">Institución</SelectItem>
                    <SelectItem value="universidad">Universidad</SelectItem>
                    <SelectItem value="empresa">Empresa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="slug_deseado">Slug</Label>
                <Input
                  id="slug_deseado"
                  value={editForm.slug_deseado}
                  onChange={(e) => setEditForm((current) => ({ ...current, slug_deseado: e.target.value }))}
                  disabled={editLoading}
                />
              </div>

              {!editingExistingInstitution ? (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="nombre_contacto">Contacto</Label>
                    <Input
                      id="nombre_contacto"
                      value={editForm.nombre_contacto}
                      onChange={(e) => setEditForm((current) => ({ ...current, nombre_contacto: e.target.value }))}
                      disabled={editLoading}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="cargo_contacto">Cargo</Label>
                    <Input
                      id="cargo_contacto"
                      value={editForm.cargo_contacto}
                      onChange={(e) => setEditForm((current) => ({ ...current, cargo_contacto: e.target.value }))}
                      disabled={editLoading}
                    />
                  </div>
                </>
              ) : null}

              <div className="grid gap-2">
                <Label htmlFor="email_contacto">Correo</Label>
                <Input
                  id="email_contacto"
                  type="email"
                  value={editForm.email_contacto}
                  onChange={(e) => setEditForm((current) => ({ ...current, email_contacto: e.target.value }))}
                  disabled={editLoading}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="telefono_contacto">Teléfono</Label>
                <Input
                  id="telefono_contacto"
                  value={editForm.telefono_contacto}
                  onChange={(e) => setEditForm((current) => ({ ...current, telefono_contacto: e.target.value }))}
                  disabled={editLoading}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="estado">Estado</Label>
                <Input
                  id="estado"
                  value={editForm.estado}
                  onChange={(e) => setEditForm((current) => ({ ...current, estado: e.target.value }))}
                  disabled={editLoading}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="ciudad">Ciudad</Label>
                <Input
                  id="ciudad"
                  value={editForm.ciudad}
                  onChange={(e) => setEditForm((current) => ({ ...current, ciudad: e.target.value }))}
                  disabled={editLoading}
                />
              </div>

              {!editingExistingInstitution ? (
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="sitio_web">Sitio web</Label>
                  <Input
                    id="sitio_web"
                    value={editForm.sitio_web}
                    onChange={(e) => setEditForm((current) => ({ ...current, sitio_web: e.target.value }))}
                    disabled={editLoading}
                  />
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setEditingItem(null)} disabled={editLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={editLoading} style={{ backgroundColor: BRAND }}>
                {editLoading ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
            const isReadOnlyInstitution = item.origen === "institucion" || item.solo_lectura;
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
                      {isReadOnlyInstitution ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          Institución existente
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
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full font-semibold"
                        disabled={isBusy}
                        onClick={() => openEdit(item)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar información
                      </Button>
                      <>
                        {!isReadOnlyInstitution ? (
                          <>
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
                          </>
                        ) : (
                          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
                            <Building2 className="mb-2 h-4 w-4 text-slate-400" />
                            Puedes editar esta institución desde aquí. Los campos avanzados de contacto no existen en su registro actual.
                          </div>
                        )}
                      </>
                    </>

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
