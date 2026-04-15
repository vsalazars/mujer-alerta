"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  ArrowRight,
  Building2,
  Lock,
  ShieldCheck,
  Sparkles,
  Users,
  UserCog,
} from "lucide-react";

import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { RegistrationRequestForm } from "../components/landing/RegistrationRequestForm";
import { api } from "../lib/api";
import { isAdminRole, type UserRole } from "../lib/auth";
import { withInstitutionSlug } from "../lib/routing";

const BRAND = "#7F017F";

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

type PublicAccessResolution = {
  kind: "institucion" | "centro";
  institucion_slug: string;
  centro_slug?: string;
  target_path: string;
};

export default function LandingPage() {
  const router = useRouter();
  const [slug, setSlug] = useState("institucion-demo-inicial");
  const [slugAccessOpen, setSlugAccessOpen] = useState(false);
  const [slugError, setSlugError] = useState("");
  const [globalLoginOpen, setGlobalLoginOpen] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  function onOpenSlugAccess() {
    setSlugError("");
    setSlugAccessOpen(true);
  }

  async function onSubmitSlugAccess(e: React.FormEvent) {
    e.preventDefault();
    const clean = slug.trim().replace(/^\/+|\/+$/g, "");
    if (!clean) {
      setSlugError("Escribe el slug de tu institución.");
      return;
    }

    try {
      await api<PublicAccessResolution>(`/api/access/resolve?slug=${encodeURIComponent(clean)}`);
      setSlugAccessOpen(false);
      router.push(`/${clean}/diagnostico`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("slug_not_found")) {
        setSlugError("No encontramos una institución o centro activo con ese slug.");
        return;
      }
      if (msg.includes("Failed to fetch")) {
        setSlugError("Sin conexión con el servidor.");
        return;
      }
      setSlugError("No se pudo resolver el slug. Intenta de nuevo.");
    }
  }

  async function onGlobalLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
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
        }),
      );

      setGlobalLoginOpen(false);
      setPassword("");
      if (data.rol === "super_admin") {
        router.push("/super-admin");
      } else {
        router.push(
          withInstitutionSlug(
            data.institucion_slug,
            isAdminRole(data.rol) ? "/admin" : "/centro",
          ),
        );
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("invalid_credentials")) setLoginError("Correo o contraseña incorrectos.");
      else if (msg.includes("user_inactive")) setLoginError("Tu usuario está desactivado. Contacta al administrador.");
      else if (msg.includes("multiple_accounts_same_email")) setLoginError("Tu correo existe en varias instituciones. Usa el acceso por institución o solicita soporte.");
      else if (msg.includes("missing_jwt_secret")) setLoginError("Falta JWT_SECRET en el backend.");
      else if (msg.includes("Failed to fetch")) setLoginError("Sin conexión con el servidor.");
      else setLoginError(msg || "No se pudo iniciar sesión.");
    } finally {
      setLoginLoading(false);
    }
  }

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#f7f4ef] text-slate-900">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1200px 720px at 10% 10%, rgba(127,1,127,0.10), transparent 60%)," +
            "radial-gradient(900px 540px at 90% 15%, rgba(190,24,93,0.10), transparent 58%)," +
            "linear-gradient(180deg, #fcfbf8 0%, #f7f4ef 100%)",
        }}
      />

      <section className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-6 py-8 md:px-10 lg:px-12">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-4xl font-black tracking-tight" style={{ color: BRAND }}>
              Mujer Alerta
            </p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
              Plataforma SaaS multitenant para diagnóstico institucional, análisis agregado y
              seguimiento de entornos escolares y laborales.
            </p>
          </div>

          <Dialog open={globalLoginOpen} onOpenChange={setGlobalLoginOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="rounded-full border-slate-300 bg-white/80 px-5 font-semibold"
              >
                <Lock className="mr-2 h-4 w-4" />
                Iniciar sesión
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle style={{ color: BRAND }}>Acceso administrativo</DialogTitle>
                <DialogDescription>
                  Entra con tu correo y contraseña. El sistema detecta automáticamente tu institución.
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
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={loginLoading}
                  />
                </div>

                {loginError ? <p className="text-sm text-red-600">{loginError}</p> : null}

                <Button type="submit" className="rounded-full font-semibold" style={{ backgroundColor: BRAND }} disabled={loginLoading}>
                  {loginLoading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-600 shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              SaaS Institucional
            </div>

            <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[0.95] tracking-tight text-slate-950 md:text-6xl">
              Diagnóstico accionable para instituciones que quieren
              <span style={{ color: BRAND }}> medir, entender y actuar.</span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Mujer Alerta separa claramente la experiencia pública del tenant institucional:
              cada organización entra por su `slug`, opera aislada por tenant y conserva su
              propio flujo de encuesta, administración y resultados.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Dialog open={slugAccessOpen} onOpenChange={setSlugAccessOpen}>
                <DialogTrigger asChild>
                  <Button className="h-13 rounded-full px-6 text-base font-bold" style={{ backgroundColor: BRAND }} onClick={onOpenSlugAccess}>
                    Ir con slug
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle style={{ color: BRAND }}>Entrar a una institución</DialogTitle>
                    <DialogDescription>
                      Escribe el slug de una institución existente para abrir su encuesta pública.
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={onSubmitSlugAccess} className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="slug-publico">Slug de institución</Label>
                      <Input
                        id="slug-publico"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder="institucion-demo-inicial"
                      />
                    </div>

                    {slugError ? <p className="text-sm text-red-600">{slugError}</p> : null}

                    <Button type="submit" className="rounded-full font-semibold" style={{ backgroundColor: BRAND }}>
                      Ir a la encuesta
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={registrationOpen} onOpenChange={setRegistrationOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="h-13 rounded-full border-slate-300 bg-white/70 px-6 text-base font-semibold">
                    Solicitar registro
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle style={{ color: BRAND }}>Registro de nueva institución</DialogTitle>
                    <DialogDescription>
                      Déjanos tus datos y levantamos la solicitud para configurar tenant, branding y acceso administrativo.
                    </DialogDescription>
                  </DialogHeader>
                  <RegistrationRequestForm mode="modal" onSuccess={() => setRegistrationOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              <article className="rounded-[1.75rem] border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#faf5ff]">
                    <Building2 className="h-5 w-5" style={{ color: BRAND }} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-950">Entrar a mi institución</p>
                    <p className="text-xs text-slate-500">Para equipos y participantes de un tenant existente.</p>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-600">
                  Usa el `slug` institucional para abrir la experiencia pública del tenant y
                  continuar con encuesta, resultados o acceso operativo.
                </p>

                <div className="mt-5">
                  <Dialog open={slugAccessOpen} onOpenChange={setSlugAccessOpen}>
                    <DialogTrigger asChild>
                      <Button className="w-full rounded-full font-semibold" style={{ backgroundColor: BRAND }} onClick={onOpenSlugAccess}>
                        Ir con slug
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle style={{ color: BRAND }}>Entrar a mi institución</DialogTitle>
                        <DialogDescription>
                          Captura el slug institucional para abrir la encuesta pública del tenant.
                        </DialogDescription>
                      </DialogHeader>

                      <form onSubmit={onSubmitSlugAccess} className="grid gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="slug-card">Slug de institución</Label>
                          <Input
                            id="slug-card"
                            value={slug}
                            onChange={(e) => setSlug(e.target.value)}
                            placeholder="institucion-demo-inicial"
                          />
                        </div>

                        {slugError ? <p className="text-sm text-red-600">{slugError}</p> : null}

                        <Button type="submit" className="rounded-full font-semibold" style={{ backgroundColor: BRAND }}>
                          Abrir encuesta
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </article>

              <article className="rounded-[1.75rem] border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#fff6fb]">
                    <UserCog className="h-5 w-5" style={{ color: BRAND }} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-950">Acceso propietario / admin</p>
                    <p className="text-xs text-slate-500">Para owner, admin institucional y operación interna.</p>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-600">
                  Inicia sesión con tu correo y contraseña sin memorizar el `slug`. El sistema
                  resuelve la institución y te redirige automáticamente a tu panel.
                </p>

                <div className="mt-5">
                  <Dialog open={globalLoginOpen} onOpenChange={setGlobalLoginOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full rounded-full border-slate-300 bg-white font-semibold">
                        <Lock className="mr-2 h-4 w-4" />
                        Entrar como propietario
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle style={{ color: BRAND }}>Acceso de propietario o administrador</DialogTitle>
                        <DialogDescription>
                          Usa tu correo y contraseña. Si tu cuenta pertenece a una sola institución,
                          te enviaremos directo al tenant correcto.
                        </DialogDescription>
                      </DialogHeader>

                      <form onSubmit={onGlobalLogin} className="grid gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="email-admin">Correo</Label>
                          <Input
                            id="email-admin"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="tu@institucion.edu"
                            disabled={loginLoading}
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="password-admin">Contraseña</Label>
                          <Input
                            id="password-admin"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            disabled={loginLoading}
                          />
                        </div>

                        {loginError ? <p className="text-sm text-red-600">{loginError}</p> : null}

                        <Button type="submit" className="rounded-full font-semibold" style={{ backgroundColor: BRAND }} disabled={loginLoading}>
                          {loginLoading ? "Entrando..." : "Abrir acceso administrativo"}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </article>

              <article className="rounded-[1.75rem] border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f6f7ff]">
                    <Users className="h-5 w-5" style={{ color: BRAND }} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-950">Registrar organización</p>
                    <p className="text-xs text-slate-500">Para instituciones nuevas que quieren operar en la plataforma.</p>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-600">
                  Solicita alta de organización, validación del tenant, configuración visual y
                  habilitación de usuarios propietarios.
                </p>

                <div className="mt-5">
                  <Dialog open={registrationOpen} onOpenChange={setRegistrationOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full rounded-full border-slate-300 bg-white font-semibold">
                        Iniciar registro
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle style={{ color: BRAND }}>Alta de organización</DialogTitle>
                        <DialogDescription>
                          Capturamos la solicitud, revisamos el slug y te acompañamos con la activación del tenant.
                        </DialogDescription>
                      </DialogHeader>
                      <RegistrationRequestForm mode="modal" onSuccess={() => setRegistrationOpen(false)} />
                    </DialogContent>
                  </Dialog>
                </div>
              </article>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <article className="rounded-3xl border border-white/70 bg-white/75 p-5 shadow-sm backdrop-blur">
                <Building2 className="h-5 w-5" style={{ color: BRAND }} />
                <p className="mt-3 text-sm font-bold">Tenant por institución</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Cada organización entra por su propia ruta y mantiene aislamiento de datos.
                </p>
              </article>

              <article className="rounded-3xl border border-white/70 bg-white/75 p-5 shadow-sm backdrop-blur">
                <ShieldCheck className="h-5 w-5" style={{ color: BRAND }} />
                <p className="mt-3 text-sm font-bold">Resultados agregados</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Encuestas públicas, operación segura y análisis institucional centralizado.
                </p>
              </article>

              <article className="rounded-3xl border border-white/70 bg-white/75 p-5 shadow-sm backdrop-blur">
                <Users className="h-5 w-5" style={{ color: BRAND }} />
                <p className="mt-3 text-sm font-bold">Panel por perfil</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Administra centros, usuarios y dashboards por tenant sin mezclar contextos.
                </p>
              </article>
            </div>
          </div>

          <aside className="relative">
            <div className="rounded-[2rem] border border-white/80 bg-white/80 p-6 shadow-[0_24px_80px_rgba(127,1,127,0.12)] backdrop-blur">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">
                Flujo recomendado
              </p>
              <div className="mt-6 grid gap-4">
                <div className="rounded-2xl bg-[#faf7ff] p-4">
                  <p className="text-sm font-bold" style={{ color: BRAND }}>
                    1. Landing principal
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    La raíz `/` presenta el producto, onboarding, registro y acceso institucional.
                  </p>
                </div>
                <div className="rounded-2xl bg-[#fff6fb] p-4">
                  <p className="text-sm font-bold" style={{ color: BRAND }}>
                    2. Entrada por slug
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    `/{'{slug}'}` conserva la experiencia móvil-first de encuesta y acceso del tenant.
                  </p>
                </div>
                <div className="rounded-2xl bg-[#f8f8ff] p-4">
                  <p className="text-sm font-bold" style={{ color: BRAND }}>
                    3. Operación aislada
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    `/{'{slug}'}/admin`, `/{'{slug}'}/centro` y `/{'{slug}'}/diagnostico` viven ya dentro del tenant.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
