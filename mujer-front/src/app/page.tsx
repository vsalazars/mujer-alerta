"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ArrowRight, Eye, EyeOff, Lock } from "lucide-react";

import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { RegistrationRequestForm } from "../components/landing/RegistrationRequestForm";
import { api } from "../lib/api";
import { isAdminRole, type UserRole } from "../lib/auth";
import { withInstitutionSlug } from "../lib/routing";
import { toast } from "sonner";

const BRAND = "#B0186B";
const BRAND_DARK = "#7F017F";
const BRAND_SOFT = "#FCE7F3";
const BRAND_BORDER = "#F5C8DE";

type LoginResponse = {
  token: string;
  user_id: string;
  email: string;
  nombre: string;
  rol: UserRole;
  institucion_id: number;
  institucion_slug: string;
  centros: number[];
  centro_nombres?: string[];
  expires_at: number;
};

export default function LandingPage() {
  const router = useRouter();
  const [globalLoginOpen, setGlobalLoginOpen] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  async function onGlobalLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true);

    try {
      const data = await api<LoginResponse>("/api/auth/login-global", {
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
          institucion_id: data.institucion_id,
          institucion_slug: data.institucion_slug,
          centros: data.centros,
          centro_nombres: data.centro_nombres || [],
          expires_at: data.expires_at,
        })
      );

      setGlobalLoginOpen(false);
      setPassword("");
      setShowPassword(false);

      if (data.rol === "super_admin") {
        router.push("/super-admin");
      } else {
        router.push(
          withInstitutionSlug(
            data.institucion_slug,
            isAdminRole(data.rol) ? "/admin" : "/centro"
          )
        );
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("invalid_credentials")) toast.error("Correo o contraseña incorrectos.");
      else if (msg.includes("user_inactive")) toast.error("Tu usuario está desactivado. Contacta al administrador.");
      else if (msg.includes("multiple_accounts_same_email")) toast.error("Tu correo existe en varias instituciones. Usa el acceso por institución o solicita soporte.");
      else if (msg.includes("missing_jwt_secret")) toast.error("Falta JWT_SECRET en el backend.");
      else if (msg.includes("Failed to fetch")) toast.error("Sin conexión con el servidor.");
      else toast.error(msg || "No se pudo iniciar sesión.");
    } finally {
      setLoginLoading(false);
    }
  }

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#FFF8FB] text-slate-900">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 520px at 12% 16%, rgba(176,24,107,0.12), transparent 62%)," +
            "radial-gradient(860px 480px at 88% 12%, rgba(127,1,127,0.10), transparent 60%)," +
            "linear-gradient(180deg, #FFFDFE 0%, #FFF8FB 100%)",
        }}
      />

      <section className="mx-auto flex min-h-dvh w-full max-w-5xl items-center px-6 py-10 md:px-10">
        <div className="w-full rounded-[2rem] border border-[rgba(176,24,107,0.10)] bg-white/88 p-8 shadow-[0_32px_100px_rgba(176,24,107,0.10)] backdrop-blur md:p-12">
          <div className="mx-auto max-w-3xl text-center">
            <span
              className="inline-flex rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.28em]"
              style={{
                backgroundColor: BRAND_SOFT,
                color: BRAND_DARK,
                boxShadow: "inset 0 0 0 1px rgba(176,24,107,0.10)",
              }}
            >
              Herramienta tecnológica
            </span>

            <h1
              className="mt-6 text-5xl font-black tracking-tight md:text-6xl"
              style={{ color: BRAND_DARK }}
            >
              Mujer Alerta
            </h1>

            <p className="mt-8 text-base leading-8 text-slate-600 md:text-lg">
              Esta herramienta tecnológica basada en el análisis de datos y aprendizaje automático
              permite identificar, clasificar y evaluar los diferentes tipos de violencia contra
              las mujeres en los entornos escolar y laboral, con el fin de generar información
              fundamentada que facilite la toma de decisiones informadas y la implementación de
              estrategias efectivas de prevención, atención temprana y mitigación, conforme a las
              disposiciones de la Ley General de Acceso de las Mujeres a una Vida Libre de
              Violencia (LGAMVLV).
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Dialog open={globalLoginOpen} onOpenChange={setGlobalLoginOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="h-12 rounded-full px-7 text-base font-bold shadow-sm"
                    style={{
                      background: `linear-gradient(135deg, ${BRAND_DARK} 0%, ${BRAND} 100%)`,
                      color: "white",
                    }}
                  >
                    <Lock className="mr-2 h-4 w-4" />
                    Iniciar sesión
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md rounded-[1.75rem] border-[rgba(176,24,107,0.12)] bg-white/98 shadow-[0_24px_80px_rgba(176,24,107,0.16)]">
                  <DialogHeader>
                    <DialogTitle style={{ color: BRAND_DARK }}>Acceso administrativo</DialogTitle>
                    <DialogDescription>
                      Entra con tu correo y contraseña.
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={onGlobalLogin} className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="email">Correo</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu@institucion.edu"
                        disabled={loginLoading}
                        style={
                          {
                            "--ring": BRAND,
                            "--input": BRAND_BORDER,
                            "--primary": BRAND,
                            "--primary-foreground": "#FFFFFF",
                            accentColor: BRAND,
                            caretColor: BRAND,
                          } as React.CSSProperties
                        }
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="password">Contraseña</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          disabled={loginLoading}
                          className="pr-11"
                          style={
                            {
                              "--ring": BRAND,
                              "--input": BRAND_BORDER,
                              "--primary": BRAND,
                              "--primary-foreground": "#FFFFFF",
                              accentColor: BRAND,
                              caretColor: BRAND,
                            } as React.CSSProperties
                          }
                        />
                        <button
                          type="button"
                          aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none"
                          onClick={() => setShowPassword((value) => !value)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="rounded-full font-semibold"
                      style={{
                        background: `linear-gradient(135deg, ${BRAND_DARK} 0%, ${BRAND} 100%)`,
                        color: "white",
                      }}
                      disabled={loginLoading}
                    >
                      {loginLoading ? "Entrando..." : "Entrar"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={registrationOpen} onOpenChange={setRegistrationOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-12 rounded-full border px-7 text-base font-semibold"
                    style={{
                      borderColor: BRAND_BORDER,
                      backgroundColor: BRAND_SOFT,
                      color: BRAND_DARK,
                    }}
                  >
                    Registrarse
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto rounded-[1.75rem] border-[rgba(176,24,107,0.12)] bg-white/98 shadow-[0_24px_80px_rgba(176,24,107,0.16)]">
                  <DialogHeader>
                    <DialogTitle style={{ color: BRAND_DARK }}>Registro de nueva institución</DialogTitle>
                    <DialogDescription>
                    </DialogDescription>
                  </DialogHeader>
                  <RegistrationRequestForm mode="modal" onSuccess={() => setRegistrationOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
