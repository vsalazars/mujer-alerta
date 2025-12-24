// src/app/diagnostico/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Separator } from "../../components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

import { api } from "../../lib/api";

type Centro = {
  id: number;
  tipo: string;
  nombre: string;
  clave?: string;
  ciudad?: string;
  estado?: string;
};

type Genero = {
  id: number;
  clave: string;
  etiqueta: string;
  descripcion?: string | null;
};

export default function DiagnosticoInicioPage() {
  const router = useRouter();

  const [centros, setCentros] = useState<Centro[]>([]);
  const [generos, setGeneros] = useState<Genero[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [centroId, setCentroId] = useState<string>("");
  const [generoId, setGeneroId] = useState<string>("");
  const [edad, setEdad] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const [c, g] = await Promise.all([
          api<Centro[]>("/api/centros?limit=50"),
          api<Genero[]>("/api/generos"),
        ]);
        setCentros(c);
        setGeneros(g);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const canSubmit = useMemo(() => {
    const e = Number(edad);
    return (
      centroId !== "" &&
      generoId !== "" &&
      Number.isFinite(e) &&
      e >= 10 &&
      e <= 120 &&
      !submitting
    );
  }, [centroId, generoId, edad, submitting]);

  async function onSubmit() {
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const body = {
        centro_id: Number(centroId),
        genero_id: Number(generoId),
        edad: Number(edad),
        email: email.trim() || undefined, // opcional
      };

      const resp = await api<{ encuesta_id: string }>("/api/encuestas", {
        method: "POST",
        body: JSON.stringify(body),
      });

      router.push(`/diagnostico/${resp.encuesta_id}`);
    } catch (err: any) {
      alert(err?.message || "No se pudo crear la encuesta.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-dvh bg-white">
      <div className="mx-auto w-full max-w-md px-5 py-8">
        <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: "#7F017F" }}>
          Diagnóstico
        </h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          Completa estos datos para iniciar. El correo es opcional.
        </p>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Datos iniciales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {loading ? (
              <p className="text-sm text-neutral-500">Cargando catálogos…</p>
            ) : (
              <>
                {/* Centro */}
                <div className="space-y-2">
                  <Label>Centro</Label>
                  <Select value={centroId} onValueChange={setCentroId}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Selecciona un centro" />
                    </SelectTrigger>
                    <SelectContent>
                      {centros.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Género */}
                <div className="space-y-2">
                  <Label>Género</Label>
                  <Select value={generoId} onValueChange={setGeneroId}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Selecciona una opción" />
                    </SelectTrigger>
                    <SelectContent>
                      {generos.map((g) => (
                        <SelectItem key={g.id} value={String(g.id)}>
                          {g.etiqueta}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Edad */}
                <div className="space-y-2">
                  <Label>Edad</Label>
                  <Input
                    className="h-12"
                    inputMode="numeric"
                    placeholder="Ej. 19"
                    value={edad}
                    onChange={(e) => setEdad(e.target.value.replace(/[^\d]/g, ""))}
                  />
                  <p className="text-xs text-neutral-500">Rango permitido: 10 a 120.</p>
                </div>

                {/* Email opcional */}
                <div className="space-y-2">
                  <Label>Correo (opcional)</Label>
                  <Input
                    className="h-12"
                    inputMode="email"
                    placeholder="tucorreo@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <Separator />

                <Button
                  onClick={onSubmit}
                  disabled={!canSubmit}
                  className="h-12 w-full rounded-full text-base font-semibold"
                  style={{ backgroundColor: "#7F017F" }}
                >
                  {submitting ? "Creando…" : "Comenzar"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
