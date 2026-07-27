import type { CSSProperties } from "react";
import { BrainCircuit, Play, RefreshCw } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { BRAND_SECONDARY, BRAND_SOFT, PURPLE, fmtInt, safeArr } from "@/components/centro/dashboard/helpers";
import type { CentroNLPOverviewResponse, NLPJobStatus } from "@/components/centro/dashboard/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type NLPProcessingSectionProps = {
  year: string;
  overview: CentroNLPOverviewResponse | null;
  loading: boolean;
  status: NLPJobStatus | null;
  processError: string;
  onProcess: () => void;
};

const SENTIMENT_COLORS = [PURPLE, BRAND_SECONDARY, "var(--brand-support, #EAD5F1)", "#e9d5ff"];
const EMOTION_COLORS = ["#7F017F", "#0f766e", "#d97706", "#2563eb", "#f59e0b", "#475569", "#cbd5e1"];
const SENTIMENT_COLOR_BY_KEY: Record<string, string> = {
  negativo: PURPLE,
  neutral: "#a855f7",
  positivo: "#14b8a6",
  sin_clasificar: "#cbd5e1",
};

export function NLPProcessingSection({
  year,
  overview,
  loading,
  status,
  processError,
  onProcess,
}: NLPProcessingSectionProps) {
  const pending = overview?.total_pendientes ?? 0;
  const processing = Boolean(status?.running);
  const batchTotal = status?.total ?? 0;
  const batchCurrent = Math.min(status?.current ?? 0, batchTotal || Number.MAX_SAFE_INTEGER);
  const progressValue = processing
    ? batchTotal > 0
      ? (batchCurrent / batchTotal) * 100
      : 0
    : Math.max(overview?.avance_porcentaje ?? 0, pending === 0 ? 100 : 0);

  const temas = buildThemeCards(overview);

  const totalComentarios = overview?.total_comentarios ?? 0;
  const procesados = overview?.total_procesados ?? 0;
  const procesadosTexto = `${fmtInt(procesados)} de ${fmtInt(totalComentarios)}`;
  const progresoBatchTexto =
    batchTotal > 0
      ? `${fmtInt(batchCurrent)} de ${fmtInt(batchTotal)}`
      : status?.last_event === "loading-models"
        ? "Cargando modelos..."
        : status?.last_event === "fetching-comments"
          ? "Buscando comentarios..."
          : "Preparando lote...";
  const processButtonStyle = {
    "--ring": "var(--brand-primary, #7F017F)",
    background:
      "linear-gradient(135deg, var(--brand-primary, #7F017F), var(--brand-secondary, #C23C9A))",
    color: "#ffffff",
    boxShadow: "0 14px 32px var(--brand-glow, rgba(127,1,127,0.16))",
  } as CSSProperties;

  return (
    <Card className="rounded-[2rem] border-slate-200 shadow-sm overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-4 w-4" style={{ color: PURPLE }} />
              <CardTitle className="text-sm font-black tracking-wide">
                Procesamiento PNL de comentarios
              </CardTitle>
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              Ejecuta el análisis de comentarios pendientes, revisa el avance y consulta la
              distribución por sentimiento, emoción y tema.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end">
            <Badge
              variant="secondary"
              className="rounded-full font-black text-[10px] uppercase tracking-widest"
              style={{ background: BRAND_SOFT, color: PURPLE }}
            >
              {year === "all" ? "Historico" : `Año ${year}`}
            </Badge>
            <Badge
              variant="secondary"
              className="rounded-full font-black text-[10px] uppercase tracking-widest"
              style={{ background: "rgba(2,6,23,0.04)", color: "#0f172a" }}
            >
              {fmtInt(overview?.total_comentarios ?? 0)} comentarios
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Separator className="mb-5" />

        <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Cola de procesamiento
                </p>
                <p className="mt-2 text-3xl font-black text-slate-900">
                  {fmtInt(pending)} pendientes
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-600">
                  {processing
                    ? `Procesando comentarios ${progresoBatchTexto} en tiempo real.`
                    : pending > 0
                      ? "Hay comentarios listos para procesar."
                      : "No hay comentarios pendientes por procesar."}
                </p>
              </div>

              <Button
                type="button"
                className="rounded-2xl border-0 px-5 py-6 text-sm font-black disabled:opacity-60"
                style={processButtonStyle}
                onClick={onProcess}
                disabled={loading || processing || pending === 0}
              >
                {processing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Procesar {fmtInt(pending)} comentarios
                  </>
                )}
              </Button>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                <span>Avance</span>

                <div className="flex items-center gap-3">
                  <span className="normal-case tracking-normal text-slate-600 font-semibold">
                    {processing ? progresoBatchTexto : procesadosTexto}
                  </span>

                  <span>{Math.round(progressValue)}%</span>
                </div>
              </div>

              <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(0, Math.min(100, progressValue))}%`,
                    background:
                      "linear-gradient(90deg, var(--brand-primary, #7F017F), var(--brand-secondary, #C23C9A))",
                  }}
                />
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <MetricCard label="Totales" value={fmtInt(overview?.total_comentarios ?? 0)} />
              <MetricCard label="Procesados" value={fmtInt(overview?.total_procesados ?? 0)} color={PURPLE} />
              <MetricCard label="Pendientes" value={fmtInt(pending)} color="#d97706" />
              <MetricCard label="Error" value={fmtInt(overview?.total_error ?? 0)} color="#dc2626" />
            </div>

            {loading ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                Cargando estado del procesamiento NLP...
              </div>
            ) : null}

            {processError ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {processError}
              </div>
            ) : null}
          </div>

          <div
            className="rounded-[1.75rem] border border-slate-200 p-5"
            style={{
              background:
                "radial-gradient(900px_circle_at_100%_0%, var(--brand-soft, rgba(127,1,127,0.10)), transparent 55%)",
            }}
          >
            <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: PURPLE }}>
              Temas del analisis
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {temas.map((tema) => (
                <div
                  key={tema.clave}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 min-h-[72px]"
                >
                  <span className="pr-3 text-sm font-semibold leading-5 text-slate-700">
                    {tema.etiqueta}
                  </span>
                  <Badge
                    variant="secondary"
                    className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest"
                    style={{ background: BRAND_SOFT, color: PURPLE }}
                  >
                    {fmtInt(tema.total)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <DonutCard
            title="Sentimiento"
            subtitle="Positivo, negativo y neutral"
            data={safeArr(overview?.por_sentimiento)}
            colors={SENTIMENT_COLORS}
            colorByKey={SENTIMENT_COLOR_BY_KEY}
          />
          <DonutCard
            title="Emocion"
            subtitle="Clasificacion de las emociones identificadas"
            data={safeArr(overview?.por_emocion)}
            colors={EMOTION_COLORS}
          />
        </div>

        
      </CardContent>
    </Card>
  );
}

function MetricCard({
  label,
  value,
  color = "#0f172a",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function DonutCard({
  title,
  subtitle,
  data,
  colors,
  colorByKey,
}: {
  title: string;
  subtitle: string;
  data: Array<{ clave: string; label: string; total: number }>;
  colors: string[];
  colorByKey?: Record<string, string>;
}) {
  const sortedData = [...data].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.label.localeCompare(b.label, "es");
  });
  const total = sortedData.reduce((acc, item) => acc + item.total, 0);

  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 lg:min-h-[420px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-900">{title}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{subtitle}</p>
        </div>
        <Badge
          variant="secondary"
          className="rounded-full font-black text-[10px] uppercase tracking-widest"
          style={{ background: "rgba(2,6,23,0.04)", color: "#0f172a" }}
        >
          {fmtInt(total)}
        </Badge>
      </div>

      <div className="mt-4 flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(320px,1.1fr)_minmax(0,0.9fr)] xl:items-start xl:gap-6">
        <div className="flex h-[280px] items-center justify-center sm:h-[300px] xl:h-[340px] xl:w-full">
          {total === 0 ? (
            <div className="flex h-full w-full items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm font-semibold text-slate-500">
              Sin datos
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                <Pie
                  data={sortedData}
                  dataKey="total"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={82}
                  outerRadius={132}
                  paddingAngle={2}
                  stroke="none"
                >
                  {sortedData.map((entry, index) => (
                    <Cell
                      key={entry.clave}
                      fill={colorByKey?.[entry.clave] ?? colors[index % colors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number | string | undefined) =>
                    fmtInt(typeof value === "number" ? value : Number(value || 0))
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid gap-3 xl:min-h-[340px] xl:content-center">
          {sortedData.map((item, index) => {
            const pct = total > 0 ? Math.round((item.total / total) * 100) : 0;
            return (
              <div
                key={item.clave}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="inline-flex h-3 w-3 shrink-0 rounded-full"
                    style={{
                      background: colorByKey?.[item.clave] ?? colors[index % colors.length],
                    }}
                  />
                  <span className="min-w-0 break-words text-[15px] font-semibold leading-5 text-slate-700">
                    {item.label}
                  </span>
                </div>
                <div className="shrink-0 text-right leading-tight">
                  <p className="text-base font-black text-slate-900">{fmtInt(item.total)}</p>
                  <p className="text-[11px] font-semibold" style={{ color: PURPLE }}>{pct}%</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function buildThemeCards(overview: CentroNLPOverviewResponse | null) {
  const totals = new Map(safeArr(overview?.por_tema).map((item) => [item.clave, item.total]));
  return safeArr(overview?.catalogo_temas).map((tema) => ({
    ...tema,
    total: totals.get(tema.clave) ?? 0,
  }));
}
