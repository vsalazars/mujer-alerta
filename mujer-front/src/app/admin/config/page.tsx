"use client";

import { useEffect, useState } from "react";
import { Upload, Image as ImageIcon, Save, Trash2 } from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ConfiguracionInstitucion = {
  institucion_id: number;
  nombre_publico?: string;
  logo_url?: string;
  color_primario?: string;
  color_secundario?: string;
  dominio_permitido?: string;
  permite_autoregistro: boolean;
  requiere_correo_institucional: boolean;
};

type FormState = {
  nombre_publico: string;
  logo_url: string;
};

function readToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("auth_token") || "";
}

export default function AdminConfigPage() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<FormState>({
    nombre_publico: "",
    logo_url: "",
  });

  useEffect(() => {
    const authToken = readToken();
    setToken(authToken);

    async function load() {
      try {
        const data = await api<ConfiguracionInstitucion>("/api/admin/configuracion", {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        setForm({
          nombre_publico: data.nombre_publico || "",
          logo_url: data.logo_url || "",
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "";
        if (!msg.includes("config_not_found")) {
          setError(msg || "No se pudo cargar la configuración.");
        }
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  async function onPickLogo(file: File | null) {
    if (!file) return;
    setSuccess("");
    if (!file.type.startsWith("image/")) {
      setError("Selecciona un archivo de imagen válido.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setError("La imagen no debe exceder 1 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setForm((current) => ({ ...current, logo_url: result }));
      setError("");
    };
    reader.onerror = () => setError("No se pudo leer la imagen seleccionada.");
    reader.readAsDataURL(file);
  }

  async function onSave() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const saved = await api<ConfiguracionInstitucion>("/api/admin/configuracion", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nombre_publico: form.nombre_publico.trim(),
          logo_url: form.logo_url.trim(),
          color_primario: "",
          color_secundario: "",
          dominio_permitido: "",
          permite_autoregistro: true,
          requiere_correo_institucional: false,
        }),
      });
      setForm({
        nombre_publico: saved.nombre_publico || "",
        logo_url: saved.logo_url || "",
      });
      window.dispatchEvent(
        new CustomEvent("institucion-config-updated", {
          detail: saved,
        })
      );
      setSuccess("Cambios guardados. El menú ya refleja el logotipo actualizado.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      setError(msg || "No se pudo guardar la configuración.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-neutral-200 bg-white p-6">Cargando configuración...</div>;
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-neutral-900">Identidad institucional</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Sube o cambia el logotipo/escudo para mostrarlo en el panel administrativo.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4">
            <p className="text-sm font-semibold text-neutral-900">Vista previa</p>
            <div className="mt-4 grid min-h-48 place-items-center rounded-2xl bg-white p-4">
              {form.logo_url ? (
                <img
                  src={form.logo_url}
                  alt="Logo institucional"
                  className="max-h-36 max-w-full object-contain"
                />
              ) : (
                <div className="text-center text-neutral-500">
                  <ImageIcon className="mx-auto h-8 w-8" />
                  <p className="mt-2 text-sm">Sin logotipo cargado</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="nombre_publico">Nombre público</Label>
              <Input
                id="nombre_publico"
                value={form.nombre_publico}
                onChange={(e) => setForm((current) => ({ ...current, nombre_publico: e.target.value }))}
                placeholder="Ej. UPIITA"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="logo_file">Logotipo o escudo</Label>
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex cursor-pointer items-center rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50">
                  <Upload className="mr-2 h-4 w-4" />
                  Seleccionar imagen
                  <input
                    id="logo_file"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void onPickLogo(e.target.files?.[0] || null)}
                  />
                </label>

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    setForm((current) => ({ ...current, logo_url: "" }));
                    setSuccess("");
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Quitar logo
                </Button>
              </div>
              <p className="text-xs text-neutral-500">
                Formatos sugeridos: PNG o JPG. Tamaño máximo: 1 MB.
              </p>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {success ? <p className="text-sm text-emerald-700">{success}</p> : null}

            <div className="pt-2">
              <Button
                type="button"
                className="rounded-full font-semibold"
                style={{ backgroundColor: "#7F017F" }}
                onClick={onSave}
                disabled={saving}
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
