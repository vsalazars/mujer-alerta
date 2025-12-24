// src/app/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { HeartHandshake, Lock } from "lucide-react";
import Link from "next/link";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "../components/ui/dialog";

import { api } from "../lib/api";

type LoginResponse = {
  token: string;
  user_id: string;
  email: string;
  nombre: string;
  rol: "admin" | "centro";
  centros: number[];
  expires_at: number;
};

export default function HomePage() {
  const router = useRouter();

  const [open, setOpen] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && password.trim().length >= 6 && !loading;
  }, [email, password, loading]);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const data = await api<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      localStorage.setItem("auth_token", data.token);
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          user_id: data.user_id,
          email: data.email,
          nombre: data.nombre,
          rol: data.rol,
          centros: data.centros,
          expires_at: data.expires_at,
        })
      );

      setOpen(false);
      setPassword("");

      if (data.rol === "admin") {
        router.push("/admin");
      } else {
        router.push("/centro");
      }
    } catch (e: any) {
      const msg = typeof e?.message === "string" ? e.message : "";
      if (msg.includes("invalid_credentials")) {
        setErr("Correo o contraseña incorrectos.");
      } else if (msg.includes("user_inactive")) {
        setErr("Tu usuario está desactivado. Contacta al administrador.");
      } else if (msg.includes("missing_jwt_secret")) {
        setErr("Falta JWT_SECRET en el backend.");
      } else if (msg.includes("Failed to fetch")) {
        setErr("Sin conexión con el servidor.");
      } else {
        setErr(msg || "No se pudo iniciar sesión.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh bg-white">
      <div className="mx-auto w-full max-w-md px-6 py-10">
        <div className="relative">
          <h1
            className="text-center text-4xl font-extrabold tracking-tight"
            style={{ color: "#7F017F" }}
          >
            Mujer Alerta
          </h1>

          <div className="absolute right-0 top-0">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  aria-label="Acceso"
                  title="Acceso"
                >
                  <Lock className="h-5 w-5" style={{ color: "#7F017F" }} />
                </Button>
              </DialogTrigger>

              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle style={{ color: "#7F017F" }}>Acceso</DialogTitle>
                  <DialogDescription className="text-sm text-neutral-600">
                    Inicia sesión con tu correo y contraseña.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={onLogin} className="mt-2 grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Correo</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="tu@correo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="password">Contraseña</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                    />
                  </div>

                  {err ? <p className="text-sm text-red-600">{err}</p> : null}

                  <Button
                    type="submit"
                    disabled={!canSubmit}
                    className="h-12 w-full rounded-full text-base font-semibold shadow-sm"
                    style={{ backgroundColor: "#7F017F" }}
                  >
                    {loading ? "Entrando…" : "Entrar"}
                  </Button>

                  <p className="text-center text-xs text-neutral-500">
                    El sistema detecta automáticamente si eres administrador o
                    usuario de un centro.
                  </p>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <p className="mt-6 text-center text-sm leading-6 text-neutral-600">
          Esta herramienta tecnológica basada en el análisis de datos y
          aprendizaje automático permite identificar, clasificar y evaluar los
          diferentes tipos de violencia contra las mujeres en los entornos
          escolar y laboral, con el fin de generar información fundamentada que
          facilite la toma de decisiones informadas y la implementación de
          estrategias efectivas de prevención, atención temprana y mitigación,
          conforme a las disposiciones de la Ley General de Acceso de las Mujeres
          a una Vida Libre de Violencia (LGAMVLV).
        </p>

        <div className="mt-10 flex justify-center">
          <Button
            asChild
            className="h-12 w-full rounded-full text-base font-semibold shadow-sm"
            style={{ backgroundColor: "#7F017F" }}
          >
            <Link href="/diagnostico" aria-label="Iniciar diagnóstico">
              <HeartHandshake className="mr-2 h-5 w-5" />
              Diagnóstico
            </Link>
          </Button>
        </div>

        <div className="mt-10">
          <Separator />
          <p className="mt-6 text-center text-xs text-neutral-500">
            Desarrollado por Investigadores del Instituto Politécnico Nacional
          </p>
        </div>
      </div>
    </main>
  );
}
