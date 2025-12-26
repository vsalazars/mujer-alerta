// src/components/legal/PrivacyNotice.tsx
"use client";

import { Separator } from "../ui/separator";
import { ShieldCheck } from "lucide-react";

const BRAND = "#7F017F";

export function PrivacyNotice() {
  return (
    <div className="max-h-[65dvh] overflow-y-auto pr-1">
      {/* Header interno */}
      <div className="flex items-center gap-3">
        <div
          className="grid h-9 w-9 place-items-center rounded-xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(127,1,127,0.15), rgba(190,24,93,0.12))",
            border: "1px solid rgba(2,6,23,0.06)",
          }}
        >
          <ShieldCheck className="h-5 w-5" style={{ color: BRAND }} />
        </div>

        <div>
          <p className="text-sm font-black" style={{ color: BRAND }}>
            Aviso de Privacidad
          </p>
          <p className="text-[11px] text-slate-500">
            Última actualización: diciembre 2025
          </p>
        </div>
      </div>

      <Separator className="my-4" />

      {/* Contenido */}
      <div className="space-y-4 text-sm leading-6 text-slate-700">
        <p>
          <strong>Mujer Alerta</strong> es un instrumento tecnológico de diagnóstico
          desarrollado con fines académicos, preventivos y de análisis institucional,
          orientado a identificar percepciones del entorno relacionadas con violencia
          contra las mujeres en contextos escolares y laborales.
        </p>

        <section>
          <h4 className="font-black text-slate-900">
            1. Responsable del tratamiento
          </h4>
          <p className="mt-1">
            El responsable del tratamiento de la información es el equipo desarrollador
            del proyecto <strong>Mujer Alerta</strong>, vinculado a actividades de
            investigación del Instituto Politécnico Nacional (IPN).
          </p>
        </section>

        <section>
          <h4 className="font-black text-slate-900">
            2. Datos recabados
          </h4>
          <p className="mt-1">
            Esta plataforma <strong>no recaba datos personales sensibles</strong>.
            Las respuestas corresponden exclusivamente a la percepción del entorno
            y no a experiencias personales identificables.
          </p>
          <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">
            <li>Respuestas anónimas a reactivos tipo Likert</li>
            <li>Información contextual agregada (centro, año)</li>
            <li>No se solicita nombre, domicilio, teléfono ni datos biométricos</li>
          </ul>
        </section>

        <section>
          <h4 className="font-black text-slate-900">
            3. Finalidad del uso de la información
          </h4>
          <p className="mt-1">
            La información recabada se utiliza exclusivamente para:
          </p>
          <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">
            <li>Análisis estadístico agregado</li>
            <li>Identificación de patrones de riesgo</li>
            <li>Apoyo a estrategias de prevención y atención temprana</li>
            <li>Investigación académica y toma de decisiones institucionales</li>
          </ul>
        </section>

        <section>
          <h4 className="font-black text-slate-900">
            4. Confidencialidad y anonimato
          </h4>
          <p className="mt-1">
            Todas las respuestas son tratadas de forma confidencial y se presentan
            únicamente en resultados agregados. No es posible identificar a una
            persona a partir de la información almacenada.
          </p>
        </section>

        <section>
          <h4 className="font-black text-slate-900">
            5. Conservación de la información
          </h4>
          <p className="mt-1">
            Los datos se conservan únicamente durante el tiempo necesario para
            cumplir con los fines analíticos y académicos del proyecto.
          </p>
        </section>

        <section>
          <h4 className="font-black text-slate-900">
            6. Marco normativo
          </h4>
          <p className="mt-1">
            Este instrumento se alinea con la{" "}
            <strong>
              Ley General de Acceso de las Mujeres a una Vida Libre de Violencia
            </strong>{" "}
            y con principios de protección de datos personales aplicables en
            contextos académicos e institucionales.
          </p>
        </section>

        <section>
          <h4 className="font-black text-slate-900">
            7. Aceptación
          </h4>
          <p className="mt-1">
            Al utilizar esta plataforma y responder el diagnóstico, la persona
            usuaria manifiesta haber leído y comprendido el presente Aviso de
            Privacidad.
          </p>
        </section>

        <p className="pt-2 text-[11px] text-slate-500">
          Este aviso puede actualizarse para reflejar mejoras en el instrumento
          o cambios normativos.
        </p>
      </div>
    </div>
  );
}
