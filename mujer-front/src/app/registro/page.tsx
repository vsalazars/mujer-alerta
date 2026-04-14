import Link from "next/link";

import { Button } from "../../components/ui/button";

const BRAND = "#7F017F";

export default function RegistroPage() {
  return (
    <main className="min-h-dvh bg-[#f7f4ef] px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-white/80 bg-white/80 p-8 shadow-sm backdrop-blur">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-slate-500">
          Registro institucional
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight" style={{ color: BRAND }}>
          Onboarding de nuevas instituciones
        </h1>
        <p className="mt-4 text-base leading-8 text-slate-600">
          Aquí podemos dejar el flujo de alta para nuevas instituciones: solicitud de demo,
          validación, creación del tenant, configuración visual y activación de administradores.
        </p>
        <p className="mt-4 text-base leading-8 text-slate-600">
          Por ahora quedó como placeholder funcional para que la landing principal ya tenga su
          destino natural y no dependa de la pantalla pública del tenant.
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
    </main>
  );
}
