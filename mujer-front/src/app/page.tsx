// src/app/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "../components/ui/dialog";

import {
  HeartHandshake,
  Lock,
  ShieldCheck,
  BarChart3,
  ChevronRight,
  Eye,
  EyeOff,
} from "lucide-react";

import { api } from "../lib/api";

// ✅ IMPORT CORRECTO (named export)
import { PrivacyNotice } from "../components/legal/PrivacyNotice";

type LoginResponse = {
  token: string;
  user_id: string;
  email: string;
  nombre: string;
  rol: "admin" | "centro";
  centros: number[];
  expires_at: number;
};

const BRAND = "#7F017F"; // Mujer Alerta (morado)
const BRAND_DARK = "#4C1D95";
const BRAND_PINK = "#BE185D";

export default function HomePage() {
  const router = useRouter();

  const [open, setOpen] = useState(false);

  // ✅ modal aviso privacidad
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  const [showPassword, setShowPassword] = useState(false);


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
      {/* Fondo premium (sobrio) */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1200px 600px at 15% 5%, rgba(127,1,127,0.10), transparent 55%)," +
            "radial-gradient(900px 500px at 85% 20%, rgba(190,24,93,0.10), transparent 55%)," +
            "linear-gradient(180deg, rgba(2,6,23,0.02), rgba(255,255,255,1) 38%)",
        }}
      />

      {/* Contenedor optimizado a ancho de teléfono */}
      <div className="mx-auto w-full max-w-md px-5 py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1
              className="mt-4 text-4xl font-extrabold tracking-tight"
              style={{ color: BRAND }}
            >
              Mujer Alerta
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Instrumento de diagnóstico para identificar percepciones del entorno
              escolar/laboral sobre violencia contra las mujeres, con resultados claros y
              comparables.
            </p>
          </div>

          {/* Login */}
          <div className="mt-1 shrink-0">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Acceso"
                    title="Acceso"
                    className={[
                      "group relative h-11 w-11 rounded-full",
                      "transition-all duration-300 ease-out",
                      "active:scale-[0.97]",
                      "hover:-translate-y-[1.5px]",
                      "shadow-[0_6px_18px_rgba(127,1,127,0.28)]",
                      "hover:shadow-[0_12px_26px_rgba(127,1,127,0.38)]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#7F017F]",
                    ].join(" ")}
                    style={{
                      background: "linear-gradient(135deg, #7F017F 0%, #BE185D 100%)",
                    }}
                  >
                    {/* ✅ halo externo que "pulsa" de vez en cuando (NO afecta icono) */}
                    <span
                      className="pointer-events-none absolute -inset-2 rounded-full blur-md"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(127,1,127,0.55), rgba(190,24,93,0.45))",
                        animation: "subtlePulse 5s ease-in-out infinite",
                      }}
                    />

                    {/* anillo interior sutil */}
                    <span className="pointer-events-none absolute inset-[1.5px] rounded-full ring-1 ring-white/20" />

                    {/* ✅ icono SIEMPRE blanco */}
                    <Lock className="relative h-5 w-5 text-white" strokeWidth={2.2} />
                  </Button>

              </DialogTrigger>



              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle style={{ color: BRAND }}>
                    Acceso para el perfil administrador
                  </DialogTitle>
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
                      inputMode="email"
                      autoComplete="email"
                      placeholder="tu@correo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="password">Contraseña</Label>

                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        className="pr-11"
                      />

                      <button
                        type="button"
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        className={[
                          "absolute right-3 top-1/2 -translate-y-1/2",
                          "text-slate-400 hover:text-slate-600",
                          "transition-colors",
                          "focus:outline-none",
                        ].join(" ")}
                        onClick={() => setShowPassword((v) => !v)}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {err ? <p className="text-sm text-red-600">{err}</p> : null}

                  <Button
                    type="submit"
                    disabled={!canSubmit}
                    className="h-12 w-full rounded-full text-base font-semibold shadow-sm active:scale-[0.99]"
                    style={{ backgroundColor: BRAND }}
                  >
                    {loading ? "Entrando…" : "Entrar"}
                  </Button>

                  <p className="text-center text-xs text-neutral-500">
                    El sistema identifica automáticamente tu perfil de acceso.
                  </p>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Cards: beneficios */}
        <div className="mt-7 grid gap-3">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
            <div className="flex items-start gap-3">
              <div
                className="grid h-10 w-10 place-items-center rounded-2xl"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(127,1,127,0.15), rgba(190,24,93,0.12))",
                  border: "1px solid rgba(2,6,23,0.06)",
                }}
              >
                <ShieldCheck className="h-5 w-5" style={{ color: BRAND_DARK }} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-900">
                    Participación confidencial
                  </p>
                  <Badge
                    variant="secondary"
                    className="rounded-full text-[10px] font-black uppercase tracking-widest"
                  >
                    Sin datos personales
                  </Badge>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Se centra en la percepción del entorno. Los resultados se presentan de forma
                  agregada para apoyar decisiones informadas.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
            <div className="flex items-start gap-3">
              <div
                className="grid h-10 w-10 place-items-center rounded-2xl"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(91,33,182,0.14), rgba(127,1,127,0.10))",
                  border: "1px solid rgba(2,6,23,0.06)",
                }}
              >
                <BarChart3 className="h-5 w-5" style={{ color: BRAND }} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Verás tres señales del entorno:{" "}
                  <span className="font-extrabold text-slate-800">qué tan seguido pasa</span>,{" "}
                  <span className="font-extrabold text-slate-800">
                    qué tan normalizado se siente
                  </span>{" "}
                  y{" "}
                  <span className="font-extrabold text-slate-800">
                    qué tan grave se percibe
                  </span>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA principal */}
        <div className="mt-6">
          <Button
            asChild
            className="h-14 w-full rounded-[999px] text-base font-extrabold shadow-sm active:scale-[0.99]"
            style={{
              background:
                "linear-gradient(135deg, rgba(127,1,127,1), rgba(190,24,93,0.92))",
            }}
          >
            <Link href="/diagnostico" aria-label="Iniciar diagnóstico">
              <HeartHandshake className="mr-2 h-5 w-5" />
              Iniciar diagnóstico
              <ChevronRight className="ml-2 h-5 w-5 opacity-90" />
            </Link>
          </Button>
        </div>

        {/* Texto institucional */}
        <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white/70 p-4 text-xs leading-5 text-slate-600 shadow-sm backdrop-blur">
          Herramienta tecnológica basada en análisis de datos para identificar, clasificar y
          evaluar manifestaciones de violencia contra las mujeres en entornos escolar y
          laboral, con el fin de apoyar estrategias de prevención y atención temprana, en
          concordancia con la{" "}
          <span className="font-black text-slate-800">
            Ley General de Acceso de las Mujeres a una Vida Libre de Violencia (LGAMVLV)
          </span>
          .
        </div>

        {/* Footer */}
        <div className="mt-8">
          <Separator />
          <p className="mt-5 text-center text-xs text-neutral-500">
            Desarrollado por Investigadores del Instituto Politécnico Nacional
          </p>

          <div className="mt-3 flex justify-center gap-4 text-[11px] text-slate-500">
            {/* ✅ Aviso de privacidad en modal */}
            <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="underline underline-offset-4"
                  aria-label="Aviso de privacidad"
                >
                  Aviso de privacidad
                </button>
              </DialogTrigger>

              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle style={{ color: BRAND }}>Aviso de privacidad</DialogTitle>
                  <DialogDescription className="text-sm text-neutral-600">
                    Consulta cómo se maneja la información dentro de Mujer Alerta.
                  </DialogDescription>
                </DialogHeader>

                {/* ✅ CONTENIDO REAL */}
                <PrivacyNotice />

                <Button
                  type="button"
                  className="mt-4 h-11 w-full rounded-full font-semibold"
                  style={{ backgroundColor: BRAND }}
                  onClick={() => setPrivacyOpen(false)}
                >
                  Cerrar
                </Button>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </main>
  );
}
