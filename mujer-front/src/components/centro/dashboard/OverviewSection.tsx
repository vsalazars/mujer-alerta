import { Activity, ArrowUpRight, Radar as RadarIcon, Sigma, Users } from "lucide-react";

import { PURPLE, fmt2, fmtInt, pctFrom5, semanticBadgeClass5, semanticLevel5 } from "@/components/centro/dashboard/helpers";
import { RadarChart } from "@/components/centro/dashboard/charts";
import type { CentroResumenResponse } from "@/components/centro/dashboard/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type OverviewSectionProps = {
  data: CentroResumenResponse;
  showSemantic: boolean;
  radar: { keys: string[]; data: unknown[] } | null;
};

export function OverviewSection({ data, showSemantic, radar }: OverviewSectionProps) {
  const stats = data.stats;
  const kpis = [
    { label: "Frecuencia", value: data.global.frecuencia },
    { label: "Normalización", value: data.global.normalidad },
    { label: "Gravedad", value: data.global.gravedad },
    { label: "Total", value: data.global.total },
  ];

  return (
    <section className="grid gap-6 lg:grid-cols-12">
      <Card className="lg:col-span-7 rounded-[2rem] border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-black tracking-wide">
              Principales indicadores
            </CardTitle>
            <Badge
              variant="secondary"
              className="rounded-full font-black uppercase tracking-widest text-[10px]"
              style={{ background: "var(--brand-soft, rgba(127,1,127,0.10))", color: PURPLE }}
            >
              Resumen
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Separator className="mb-5" />

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 font-semibold">Participantes</p>
                <Users className="h-4 w-4" style={{ color: PURPLE }} />
              </div>
              <p className="mt-2 text-3xl font-black" style={{ color: PURPLE }}>
                {fmtInt(stats.total_participantes)}
              </p>
              <div className="mt-2 flex items-center gap-2 text-emerald-600 text-xs font-black">
                <ArrowUpRight className="h-4 w-4" />
                Activos
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 font-semibold">Respuestas</p>
                <Sigma className="h-4 w-4" style={{ color: PURPLE }} />
              </div>
              <p className="mt-2 text-3xl font-black" style={{ color: PURPLE }}>
                {fmtInt(stats.total_respuestas)}
              </p>
            </div>

            <div
              className="rounded-2xl border p-4 text-white"
              style={{
                borderColor: "transparent",
                background:
                  "linear-gradient(135deg, var(--brand-primary, #7F017F), var(--brand-secondary, #C23C9A))",
                boxShadow: "0 18px 50px var(--brand-glow, rgba(127,1,127,0.35))",
              }}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-300 font-semibold">Global</p>
                <Activity
                  className="h-4 w-4"
                  style={{
                    color:
                      "color-mix(in srgb, var(--brand-support, #EAD5F1) 65%, white)",
                  }}
                />
              </div>

              <p className="mt-2 text-3xl font-black text-white">{pctFrom5(data.global.total)}%</p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-white/10 text-white border border-white/15 font-black">
                  {fmt2(data.global.total)} / 5
                </Badge>

                {showSemantic ? (
                  <Badge className="rounded-full bg-white/10 text-white border border-white/15 font-black uppercase tracking-widest text-[11px]">
                    {semanticLevel5(data.global.total)}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-4">
            {kpis.map((kpi) => {
              const pct = pctFrom5(kpi.value);
              const semantic = semanticLevel5(kpi.value);
              return (
                <div
                  key={kpi.label}
                  className="rounded-2xl border border-slate-200 p-4"
                  style={{
                    background:
                      "linear-gradient(180deg, var(--brand-soft, rgba(127,1,127,0.08)), rgba(255,255,255,0.0))",
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-500 font-semibold">{kpi.label}</p>
                    {showSemantic ? (
                      <Badge
                        className={`rounded-full text-[10px] font-black ${semanticBadgeClass5(
                          semantic
                        )}`}
                      >
                        {semantic}
                      </Badge>
                    ) : null}
                  </div>

                  <p className="mt-2 text-3xl font-black" style={{ color: PURPLE }}>
                    {pct}%
                  </p>

                  <p className="mt-1 text-[11px] text-slate-500 font-semibold">
                    Promedio: <span className="font-black">{fmt2(kpi.value)}</span> / 5
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-5 rounded-[2rem] border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-black tracking-wide">
              Radar de vectores de violencia
            </CardTitle>
            <div className="flex items-center gap-2">
              <RadarIcon className="h-4 w-4" style={{ color: PURPLE }} />
              <Badge
                variant="secondary"
                className="rounded-full font-black text-[10px] uppercase tracking-widest"
                style={{ background: "var(--brand-soft, rgba(127,1,127,0.10))", color: PURPLE }}
              >
                Vectores
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Separator className="mb-5" />
          <div className="h-[380px]">
            <RadarChart radar={radar} />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
