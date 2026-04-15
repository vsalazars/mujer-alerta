import {
  Activity,
  CircleHelp,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import {
  BRAND_BORDER,
  BRAND_SOFT,
  PURPLE,
  fmt2,
  fmtInt,
  pctFrom5,
} from "@/components/centro/dashboard/helpers";
import type { AdvRow } from "@/components/centro/dashboard/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type AdvancedStatsSectionProps = {
  year: string;
  advRows: AdvRow[];
  advLoading: boolean;
  advErr: string;
};

// ---------------------------------------------------------------------------
// Helpers de formato
// ---------------------------------------------------------------------------

function f2(v: unknown) {
  return Number(v ?? 0).toFixed(2);
}

function alphaClass(alpha: number) {
  if (alpha >= 0.8) return "border border-emerald-200 bg-emerald-50 text-emerald-700";
  if (alpha >= 0.7) return "border border-amber-200 bg-amber-50 text-amber-800";
  return "border border-slate-200 bg-slate-50 text-slate-700";
}

function dimLabel(dim: string) {
  return (
    { frecuencia: "Frecuencia", normalidad: "Normalización", gravedad: "Gravedad" }[dim] ?? dim
  );
}

// ---------------------------------------------------------------------------
// Tooltip de cabecera — reutilizable
// ---------------------------------------------------------------------------

type HelpInfo = {
  what: string;   // qué es
  how: string;    // cómo se calcula
  why: string;    // para qué sirve
};

const COL_HELP: Record<string, HelpInfo> = {
  prom: {
    what: "Promedio de todos los ítems de la dimensión.",
    how:  "Suma de respuestas ÷ número de respuestas.",
    why:  "Resume el valor central observado en la dimensión.",
  },
  sigma_items: {
    what: "Desviación estándar de respuestas individuales.",
    how:  "Raíz cuadrada de la varianza de todas las respuestas.",
    why:  "σ alta → percepciones muy dispares entre participantes.",
  },
  mediana: {
    what: "Valor que divide la distribución al 50%.",
    how:  "Respuesta central al ordenar todas las respuestas.",
    why:  "Menos sensible a valores extremos que el promedio.",
  },
  p25: {
    what: "Percentil 25 — primer cuartil.",
    how:  "25% de las respuestas queda en o por debajo de este valor.",
    why:  "Acota el rango bajo de la distribución.",
  },
  p75: {
    what: "Percentil 75 — tercer cuartil.",
    how:  "75% de las respuestas queda en o por debajo de este valor.",
    why:  "Acota el rango alto; junto con P25 forma el rango intercuartil.",
  },
  ic_items: {
    what: "Intervalo de confianza 95% calculado sobre respuestas individuales.",
    how:  "Prom ± 1.96 · σ / √n_respuestas",
    why:  "Entre más estrecho, más precisa la estimación del promedio.",
  },
  ic_encuestas: {
    what: "Intervalo de confianza 95% calculado entre promedios por encuesta.",
    how:  "Prom ± 1.96 · σ_encuestas / √n_encuestas",
    why:  "Controla el efecto de agrupación por encuestado.",
  },
  alpha: {
    what: "Alpha de Cronbach — consistencia interna de los ítems.",
    how:  "α = (k/(k-1)) · (1 − Σσ²_i / σ²_total)",
    why:  "α ≥ 0.70 aceptable · α ≥ 0.80 bueno · α ≥ 0.90 excelente.",
  },
  k: {
    what: "Número de ítems incluidos en la dimensión.",
    how:  "Conteo de preguntas agrupadas bajo esta dimensión.",
    why:  "A mayor k, más robusto el alpha de Cronbach.",
  },
  sigma_enc: {
    what: "Desviación estándar entre promedios por encuesta.",
    how:  "Std de la distribución de promedios individuales.",
    why:  "Indica cuánto varía la percepción promedio entre personas.",
  },
};

function ColHelp({ id, label }: { id: string; label: string }) {
  const h = COL_HELP[id];
  return (
    <div className="flex items-center gap-1">
      <span>{label}</span>
      {h && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full opacity-60 transition-opacity hover:opacity-100"
              aria-label={`Ayuda: ${label}`}
            >
              <CircleHelp className="h-3.5 w-3.5" style={{ color: PURPLE }} />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            align="center"
            sideOffset={8}
            collisionPadding={16}
            className="z-50 w-56 whitespace-normal rounded-xl border-0 px-3 py-2.5 text-[11px] font-medium leading-5 text-white shadow-xl"
            style={{ background: PURPLE }}
          >
            <p className="font-black">{h.what}</p>
            <p className="mt-1 opacity-80">
              <span className="font-black not-italic">Cálculo:</span> {h.how}
            </p>
            <p className="mt-1 opacity-80">
              <span className="font-black not-italic">Interpretación:</span> {h.why}
            </p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Leyenda de métricas (3 tarjetas superiores)
// ---------------------------------------------------------------------------

function LegendCards() {
  return (
    <div className="mb-5 grid gap-3 md:grid-cols-3">
      {[
        {
          icon: <Activity className="h-4 w-4" style={{ color: PURPLE }} />,
          title: "IC 95%",
          body: (
            <>
              Rango probable del promedio real. Un IC estrecho indica{" "}
              <strong>mayor precisión</strong>. Se calcula con{" "}
              <code className="rounded bg-slate-100 px-1 text-[10px]">± 1.96 · σ / √n</code>.
            </>
          ),
        },
        {
          icon: <Sparkles className="h-4 w-4" style={{ color: PURPLE }} />,
          title: "Dispersión (σ)",
          body: (
            <>
              Mide qué tan distintas son las respuestas. σ alta implica{" "}
              <strong>percepciones muy dispares</strong> entre participantes.
            </>
          ),
        },
        {
          icon: <TrendingUp className="h-4 w-4" style={{ color: PURPLE }} />,
          title: "Consistencia (α)",
          body: (
            <>
              Alpha de Cronbach mide si los ítems miden lo mismo.{" "}
              <strong>≥ 0.70</strong> aceptable · <strong>≥ 0.80</strong> bueno ·{" "}
              <strong>≥ 0.90</strong> excelente.
            </>
          ),
        },
      ].map((c) => (
        <div key={c.title} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            {c.icon}
            <p className="text-xs font-black tracking-wide text-slate-700">{c.title}</p>
          </div>
          <p className="mt-2 text-[12px] font-semibold leading-5 text-slate-600">{c.body}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabla principal
// ---------------------------------------------------------------------------

function StatsTable({ rows }: { rows: AdvRow[] }) {
  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[780px] text-left text-[12px]">
          <thead style={{ background: BRAND_SOFT }}>
            <tr className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
              <th className="px-4 py-3">Dimensión</th>
              <th className="px-3 py-3 text-right">
                <ColHelp id="prom" label="Prom" />
              </th>
              <th className="px-3 py-3 text-right">
                <ColHelp id="sigma_items" label="σ ítems" />
              </th>
              <th className="px-3 py-3 text-right">
                <ColHelp id="mediana" label="Mediana" />
              </th>
              <th className="px-3 py-3 text-right">
                <ColHelp id="p25" label="P25" />
              </th>
              <th className="px-3 py-3 text-right">
                <ColHelp id="p75" label="P75" />
              </th>
              <th className="px-3 py-3">
                <ColHelp id="ic_items" label="IC 95% ítems" />
              </th>
              <th className="px-3 py-3">
                <ColHelp id="ic_encuestas" label="IC 95% encuestas" />
              </th>
              <th className="px-3 py-3 text-center">
                <ColHelp id="alpha" label="α" />
              </th>
              <th className="px-3 py-3 text-right">
                <ColHelp id="k" label="k" />
              </th>
              <th className="px-3 py-3 text-right">
                <ColHelp id="sigma_enc" label="σ enc" />
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const alpha = Number(row.alpha_cronbach ?? 0);
              return (
                <tr
                  key={row.dimension}
                  className="border-t border-slate-100 align-middle transition-colors hover:bg-slate-50/60"
                >
                  {/* Dimensión */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ background: PURPLE }}
                      />
                      <div>
                        <div className="font-black text-slate-900">{dimLabel(row.dimension)}</div>
                        <div className="text-[11px] font-semibold text-slate-400">
                          {pctFrom5(row.promedio)}% · {fmt2(row.promedio)} / 5 ·{" "}
                          {fmtInt(row.n_encuestas)} encuestas
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Promedio */}
                  <td className="px-3 py-3 text-right font-black" style={{ color: PURPLE }}>
                    {f2(row.promedio)}
                  </td>

                  {/* σ ítems */}
                  <td className="px-3 py-3 text-right font-black text-slate-700">
                    {f2(row.std_dev)}
                  </td>

                  {/* Mediana */}
                  <td className="px-3 py-3 text-right font-black text-slate-700">
                    {f2(row.mediana)}
                  </td>

                  {/* P25 */}
                  <td className="px-3 py-3 text-right font-black text-slate-700">
                    {f2(row.p25)}
                  </td>

                  {/* P75 */}
                  <td className="px-3 py-3 text-right font-black text-slate-700">
                    {f2(row.p75)}
                  </td>

                  {/* IC 95% ítems */}
                  <td className="px-3 py-3">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black"
                      style={{
                        background: BRAND_SOFT,
                        color: PURPLE,
                        border: `0.5px solid ${BRAND_BORDER}`,
                      }}
                    >
                      {f2(row.ic95_inferior)} – {f2(row.ic95_superior)}
                    </span>
                  </td>

                  {/* IC 95% encuestas */}
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black text-slate-600">
                      {f2(row.ic95_inferior_encuestas)} – {f2(row.ic95_superior_encuestas)}
                    </span>
                  </td>

                  {/* Alpha */}
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${alphaClass(alpha)}`}>
                      {alpha.toFixed(2)}
                    </span>
                  </td>

                  {/* k */}
                  <td className="px-3 py-3 text-right font-black text-slate-700">
                    {row.k_items ?? 0}
                  </td>

                  {/* σ encuestas */}
                  <td className="px-3 py-3 text-right font-black text-slate-700">
                    {f2(row.std_dev_encuestas)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-100 bg-white px-5 py-3 text-[11px] text-slate-500">
        <span className="font-black" style={{ color: PURPLE }}>Nota:</span>{" "}
        IC 95% con aproximación normal (1.96 · σ / √n). Percentiles P25, mediana y P75 calculados
        sobre respuestas individuales. Alpha de Cronbach por dimensión.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function AdvancedStatsSection({
  year,
  advRows,
  advLoading,
  advErr,
}: AdvancedStatsSectionProps) {
  return (
    <Card className="rounded-[2rem] border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <CardTitle className="text-sm font-black tracking-wide">
            Estadística aplicada (precisión y consistencia)
          </CardTitle>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className="rounded-full font-black text-[10px] uppercase tracking-widest"
              style={{ background: BRAND_SOFT, color: PURPLE }}
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
            {advRows.length > 0 && (
              <Badge
                variant="secondary"
                className="rounded-full font-black text-[10px] uppercase tracking-widest"
                style={{ background: "rgba(2,6,23,0.04)", color: "#0f172a" }}
              >
                {fmtInt(advRows[0]?.n_respuestas ?? 0)} por dimensión ·{" "}
                {fmtInt(advRows[0]?.total_respuestas ?? 0)} total · k=
                {advRows[0]?.k_items ?? 0}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Separator className="mb-5" />

        {year === "all" ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <span className="font-black" style={{ color: PURPLE }}>Selecciona un año</span>{" "}
            para calcular intervalos de confianza, percentiles y alpha de Cronbach.
          </div>
        ) : advLoading ? (
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Calculando estadística aplicada…
          </div>
        ) : advErr ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <span className="font-black">No se pudo cargar:</span> {advErr}
          </div>
        ) : advRows.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <span className="font-black" style={{ color: PURPLE }}>Sin datos</span>{" "}
            para estadística aplicada en el año seleccionado.
          </div>
        ) : (
          <TooltipProvider delayDuration={100}>
            <LegendCards />
            <StatsTable rows={advRows} />
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}
