"use client";

import { useState } from "react";

import { ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { toast } from "sonner";

const BRAND = "#7F017F";

type RegistroResponse = {
  id: number;
  estatus: string;
  institucion_nombre: string;
  slug_deseado?: string;
};

type FormState = {
  institucion_nombre: string;
  tipo: string;
  nombre_contacto: string;
  cargo_contacto: string;
  email_contacto: string;
  telefono_contacto: string;
  estado: string;
  ciudad: string;
  sitio_web: string;
};

const INITIAL_STATE: FormState = {
  institucion_nombre: "",
  tipo: "institucion",
  nombre_contacto: "",
  cargo_contacto: "",
  email_contacto: "",
  telefono_contacto: "",
  estado: "",
  ciudad: "",
  sitio_web: "",
};

const MEXICAN_STATES = [
  "Aguascalientes",
  "Baja California",
  "Baja California Sur",
  "Campeche",
  "Chiapas",
  "Chihuahua",
  "Ciudad de México",
  "Coahuila",
  "Colima",
  "Durango",
  "Estado de México",
  "Guanajuato",
  "Guerrero",
  "Hidalgo",
  "Jalisco",
  "Michoacán",
  "Morelos",
  "Nayarit",
  "Nuevo León",
  "Oaxaca",
  "Puebla",
  "Querétaro",
  "Quintana Roo",
  "San Luis Potosí",
  "Sinaloa",
  "Sonora",
  "Tabasco",
  "Tamaulipas",
  "Tlaxcala",
  "Veracruz",
  "Yucatán",
  "Zacatecas",
] as const;

export function RegistrationRequestForm({
  mode = "page",
  onSuccess,
}: {
  mode?: "page" | "modal";
  onSuccess?: () => void;
}) {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<RegistroResponse | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updatePhone(value: string) {
    const digitsOnly = value.replace(/\D/g, "").slice(0, 10);
    update("telefono_contacto", digitsOnly);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (form.telefono_contacto && !/^\d{10}$/.test(form.telefono_contacto)) {
      toast.error("El teléfono debe contener exactamente 10 números.");
      return;
    }

    setLoading(true);

    try {
      const payload = await api<RegistroResponse>("/api/registro-institucional", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          telefono_contacto: form.telefono_contacto.trim(),
        }),
      });
      setSuccess(payload);
      toast.success("Solicitud enviada correctamente.");
      setForm(INITIAL_STATE);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("missing_required_fields")) {
        toast.error("Completa institución, persona de contacto y correo.");
      } else if (msg.includes("bad_email")) {
        toast.error("Escribe un correo válido.");
      } else if (msg.includes("request_already_exists")) {
        toast.error("Ya existe una solicitud activa con ese correo. Te contactaremos pronto.");
      } else if (msg.includes("Failed to fetch")) {
        toast.error("No hubo conexión con el servidor.");
      } else {
        toast.error("No pudimos enviar tu solicitud. Intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-[1.75rem] border border-emerald-100 bg-emerald-50/80 p-6 text-slate-900">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white shadow-sm">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-lg font-black">Solicitud enviada</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Registramos a <strong>{success.institucion_nombre}</strong> con folio{" "}
              <strong>#{success.id}</strong>. El estatus inicial quedó como{" "}
              <strong>{success.estatus}</strong>.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {success.slug_deseado
                ? `Asignamos automáticamente el slug "${success.slug_deseado}" para esta solicitud.`
                : "Nos pondremos en contacto para activar el tenant."}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            className="rounded-full font-semibold"
            style={{ backgroundColor: BRAND }}
            onClick={() => setSuccess(null)}
          >
            Registrar otra institución
          </Button>
          {mode === "modal" ? (
            <Button type="button" variant="outline" className="rounded-full font-semibold" onClick={onSuccess}>
              Cerrar
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`institucion_nombre_${mode}`}>Institución</Label>
          <Input
            id={`institucion_nombre_${mode}`}
            value={form.institucion_nombre}
            onChange={(e) => update("institucion_nombre", e.target.value)}
            placeholder="Universidad, empresa o dependencia"
            disabled={loading}
          />
        </div>

        <div className="grid gap-2">
          <Label>Tipo</Label>
          <Select value={form.tipo} onValueChange={(value) => update("tipo", value)} disabled={loading}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecciona el tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="institucion">Institución</SelectItem>
              <SelectItem value="universidad">Universidad</SelectItem>
              <SelectItem value="empresa">Empresa</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`nombre_contacto_${mode}`}>Persona de contacto</Label>
          <Input
            id={`nombre_contacto_${mode}`}
            value={form.nombre_contacto}
            onChange={(e) => update("nombre_contacto", e.target.value)}
            placeholder="Nombre y apellido"
            disabled={loading}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`cargo_contacto_${mode}`}>Cargo</Label>
          <Input
            id={`cargo_contacto_${mode}`}
            value={form.cargo_contacto}
            onChange={(e) => update("cargo_contacto", e.target.value)}
            placeholder="Dirección, RH, bienestar, coordinación..."
            disabled={loading}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`email_contacto_${mode}`}>Correo</Label>
          <Input
            id={`email_contacto_${mode}`}
            type="email"
            value={form.email_contacto}
            onChange={(e) => update("email_contacto", e.target.value)}
            placeholder="contacto@institucion.edu"
            disabled={loading}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`telefono_contacto_${mode}`}>Teléfono</Label>
          <Input
            id={`telefono_contacto_${mode}`}
            type="tel"
            value={form.telefono_contacto}
            onChange={(e) => updatePhone(e.target.value)}
            inputMode="numeric"
            maxLength={10}
            pattern="\d{10}"
            placeholder="7771234567"
            disabled={loading}
          />
        </div>

        <div className="grid gap-2">
          <Label>Estado</Label>
          <Select value={form.estado} onValueChange={(value) => update("estado", value)} disabled={loading}>
            <SelectTrigger id={`estado_${mode}`} className="w-full">
              <SelectValue placeholder="Selecciona un estado" />
            </SelectTrigger>
            <SelectContent>
              {MEXICAN_STATES.map((state) => (
                <SelectItem key={state} value={state}>
                  {state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`ciudad_${mode}`}>Ciudad</Label>
          <Input
            id={`ciudad_${mode}`}
            value={form.ciudad}
            onChange={(e) => update("ciudad", e.target.value)}
            placeholder="Cuernavaca"
            disabled={loading}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`sitio_web_${mode}`}>Sitio web</Label>
          <Input
            id={`sitio_web_${mode}`}
            value={form.sitio_web}
            onChange={(e) => update("sitio_web", e.target.value)}
            placeholder="https://institucion.mx"
            disabled={loading}
          />
        </div>
      </div>
      <Button
        type="submit"
        className="rounded-full px-6 font-semibold"
        style={{ backgroundColor: BRAND }}
        disabled={loading}
      >
        {loading ? (
          <>
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            Enviando solicitud...
          </>
        ) : (
          <>
            Enviar solicitud
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}
