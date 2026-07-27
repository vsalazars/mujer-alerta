"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, type CSSProperties } from "react";
import { Upload, Image as ImageIcon, Save, Trash2 } from "lucide-react";

import { api } from "@/lib/api";
import { themeFromBranding } from "@/lib/branding";
import { BrandColorField } from "@/components/admin/brand-color-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type ConfiguracionInstitucion = {
  institucion_id: number;
  nombre_publico?: string;
  logo_url?: string;
  color_primario?: string;
  color_secundario?: string;
  color_apoyo?: string;
  dominio_permitido?: string;
  permite_autoregistro: boolean;
  requiere_correo_institucional: boolean;
};

type FormState = {
  nombre_publico: string;
  logo_url: string;
  color_primario: string;
  color_secundario: string;
  color_apoyo: string;
};

function readToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("auth_token") || "";
}

export default function AdminConfigPage() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({
    nombre_publico: "",
    logo_url: "",
    color_primario: "",
    color_secundario: "",
    color_apoyo: "",
  });
  const theme = themeFromBranding(form);
  const fieldStyle = {
    "--ring": theme.primary,
    "--input": theme.border,
  } as CSSProperties;
  const buttonRingStyle = {
    "--ring": theme.primary,
  } as CSSProperties;

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
          color_primario: data.color_primario || "",
          color_secundario: data.color_secundario || "",
          color_apoyo: data.color_apoyo || "",
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "";
        if (!msg.includes("config_not_found")) {
          toast.error(msg || "No se pudo cargar la configuración.");
        }
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  async function onPickLogo(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecciona un archivo de imagen válido.");
      return;
    }
    if (file.size > 1024 * 1024) {
      toast.error("La imagen no debe exceder 1 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setForm((current) => ({ ...current, logo_url: result }));
    };
    reader.onerror = () => toast.error("No se pudo leer la imagen seleccionada.");
    reader.readAsDataURL(file);
  }

  async function onSave() {
    setSaving(true);
    try {
      const saved = await api<ConfiguracionInstitucion>("/api/admin/configuracion", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nombre_publico: form.nombre_publico.trim(),
          logo_url: form.logo_url.trim(),
          color_primario: form.color_primario.trim(),
          color_secundario: form.color_secundario.trim(),
          color_apoyo: form.color_apoyo.trim(),
          dominio_permitido: "",
          permite_autoregistro: true,
          requiere_correo_institucional: false,
        }),
      });
      setForm({
        nombre_publico: saved.nombre_publico || "",
        logo_url: saved.logo_url || "",
        color_primario: saved.color_primario || "",
        color_secundario: saved.color_secundario || "",
        color_apoyo: saved.color_apoyo || "",
      });
      window.dispatchEvent(
        new CustomEvent("institucion-config-updated", {
          detail: saved,
        })
      );
      toast.success("Cambios guardados. El menú ya refleja el logotipo actualizado.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      toast.error(msg || "No se pudo guardar la configuración.");
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
          Ajusta nombre, logotipo y paleta de color para personalizar el panel admin, la encuesta pública y el tablero de resultados.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4">
              <p className="text-sm font-semibold text-neutral-900">Vista previa</p>
              <div className="mt-4 grid min-h-48 place-items-center rounded-2xl bg-white p-4">
                <div className="w-full max-w-[260px] rounded-[28px] border p-5 shadow-sm" style={{ borderColor: theme.border }}>
                  <div className="rounded-[22px] p-5" style={{ background: `linear-gradient(135deg, ${theme.soft} 0%, rgba(255,255,255,1) 55%, ${theme.softStrong} 100%)` }}>
                    {form.logo_url ? (
                      <img
                        src={form.logo_url}
                        alt="Logo institucional"
                        className="mx-auto max-h-24 max-w-full object-contain"
                      />
                    ) : (
                      <div className="text-center text-neutral-500">
                        <ImageIcon className="mx-auto h-8 w-8" style={{ color: theme.primary }} />
                        <p className="mt-2 text-sm">Sin logotipo cargado</p>
                      </div>
                    )}
                    <p className="mt-4 text-center text-base font-extrabold" style={{ color: theme.primary }}>
                      {form.nombre_publico.trim() || "Nombre institucional"}
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <span className="h-4 w-4 rounded-full border border-white shadow-sm" style={{ backgroundColor: theme.primary }} />
                      <span className="h-4 w-4 rounded-full border border-white shadow-sm" style={{ backgroundColor: theme.secondary }} />
                      <span className="h-4 w-4 rounded-full border border-white shadow-sm" style={{ backgroundColor: theme.support }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="nombre_publico">Nombre público</Label>
              <Input
                id="nombre_publico"
                style={fieldStyle}
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
                  style={{
                    ...buttonRingStyle,
                    borderColor: theme.support,
                    backgroundColor: theme.supportSoft,
                    color: theme.primary,
                  }}
                  onClick={() => {
                    setForm((current) => ({ ...current, logo_url: "" }));
                    toast.success("Logotipo eliminado de la configuración.");
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

            <div className="grid gap-4 md:grid-cols-3">
              <BrandColorField
                id="color_primario"
                label="Color primario"
                value={form.color_primario}
                resolvedColor={theme.primary}
                placeholder="#7F017F"
                onChange={(value) => setForm((current) => ({ ...current, color_primario: value }))}
              />

              <BrandColorField
                id="color_secundario"
                label="Color secundario"
                value={form.color_secundario}
                resolvedColor={theme.secondary}
                placeholder="#C23C9A"
                onChange={(value) => setForm((current) => ({ ...current, color_secundario: value }))}
              />

              <BrandColorField
                id="color_apoyo"
                label="Color de apoyo"
                value={form.color_apoyo}
                resolvedColor={theme.support}
                placeholder="Opcional"
                hint=""
                onChange={(value) => setForm((current) => ({ ...current, color_apoyo: value }))}
              />
            </div>
            <div className="pt-2">
              <Button
                type="button"
                className="rounded-full font-semibold"
                style={{ ...buttonRingStyle, background: theme.gradient, color: "white" }}
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
