import { CheckCircle2, ScanSearch } from "lucide-react";

import { BRAND_BORDER, BRAND_SOFT, PURPLE, fmtInt } from "@/components/centro/dashboard/helpers";
import type { PreguntasInicialesDashboardResumen } from "@/components/centro/dashboard/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type InitialQuestionsSectionProps = {
  data: PreguntasInicialesDashboardResumen;
};

function pct(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  return `${Math.round(safe)}%`;
}

function constructLabel(questionId: string, index: number) {
  switch (questionId) {
    case "I1":
      return "Creencias de género";
    case "I2":
      return "Aula y proyectos";
    case "I3":
      return "Relación docente";
    case "I4":
      return "Servicios institucionales";
    default:
      return `Constructo ${index + 1}`;
  }
}

export function InitialQuestionsSection({ data }: InitialQuestionsSectionProps) {
  const preguntas = Array.isArray(data?.preguntas) ? data.preguntas : [];
  const hasData = preguntas.some((pregunta) => Number(pregunta?.total_respuestas || 0) > 0);
  const defaultTab = preguntas[0]?.pregunta_id || "I1";

  return (
    <Card className="rounded-[2rem] border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-black tracking-wide">
                Percepciones y creencias de género en el entorno escolar
              </CardTitle>
              <ScanSearch className="h-4 w-4" style={{ color: PURPLE }} />
            </div>
            
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className="rounded-full font-black text-[10px] uppercase tracking-widest"
              style={{ background: "var(--brand-soft, rgba(127,1,127,0.10))", color: PURPLE }}
            >
              Lectura global
            </Badge>
            <Badge className="rounded-full bg-white text-slate-700 border border-slate-200 font-black">
              {fmtInt(data?.total_respuestas || 0)} selecciones analizadas
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Separator className="mb-5" />

        {!hasData ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <span className="font-black" style={{ color: PURPLE }}>
              Sin datos todavia
            </span>{" "}
            para las preguntas iniciales en el periodo seleccionado.
          </div>
        ) : (
          <Tabs defaultValue={defaultTab} className="gap-5">
            <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-[1.5rem] bg-transparent p-0">
              {preguntas.map((pregunta, index) => (
                <TabsTrigger
                  key={pregunta.pregunta_id}
                  value={pregunta.pregunta_id}
                  className="h-auto flex-none rounded-full border px-4 py-2 text-xs font-black text-slate-700 shadow-sm transition-all border-[var(--brand-border,rgba(127,1,127,0.18))] bg-[color-mix(in_srgb,var(--brand-support,#EAD5F1)_24%,white)] data-[state=active]:border-[var(--brand-primary,#7F017F)] data-[state=active]:!bg-[var(--brand-primary,#7F017F)] data-[state=active]:text-white data-[state=active]:shadow-[0_14px_30px_rgba(15,23,42,0.16)]"
                >
                  {constructLabel(pregunta.pregunta_id, index)}
                </TabsTrigger>
              ))}
            </TabsList>

            {preguntas.map((pregunta, index) => (
              <TabsContent key={pregunta.pregunta_id} value={pregunta.pregunta_id}>
                <article
                  className="rounded-[1.75rem] border bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]"
                  style={{ borderColor: BRAND_BORDER }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p
                        className="text-[11px] font-black uppercase tracking-[0.22em]"
                        style={{ color: PURPLE }}
                      >
                        Constructo experiencial {index + 1}
                      </p>
                      <h3 className="mt-2 text-base font-black leading-6 text-slate-900">
                        {constructLabel(pregunta.pregunta_id, index)}
                      </h3>
                      <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
                        {pregunta.prompt}
                      </p>
                    </div>

                    <Badge className="rounded-full bg-white text-slate-700 border border-slate-200 font-black whitespace-nowrap">
                      {fmtInt(pregunta.total_respuestas)} respuestas
                    </Badge>
                  </div>

                  {pregunta.opcion_top_label ? (
                    <div
                      className="mt-5 rounded-2xl border px-4 py-4"
                      style={{
                        borderColor: BRAND_BORDER,
                        background:
                          "linear-gradient(135deg, color-mix(in srgb, var(--brand-primary, #7F017F) 10%, white), color-mix(in srgb, var(--brand-support, #EAD5F1) 38%, white))",
                      }}
                    >
                      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-600">
                        <CheckCircle2 className="h-4 w-4" style={{ color: PURPLE }} />
                        Opción más elegida
                      </div>
                      <p className="mt-3 text-sm font-bold leading-6 text-slate-900">
                        {pregunta.opcion_top_label}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        <Badge
                          className="rounded-full border font-black"
                          style={{
                            background: BRAND_SOFT,
                            color: PURPLE,
                            borderColor: BRAND_BORDER,
                          }}
                        >
                          {pct(pregunta.opcion_top_pct)}
                        </Badge>
                        <span className="font-semibold text-slate-600">
                          {fmtInt(pregunta.opcion_top_total)} respuestas
                        </span>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-5 space-y-3">
                    {pregunta.opciones.map((opcion) => (
                      <div key={opcion.opcion_id}>
                        <div className="mb-1 flex items-start justify-between gap-4">
                          <p className="text-sm leading-6 text-slate-700">{opcion.label}</p>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-black" style={{ color: PURPLE }}>
                              {pct(opcion.porcentaje)}
                            </p>
                            <p className="text-[11px] text-slate-500">{fmtInt(opcion.total)}</p>
                          </div>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(0, Math.min(100, opcion.porcentaje || 0))}%`,
                              background:
                                "linear-gradient(90deg, var(--brand-secondary, #C23C9A), var(--brand-primary, #7F017F))",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
