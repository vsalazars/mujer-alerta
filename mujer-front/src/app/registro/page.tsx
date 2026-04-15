import Link from "next/link";

import { RegistrationRequestForm } from "../../components/landing/RegistrationRequestForm";
import { Button } from "../../components/ui/button";

const BRAND = "#7F017F";

export default function RegistroPage() {
  return (
    <main className="min-h-dvh bg-[#f7f4ef] px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/80 bg-white/80 p-8 shadow-sm backdrop-blur">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.24em] text-slate-500">
              Registro institucional
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-tight" style={{ color: BRAND }}>
              Onboarding real de nuevas instituciones
            </h1>
            <p className="mt-4 text-base leading-8 text-slate-600">
              Este formulario ya registra una solicitud real en backend para revisar viabilidad,
              reservar slug, configurar branding y habilitar a la persona propietaria.
            </p>
            <p className="mt-4 text-base leading-8 text-slate-600">
              El alta no activa el tenant de inmediato: primero queda en revisión para evitar
              duplicados, validar datos de contacto y preparar la configuración inicial.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="rounded-full font-semibold" style={{ backgroundColor: BRAND }}>
                <Link href="/">Volver a la landing</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full font-semibold">
                <Link href="/institucion-demo-inicial">Ir al tenant demo</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <RegistrationRequestForm mode="page" />
          </div>
        </div>
      </div>
    </main>
  );
}
