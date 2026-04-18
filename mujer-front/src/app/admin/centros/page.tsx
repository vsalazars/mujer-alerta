"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isAdminRole, type UserRole } from "@/lib/auth";
import { themeFromBranding } from "@/lib/branding";
import { extractInstitutionSlug, withInstitutionSlug } from "@/lib/routing";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";

import { Building2, Plus, RefreshCw, Search, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

type AuthUser = {
  user_id: string;
  email: string;
  nombre: string;
  rol: UserRole;
  centros: number[];
  expires_at: number;
};

type Centro = {
  id: number;
  tipo: "escolar" | "laboral";
  nombre: string;
  slug: string;
  clave?: string;
  ciudad?: string;
  estado?: string;
  activo?: boolean;
};

type ConfiguracionInstitucion = {
  institucion_id: number;
  nombre_publico?: string;
  logo_url?: string;
  color_primario?: string;
  color_secundario?: string;
  color_apoyo?: string;
};

type CentroForm = {
  tipo: "escolar" | "laboral";
  nombre: string;
  clave: string;
  ciudad: string;
  estado: string;
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

function cx(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

function errorMessage(e: unknown, fallback: string) {
  return e instanceof Error ? e.message || fallback : fallback;
}

const destructiveButtonStyle = {
  borderColor: "rgba(220, 38, 38, 0.2)",
  backgroundColor: "rgba(254, 242, 242, 1)",
  color: "rgb(185, 28, 28)",
};

function slugifyCentroNombre(nombre: string) {
  return String(nombre || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "centro";
}

export default function AdminCentrosPage() {
  const router = useRouter();
  const pathname = usePathname();
  const institucionSlug = extractInstitutionSlug(pathname);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState("");
  const [config, setConfig] = useState<ConfiguracionInstitucion | null>(null);

  const [items, setItems] = useState<Centro[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CentroForm>({
    tipo: "escolar",
    nombre: "",
    clave: "",
    ciudad: "",
    estado: "",
  });
  const theme = themeFromBranding(config);
  const fieldStyle = {
    "--ring": theme.primary,
    "--input": theme.border,
  } as CSSProperties;
  const buttonRingStyle = {
    "--ring": theme.primary,
  } as CSSProperties;

  // Guard (extra): si no hay auth, regresa a home
  useEffect(() => {
    const { user, token } = readAuth();
    if (!user || !token) {
      router.replace(withInstitutionSlug(institucionSlug, "/"));
      return;
    }
    if (!isAdminRole(user.rol)) {
      router.replace(withInstitutionSlug(institucionSlug, "/centro"));
      return;
    }
    setUser(user);
    setToken(token);
  }, [institucionSlug, router]);

  useEffect(() => {
    async function loadConfig() {
      try {
        const payload = await api<ConfiguracionInstitucion>("/api/admin/configuracion", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setConfig(payload);
      } catch {
        setConfig(null);
      }
    }

    if (!token) return;
    void loadConfig();
  }, [token]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((c) => {
      const hay = `${c.nombre} ${c.slug || ""} ${c.tipo} ${c.clave || ""} ${c.ciudad || ""} ${
        c.estado || ""
      }`.toLowerCase();
      return hay.includes(s);
    });
  }, [items, q]);

  const suggestedSlug = useMemo(() => slugifyCentroNombre(form.nombre), [form.nombre]);

  async function load() {
    setLoading(true);
    try {
      const data = await api<Centro[]>("/api/admin/centros", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems(data || []);
    } catch (e: unknown) {
      toast.error(errorMessage(e, "No se pudo cargar centros"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function openCreate() {
    setMode("create");
    setEditingId(null);
    setForm({
      tipo: "escolar",
      nombre: "",
      clave: "",
      ciudad: "",
      estado: "",
    });
    setOpen(true);
  }

  function openEdit(c: Centro) {
    setMode("edit");
    setEditingId(c.id);
    setForm({
      tipo: c.tipo,
      nombre: c.nombre || "",
      clave: c.clave || "",
      ciudad: c.ciudad || "",
      estado: c.estado || "",
    });
    setOpen(true);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();

    const nombre = form.nombre.trim();
    if (nombre.length < 3) {
      toast.error("El nombre debe tener al menos 3 caracteres.");
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        await api<Centro>("/api/centros", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            tipo: form.tipo,
            nombre: nombre,
            clave: form.clave.trim(),
            ciudad: form.ciudad.trim(),
            estado: form.estado.trim(),
          }),
        });
      } else {
        await api<Centro>(`/api/centros/${editingId}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            tipo: form.tipo,
            nombre: nombre,
            clave: form.clave.trim(),
            ciudad: form.ciudad.trim(),
            estado: form.estado.trim(),
          }),
        });
      }

      setOpen(false);
      await load();
      toast.success(mode === "create" ? "Centro creado correctamente." : "Centro actualizado correctamente.");
    } catch (e: unknown) {
      toast.error(errorMessage(e, "No se pudo guardar"));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(c: Centro) {
    const ok = confirm(`¿Eliminar permanentemente el centro "${c.nombre}"? Esta acción solo se permite si no tiene usuarios ni encuestas asociadas.`);
    if (!ok) return;

    try {
      await api<void>(`/api/centros/${c.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await load();
      toast.success("Centro eliminado correctamente.");
    } catch (e: unknown) {
      const msg = errorMessage(e, "No se pudo eliminar");
      if (msg.includes("centro_has_data")) {
        toast.error("No se puede eliminar este centro porque ya tiene usuarios o encuestas asociadas.");
        return;
      }
      toast.error(msg);
    }
  }

  if (!user) return null;

  return (
    <div className="grid gap-6">
      {/* Acciones superiores (ya no hay header aquí; lo pone el layout) */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            style={{
              ...fieldStyle,
              borderColor: theme.border,
              boxShadow: `0 0 0 1px ${theme.border}`,
            }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, clave, ciudad..."
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-full"
            style={{
              ...buttonRingStyle,
              borderColor: theme.support,
              color: theme.primary,
              backgroundColor: theme.supportSoft,
            }}
            onClick={load}
            disabled={loading}
          >
            <RefreshCw className={cx("mr-2 h-4 w-4", loading && "animate-spin")} />
            Recargar
          </Button>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                className="rounded-full font-semibold shadow-sm"
                style={{ ...buttonRingStyle, background: theme.gradient, color: "white" }}
                onClick={openCreate}
              >
                <Plus className="mr-2 h-5 w-5" />
                Nuevo centro
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle style={{ color: theme.primary }}>
                  {mode === "create" ? "Nuevo centro" : "Editar centro"}
                </DialogTitle>
                <DialogDescription className="text-sm text-neutral-600">
                  Captura la información básica del centro. El slug se genera automáticamente a partir del nombre.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={onSave} className="mt-2 grid gap-4">
                <div className="grid gap-2">
                  <Label>Tipo</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className={cx(
                        "h-11 rounded-xl border px-3 text-sm font-semibold transition",
                        form.tipo === "escolar"
                          ? "bg-neutral-100 text-neutral-900"
                          : "bg-white text-neutral-700 hover:bg-neutral-50"
                      )}
                      style={
                        form.tipo === "escolar"
                          ? {
                              borderColor: theme.primary,
                              backgroundColor: theme.soft,
                              color: theme.primary,
                            }
                          : { borderColor: "rgb(229 229 229)" }
                      }
                      onClick={() => setForm((f) => ({ ...f, tipo: "escolar" }))}
                    >
                      Escolar
                    </button>

                    <button
                      type="button"
                      className={cx(
                        "h-11 rounded-xl border px-3 text-sm font-semibold transition",
                        form.tipo === "laboral"
                          ? "bg-neutral-100 text-neutral-900"
                          : "bg-white text-neutral-700 hover:bg-neutral-50"
                      )}
                      style={
                        form.tipo === "laboral"
                          ? {
                              borderColor: theme.primary,
                              backgroundColor: theme.soft,
                              color: theme.primary,
                            }
                          : { borderColor: "rgb(229 229 229)" }
                      }
                      onClick={() => setForm((f) => ({ ...f, tipo: "laboral" }))}
                    >
                      Laboral
                    </button>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input
                    id="nombre"
                    style={fieldStyle}
                    value={form.nombre}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, nombre: e.target.value }))
                    }
                    placeholder="Ej. IPN UPIITA"
                    disabled={saving}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="slug-sugerido">Slug sugerido</Label>
                  <Input
                    id="slug-sugerido"
                    style={fieldStyle}
                    value={suggestedSlug}
                    readOnly
                    disabled
                  />
                  <p className="text-xs text-neutral-500">
                    Se ajusta automáticamente si ya existe otro centro con el mismo slug dentro de la institución.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="clave">Clave</Label>
                    <Input
                      id="clave"
                      style={fieldStyle}
                      value={form.clave}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, clave: e.target.value }))
                      }
                      placeholder="Ej. UPIITA"
                      disabled={saving}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="ciudad">Ciudad</Label>
                    <Input
                      id="ciudad"
                      style={fieldStyle}
                      value={form.ciudad}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, ciudad: e.target.value }))
                      }
                      placeholder="Ej. CDMX"
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="estado">Estado</Label>
                  <Input
                    id="estado"
                    style={fieldStyle}
                    value={form.estado}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, estado: e.target.value }))
                    }
                    placeholder="Ej. CDMX"
                    disabled={saving}
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    style={{
                      ...buttonRingStyle,
                      borderColor: theme.support,
                      backgroundColor: theme.supportSoft,
                      color: theme.primary,
                    }}
                    onClick={() => setOpen(false)}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>

                  <Button
                    type="submit"
                    className="rounded-full font-semibold shadow-sm"
                    style={{ ...buttonRingStyle, background: theme.gradient, color: "white" }}
                    disabled={saving}
                  >
                    {saving ? "Guardando…" : "Guardar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Body */}
      <div
        className="rounded-2xl border bg-white shadow-sm"
        style={{ borderColor: theme.border }}
      >
        <div className="flex items-center justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" style={{ color: theme.primary }} />
              <h2 className="text-lg font-bold text-neutral-900">Listado</h2>
            </div>
            <p className="mt-1 text-sm text-neutral-600">
              Centros activos (la lista pública del diagnóstico).
            </p>
          </div>
        </div>

        <Separator />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">Nombre</th>
                <th className="px-5 py-3 text-left font-semibold">Tipo</th>
                <th className="px-5 py-3 text-left font-semibold">Slug</th>
                <th className="px-5 py-3 text-left font-semibold">Clave</th>
                <th className="px-5 py-3 text-left font-semibold">Ciudad</th>
                <th className="px-5 py-3 text-left font-semibold">Estado</th>
                <th className="px-5 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td className="px-5 py-6 text-neutral-500" colSpan={7}>
                    Cargando…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-5 py-6 text-neutral-500" colSpan={7}>
                    Sin centros.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="border-t border-neutral-100">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-neutral-900">
                        {c.nombre}
                      </div>
                      <div className="text-xs text-neutral-500">ID: {c.id}</div>
                      <div className="text-xs text-neutral-500">Slug: {c.slug}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                        style={{
                          backgroundColor: theme.supportSoft,
                          color: theme.primary,
                        }}
                      >
                        {c.tipo}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-neutral-700">
                      {c.slug}
                    </td>
                    <td className="px-5 py-4 text-neutral-700">
                      {c.clave || "—"}
                    </td>
                    <td className="px-5 py-4 text-neutral-700">
                      {c.ciudad || "—"}
                    </td>
                    <td className="px-5 py-4 text-neutral-700">
                      {c.estado || "—"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          className="h-9 rounded-full"
                          style={{
                            ...buttonRingStyle,
                            borderColor: theme.support,
                            color: theme.primary,
                            backgroundColor: theme.supportSoft,
                          }}
                          onClick={() => openEdit(c)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </Button>

                        <Button
                          variant="outline"
                          className="h-9 rounded-full"
                          style={{ ...buttonRingStyle, ...destructiveButtonStyle }}
                          onClick={() => onDelete(c)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Separator />

        <div className="flex items-center justify-between px-5 py-4">
          <p className="text-xs text-neutral-500">
            Total: <span className="font-semibold">{filtered.length}</span>
          </p>
         
        </div>
      </div>
    </div>
  );
}
