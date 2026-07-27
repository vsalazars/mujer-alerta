"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isAdminRole, type UserRole } from "@/lib/auth";
import { cacheBranding, readCachedBranding, themeFromBranding } from "@/lib/branding";
import { extractInstitutionSlug, withInstitutionSlug } from "@/lib/routing";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Building2, Plus, RefreshCw, Search, Trash2, Pencil, Users } from "lucide-react";

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

type CentroUser = {
  id: string;
  email: string;
  nombre: string;
  rol: "centro";
  centros: number[];
  centro_nombre?: string;
  activo: boolean;
  created_at?: string;
  generated_password?: string;
};

type UserForm = {
  nombre: string;
  email: string;
  centro_id: string; // select -> string
  password: string; // opcional; si vacío, back puede generar
};

type SaveUserPayload = {
  nombre: string;
  email: string;
  centro_id: number;
  password?: string;
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

export default function AdminUsuariosPage() {
  const router = useRouter();
  const pathname = usePathname();
  const institucionSlug = extractInstitutionSlug(pathname);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState("");
  const [config, setConfig] = useState<ConfiguracionInstitucion | null>(() =>
    readCachedBranding<ConfiguracionInstitucion>(institucionSlug)
  );

  const [centros, setCentros] = useState<Centro[]>([]);
  const [items, setItems] = useState<CentroUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<UserForm>({
    nombre: "",
    email: "",
    centro_id: "",
    password: "",
  });
  const theme = themeFromBranding(config);
  const fieldStyle = {
    "--ring": theme.primary,
    "--input": theme.border,
    "--primary": theme.primary,
    "--primary-foreground": "#FFFFFF",
    accentColor: theme.primary,
    caretColor: theme.primary,
  } as CSSProperties;
  const buttonRingStyle = {
    "--ring": theme.primary,
  } as CSSProperties;
  const selectContentStyle = {
    "--accent": theme.supportSoft,
    "--accent-foreground": theme.primary,
    "--ring": theme.primary,
    "--border": theme.border,
  } as CSSProperties;
  const dialogContentStyle = {
    borderColor: theme.border,
    background:
      mode === "edit"
        ? `linear-gradient(180deg, rgba(255,255,255,0.98) 0%, ${theme.supportSoft} 100%)`
        : "rgba(255,255,255,0.98)",
    boxShadow: `0 24px 60px ${theme.glow}`,
  } as CSSProperties;

  // Guard extra (igual que centros)
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
        cacheBranding(payload, institucionSlug);
        setConfig(payload);
      } catch {
        setConfig(null);
      }
    }

    if (!token) return;
    void loadConfig();
  }, [institucionSlug, token]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((u) => {
      const hay = `${u.nombre} ${u.email} ${u.centro_nombre || ""} ${u.centros.join(" ")}`.toLowerCase();
      return hay.includes(s);
    });
  }, [items, q]);

  async function loadCentros() {
    const data = await api<Centro[]>("/api/admin/centros", {
      headers: { Authorization: `Bearer ${token}` },
    });
    setCentros(data || []);
  }

  async function loadUsers() {
    setLoading(true);
    try {
      // endpoint admin (lista usuarios de centro)
      const data = await api<CentroUser[]>("/api/admin/usuarios", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems(data || []);
    } catch (e: unknown) {
      toast.error(errorMessage(e, "No se pudo cargar usuarios"));
    } finally {
      setLoading(false);
    }
  }

  async function loadAll() {
    setLoading(true);
    try {
      await Promise.all([loadCentros(), loadUsers()]);
    } catch (e: unknown) {
      toast.error(errorMessage(e, "No se pudo cargar datos"));
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function openCreate() {
    setMode("create");
    setEditingId(null);
    setForm({
      nombre: "",
      email: "",
      centro_id: "",
      password: "",
    });
    setOpen(true);
  }

  function openEdit(u: CentroUser) {
    setMode("edit");
    setEditingId(u.id);
    setForm({
      nombre: u.nombre || "",
      email: u.email || "",
      centro_id: String(u.centros?.[0] || ""),
      password: "", // vacío -> no cambiar password
    });
    setOpen(true);
  }

  function validateForm(): string {
    const nombre = form.nombre.trim();
    const email = form.email.trim().toLowerCase();
    const centroId = form.centro_id.trim();

    if (nombre.length < 3) return "El nombre debe tener al menos 3 caracteres.";
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return "Email inválido.";
    if (!centroId) return "Selecciona un centro.";

    // En create, si mandas password, valida mínimo
    if (mode === "create" && form.password.trim() && form.password.trim().length < 8) {
      return "Si defines contraseña, debe tener al menos 8 caracteres.";
    }
    // En edit, si se define password, valida mínimo
    if (mode === "edit" && form.password.trim() && form.password.trim().length < 8) {
      return "La nueva contraseña debe tener al menos 8 caracteres.";
    }
    return "";
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();

    const msg = validateForm();
    if (msg) {
      toast.error(msg);
      return;
    }

    const payload: SaveUserPayload = {
      nombre: form.nombre.trim(),
      email: form.email.trim().toLowerCase(),
      centro_id: Number(form.centro_id),
    };

    // Si password viene vacío, el back puede autogenerar (create) o no tocarla (edit)
    if (form.password.trim()) payload.password = form.password.trim();

    setSaving(true);
    try {
      if (mode === "create") {
        const created = await api<CentroUser>("/api/admin/usuarios", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        if (created.generated_password) {
          toast.success(`Usuario creado. Contraseña temporal: ${created.generated_password}`);
        } else {
          toast.success("Usuario creado correctamente.");
        }
      } else {
        await api<CentroUser>(`/api/admin/usuarios/${editingId}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        toast.success("Usuario actualizado correctamente.");
      }
      setOpen(false);
      await loadUsers();
    } catch (e: unknown) {
      toast.error(errorMessage(e, "No se pudo guardar"));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(u: CentroUser) {
    const ok = confirm(`¿Desactivar la cuenta de "${u.nombre}" (${u.email})?`);
    if (!ok) return;

    try {
      await api<void>(`/api/admin/usuarios/${u.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadUsers();
      toast.success("Usuario desactivado correctamente.");
    } catch (e: unknown) {
      toast.error(errorMessage(e, "No se pudo desactivar"));
    }
  }

  if (!user) return null;

  return (
    <div className="grid gap-6">
      {/* Acciones superiores */}
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
            placeholder="Buscar por nombre, email o centro..."
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
            onClick={loadAll}
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
                Nuevo usuario
              </Button>
            </DialogTrigger>

            <DialogContent
              className="w-[min(92vw,42rem)] max-w-[min(92vw,42rem)] overflow-hidden rounded-[1.75rem] p-6 [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:border [&_[data-slot=dialog-close]]:border-[var(--brand-border)] [&_[data-slot=dialog-close]]:bg-white/90 [&_[data-slot=dialog-close]]:text-[var(--brand-primary)] [&_[data-slot=dialog-close]]:opacity-100"
              style={dialogContentStyle}
            >
              <DialogHeader>
                <DialogTitle style={{ color: theme.primary }}>
                  {mode === "create" ? "Nuevo usuario de centro" : "Editar usuario"}
                </DialogTitle>
                <DialogDescription className="text-sm text-neutral-600">
                  Crea una cuenta tipo <span className="font-semibold">centro</span> y asígnala a un centro.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={onSave} className="mt-2 grid min-w-0 gap-4">
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input
                    id="nombre"
                    style={fieldStyle}
                    className="min-w-0"
                    value={form.nombre}
                    onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                    placeholder="Ej. Coordinación UPIITA"
                    disabled={saving}
                  />
                </div>

                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    style={fieldStyle}
                    className="min-w-0"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="centro@institucion.mx"
                    disabled={saving}
                    inputMode="email"
                    autoCapitalize="none"
                  />
                </div>

                <div className="grid min-w-0 gap-2">
                  <Label>Centro</Label>
                  <Select
                    value={form.centro_id}
                    onValueChange={(v) => setForm((f) => ({ ...f, centro_id: v }))}
                    disabled={saving}
                  >
                    <SelectTrigger className="w-full min-w-0" style={fieldStyle}>
                      <SelectValue placeholder="Selecciona un centro" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      className="w-[var(--radix-select-trigger-width)] max-w-[var(--radix-select-trigger-width)]"
                      style={selectContentStyle}
                    >
                      {centros.map((c) => (
                        <SelectItem
                          key={c.id}
                          value={String(c.id)}
                          className="whitespace-normal break-words pr-8 leading-5"
                        >
                          {c.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-neutral-500">
                    * Solo se muestran centros activos (lista pública).
                  </p>
                </div>

                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="password">
                    Contraseña {mode === "edit" ? "(opcional)" : "(opcional)"}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    style={fieldStyle}
                    className="min-w-0"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder={
                      mode === "create"
                        ? "Deja vacío para autogenerar"
                        : "Deja vacío para no cambiar"
                    }
                    disabled={saving}
                  />
                  <p className="text-xs text-neutral-500">
                    Si la dejas vacía: en creación el backend puede generar una temporal; en edición no se modifica.
                  </p>
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

      {/* Tabla */}
      <div
        className="rounded-2xl border bg-white shadow-sm"
        style={{ borderColor: theme.border }}
      >
        <div className="flex items-center justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" style={{ color: theme.primary }} />
              <h2 className="text-lg font-bold text-neutral-900">Usuarios de centro</h2>
            </div>
            <p className="mt-1 text-sm text-neutral-600">
              Cuentas que pueden entrar al panel de centro.
            </p>
          </div>
        </div>

        <Separator />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">Usuario</th>
                <th className="px-5 py-3 text-left font-semibold">Email</th>
                <th className="px-5 py-3 text-left font-semibold">Centro</th>
                <th className="px-5 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td className="px-5 py-6 text-neutral-500" colSpan={4}>
                    Cargando…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-5 py-6 text-neutral-500" colSpan={4}>
                    Sin usuarios.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="border-t border-neutral-100">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-neutral-900">{u.nombre}</div>
                      <div className="text-xs text-neutral-500">ID: {u.id}</div>
                    </td>
                    <td className="px-5 py-4 text-neutral-700">{u.email}</td>
                    <td className="px-5 py-4">
                      <div className="inline-flex items-center gap-2">
                        <Building2 className="h-4 w-4" style={{ color: theme.primary }} />
                        <span className="text-neutral-800">
                          {u.centro_nombre || (u.centros?.[0] ? `Centro #${u.centros[0]}` : "Sin centro")}
                        </span>
                      </div>
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
                          onClick={() => openEdit(u)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </Button>

                        <Button
                          variant="outline"
                          className="h-9 rounded-full"
                          style={{ ...buttonRingStyle, ...destructiveButtonStyle }}
                          onClick={() => onDelete(u)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Desactivar
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
