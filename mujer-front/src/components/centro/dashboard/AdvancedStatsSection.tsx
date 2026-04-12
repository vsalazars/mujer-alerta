import { Activity, RefreshCw, Sparkles } from "lucide-react";

import { PURPLE, fmt2, fmtInt, pctFrom5 } from "@/components/centro/dashboard/helpers";
import type { AdvRow } from "@/components/centro/dashboard/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type AdvancedStatsSectionProps = {
  year: string;
  advRows: AdvRow[];
  advLoading: boolean;
  advErr: string;
};

export function AdvancedStatsSection({
  year,
  advRows,
  advLoading,
  advErr,
}: AdvancedStatsSectionProps) {
  return (
    <Card className="rounded-[2rem] border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-black tracking-wide">
            Estadística aplicada (precisión y consistencia)
          </CardTitle>

          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="rounded-full font-black text-[10px] uppercase tracking-widest"
              style={{ background: "rgba(127,1,127,0.10)", color: PURPLE }}
            >
              IC 95% · σ · P25/P50/P75 · α
            </Badge>

            <Badge
              variant="secondary"
              className="rounded-full font-black text-[10px] uppercase tracking-widest"
              style={{ background: "rgba(2,6,23,0.04)", color: "#0f172a" }}
            >
              {year === "all" ? "Requiere año" : `Año ${year}`}
            </Badge>
            {advRows.length > 0 ? (
              <Badge
                variant="secondary"
                className="rounded-full font-black text-[10px] uppercase tracking-widest"
                style={{ background: "rgba(2,6,23,0.04)", color: "#0f172a" }}
              >
                {advRows[0]?.n_respuestas ?? 0} por dimensión ·{" "}
                {advRows[0]?.total_respuestas ?? 0} total · k={advRows[0]?.k_items ?? 0}
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Separator className="mb-5" />

        {year === "all" ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <span className="font-black" style={{ color: PURPLE }}>
              Selecciona un año
            </span>{" "}
            para calcular intervalos de confianza, percentiles y alpha de Cronbach.
          </div>
        ) : advLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 flex items-center gap-3">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Calculando estadística aplicada…
          </div>
        ) : advErr ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <span className="font-black">No se pudo cargar:</span> {advErr}
          </div>
        ) : advRows.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <span className="font-black" style={{ color: PURPLE }}>
              Sin datos
            </span>{" "}
            para estadística aplicada en el año seleccionado.
          </div>
        ) : (
          <>
            <div className="mb-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4" style={{ color: PURPLE }} />
                  <p className="text-xs font-black tracking-wide text-slate-700">IC 95%</p>
                </div>
                <p className="mt-2 text-[12px] leading-5 text-slate-600 font-semibold">
                  Rango esperado del promedio. Entre más estrecho,{" "}
                  <span className="font-black">más precisión</span>.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" style={{ color: PURPLE }} />
                  <p className="text-xs font-black tracking-wide text-slate-700">Dispersión (σ)</p>
                </div>
                <p className="mt-2 text-[12px] leading-5 text-slate-600 font-semibold">
                  Mide variabilidad: σ alta implica percepciones muy distintas.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" style={{ color: PURPLE }} />
                  <p className="text-xs font-black tracking-wide text-slate-700">
                    Consistencia (α)
                  </p>
                </div>
                <p className="mt-2 text-[12px] leading-5 text-slate-600 font-semibold">
                  Alpha de Cronbach: <span className="font-black">≥ 0.70</span> suele considerarse
                  aceptable.
                </p>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-[980px] w-full text-left">
                  <thead className="bg-[rgba(127,1,127,0.06)]">
                    <tr className="text-[11px] uppercase tracking-widest text-slate-700">
                      <th className="px-4 py-3 font-black">Dimensión</th>
                      <th className="px-4 py-3 font-black">n encuestas</th>
                      <th className="px-4 py-3 font-black">n respuestas</th>
                      <th className="px-4 py-3 font-black">Prom</th>
                      <th className="px-4 py-3 font-black">
                        <span className="normal-case">σ</span> <span className="uppercase">(ítems)</span>
                      </th>
                      <th className="px-4 py-3 font-black">Mediana</th>
                      <th className="px-4 py-3 font-black">P25</th>
                      <th className="px-4 py-3 font-black">P75</th>
                      <th className="px-4 py-3 font-black">IC 95% (ítems / encuestas)</th>
                      <th className="px-4 py-3 font-black">α</th>
                      <th className="px-4 py-3 font-black">k</th>
                      <th className="px-4 py-3 font-black">
                        <span className="normal-case">σ</span>{" "}
                        <span className="uppercase">(encuestas)</span>
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {advRows.map((row) => {
                      const dimLabel =
                        row.dimension === "frecuencia"
                          ? "Frecuencia"
                          : row.dimension === "normalidad"
                            ? "Normalización"
                            : row.dimension === "gravedad"
                              ? "Gravedad"
                              : row.dimension;

                      const alpha = Number(row.alpha_cronbach ?? 0);
                      const alphaBadge =
                        alpha >= 0.8
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : alpha >= 0.7
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : "bg-slate-50 text-slate-700 border border-slate-200";

                      return (
                        <tr key={row.dimension} className="border-t border-slate-200">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-flex h-2.5 w-2.5 rounded-full"
                                style={{ background: PURPLE }}
                              />
                              <span className="font-black text-slate-900">{dimLabel}</span>
                            </div>
                            <div className="mt-1 text-[11px] font-semibold text-slate-500">
                              {pctFrom5(row.promedio)}% · {fmt2(row.promedio)} / 5
                            </div>
                          </td>

                          <td className="px-4 py-3 text-sm font-black text-slate-900">
                            {fmtInt(row.n_encuestas)}
                          </td>

                          <td className="px-4 py-3 text-sm font-black text-slate-900">
                            {fmtInt(row.n_respuestas)}
                          </td>

                          <td className="px-4 py-3 text-sm font-black" style={{ color: PURPLE }}>
                            {Number(row.promedio ?? 0).toFixed(2)}
                          </td>

                          <td className="px-4 py-3 text-sm font-black text-slate-900">
                            {Number(row.std_dev ?? 0).toFixed(2)}
                          </td>

                          <td className="px-4 py-3 text-sm font-black text-slate-900">
                            {Number(row.mediana ?? 0).toFixed(2)}
                          </td>

                          <td className="px-4 py-3 text-sm font-black text-slate-900">
                            {Number(row.p25 ?? 0).toFixed(2)}
                          </td>

                          <td className="px-4 py-3 text-sm font-black text-slate-900">
                            {Number(row.p75 ?? 0).toFixed(2)}
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-2">
                              <div
                                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black"
                                style={{
                                  background: "rgba(127,1,127,0.10)",
                                  color: PURPLE,
                                  border: "1px solid rgba(127,1,127,0.20)",
                                }}
                                title="IC 95% calculado por ítems (n = n_respuestas)"
                              >
                                {Number(row.ic95_inferior ?? 0).toFixed(2)} –{" "}
                                {Number(row.ic95_superior ?? 0).toFixed(2)}
                                <span className="opacity-70">· ítems</span>
                              </div>

                              <div
                                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black"
                                style={{
                                  background: "rgba(2,6,23,0.04)",
                                  color: "#0f172a",
                                  border: "1px solid rgba(2,6,23,0.10)",
                                }}
                                title="IC 95% conservador calculado entre encuestas (n = n_encuestas)"
                              >
                                {Number(row.ic95_inferior_encuestas ?? 0).toFixed(2)} –{" "}
                                {Number(row.ic95_superior_encuestas ?? 0).toFixed(2)}
                                <span className="opacity-70">· encuestas</span>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black ${alphaBadge}`}
                            >
                              {alpha.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-black text-slate-900">
                            {row.k_items ?? 0}
                          </td>

                          <td className="px-4 py-3 text-sm font-black text-slate-900">
                            {Number(row.std_dev_encuestas ?? 0).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-200 bg-white px-4 py-3 text-[12px] text-slate-600">
                <span className="font-black" style={{ color: PURPLE }}>
                  Nota:
                </span>{" "}
                IC 95% calculado con aproximación normal (1.96·σ/√n). Percentiles (P25, mediana y
                P75). Alpha por dimensión.
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
