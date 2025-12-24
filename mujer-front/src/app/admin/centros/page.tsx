"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

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

type AuthUser = {
  user_id: string;
  email: string;
  nombre: string;
  rol: "admin" | "centro";
  centros: number[];
  expires_at: number;
};

type Centro = {
  id: number;
  tipo: "escolar" | "laboral";
  nombre: string;
  clave?: string;
  ciudad?: string;
  estado?: string;
  activo?: boolean;
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

export default function AdminCentrosPage() {
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState("");

  const [items, setItems] = useState<Centro[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

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

  // Guard (extra): si no hay auth, regresa a home
  useEffect(() => {
    const { user, token } = readAuth();
    if (!user || !token) {
      router.replace("/");
      return;
    }
    if (user.rol !== "admin") {
      router.replace("/centro");
      return;
    }
    setUser(user);
    setToken(token);
  }, [router]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((c) => {
      const hay = `${c.nombre} ${c.tipo} ${c.clave || ""} ${c.ciudad || ""} ${
        c.estado || ""
      }`.toLowerCase();
      return hay.includes(s);
    });
  }, [items, q]);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      // Lista pública: solo activos (por ahora)
      const data = await api<Centro[]>("/api/centros");
      setItems(data || []);
    } catch (e: any) {
      setErr(e?.message || "No se pudo cargar centros");
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
    setErr("");

    const nombre = form.nombre.trim();
    if (nombre.length < 3) {
      setErr("El nombre debe tener al menos 3 caracteres.");
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
    } catch (e: any) {
      setErr(e?.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(c: Centro) {
    const ok = confirm(`¿Eliminar (desactivar) el centro "${c.nombre}"?`);
    if (!ok) return;

    setErr("");
    try {
      await api<void>(`/api/centros/${c.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await load();
    } catch (e: any) {
      setErr(e?.message || "No se pudo eliminar");
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
            style={{ borderColor: "#7F017F", color: "#7F017F" }}
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
                style={{ backgroundColor: "#7F017F" }}
                onClick={openCreate}
              >
                <Plus className="mr-2 h-5 w-5" />
                Nuevo centro
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle style={{ color: "#7F017F" }}>
                  {mode === "create" ? "Nuevo centro" : "Editar centro"}
                </DialogTitle>
                <DialogDescription className="text-sm text-neutral-600">
                  Captura la información básica del centro.
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
                          ? { borderColor: "#7F017F" }
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
                          ? { borderColor: "#7F017F" }
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
                    value={form.nombre}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, nombre: e.target.value }))
                    }
                    placeholder="Ej. IPN UPIITA"
                    disabled={saving}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="clave">Clave</Label>
                    <Input
                      id="clave"
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
                    value={form.estado}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, estado: e.target.value }))
                    }
                    placeholder="Ej. CDMX"
                    disabled={saving}
                  />
                </div>

                {err ? <p className="text-sm text-red-600">{err}</p> : null}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setOpen(false)}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>

                  <Button
                    type="submit"
                    className="rounded-full font-semibold shadow-sm"
                    style={{ backgroundColor: "#7F017F" }}
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
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" style={{ color: "#7F017F" }} />
              <h2 className="text-lg font-bold text-neutral-900">Listado</h2>
            </div>
            <p className="mt-1 text-sm text-neutral-600">
              Centros activos (la lista pública del diagnóstico).
            </p>
          </div>
        </div>

        <Separator />

        {err ? (
          <div className="p-5">
            <p className="text-sm text-red-600">{err}</p>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">Nombre</th>
                <th className="px-5 py-3 text-left font-semibold">Tipo</th>
                <th className="px-5 py-3 text-left font-semibold">Clave</th>
                <th className="px-5 py-3 text-left font-semibold">Ciudad</th>
                <th className="px-5 py-3 text-left font-semibold">Estado</th>
                <th className="px-5 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td className="px-5 py-6 text-neutral-500" colSpan={6}>
                    Cargando…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-5 py-6 text-neutral-500" colSpan={6}>
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
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                        style={{
                          backgroundColor: "rgba(127,1,127,0.10)",
                          color: "#7F017F",
                        }}
                      >
                        {c.tipo}
                      </span>
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
                          style={{ borderColor: "#7F017F", color: "#7F017F" }}
                          onClick={() => openEdit(c)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </Button>

                        <Button
                          variant="outline"
                          className="h-9 rounded-full"
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
          <p className="text-xs text-neutral-500">
            Siguiente: lista admin incluyendo inactivos + restaurar.
          </p>
        </div>
      </div>
    </div>
  );
}
