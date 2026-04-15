import { RefreshCw } from "lucide-react";

import {
  BRAND_BORDER,
  BRAND_SECONDARY,
  BRAND_SOFT,
  BRAND_SUPPORT_SOFT,
  PURPLE,
  clamp5,
  consistencyTag,
  dimPretty,
  fmt2,
  pctFrom5,
  pickDim,
  precisionTagByCI,
  variabilityTag,
} from "@/components/centro/dashboard/helpers";
import type { AdvRow } from "@/components/centro/dashboard/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type ExecutiveSummarySectionProps = {
  year: string;
  advRows: AdvRow[];
  advLoading: boolean;
  advErr: string;
};

export function ExecutiveSummarySection({
  year,
  advRows,
  advLoading,
  advErr,
}: ExecutiveSummarySectionProps) {
  return (
    <Card className="rounded-[2rem] border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-black tracking-wide">
              Resultados ejecutivos dinámicos
            </CardTitle>
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end">
            <Badge
              variant="secondary"
              className="rounded-full font-black text-[10px] uppercase tracking-widest"
              style={{ background: BRAND_SOFT, color: PURPLE }}
            >
              Resumen ejecutivo
            </Badge>

            <Badge
              variant="secondary"
              className="rounded-full font-black text-[10px] uppercase tracking-widest"
              style={{ background: "rgba(2,6,23,0.04)", color: "#0f172a" }}
            >
              {year === "all" ? "Selecciona año" : `Año ${year}`}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Separator className="mb-5" />

        {year === "all" ? (
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <span className="font-black" style={{ color: PURPLE }}>
              Selecciona un año
            </span>{" "}
            para generar el resumen ejecutivo.
          </div>
        ) : advLoading ? (
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 text-sm text-slate-600 flex items-center gap-3">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Preparando resumen…
          </div>
        ) : advErr ? (
          <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <span className="font-black">No se pudo cargar:</span> {advErr}
          </div>
        ) : advRows.length === 0 ? (
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <span className="font-black" style={{ color: PURPLE }}>
              Sin datos
            </span>{" "}
            para resumen ejecutivo.
          </div>
        ) : (
          <ExecutiveSummaryContent advRows={advRows} />
        )}
      </CardContent>
    </Card>
  );
}

function ExecutiveSummaryContent({ advRows }: { advRows: AdvRow[] }) {
  const frecuencia = pickDim(advRows, "frecuencia");
  const normalidad = pickDim(advRows, "normalidad");
  const gravedad = pickDim(advRows, "gravedad");

  const rows = [frecuencia, normalidad, gravedad].filter(Boolean) as AdvRow[];
  const meta = advRows[0];

  function consensoHumano(stdDevItems: number) {
    const value = variabilityTag(stdDevItems);
    if (value === "Baja") return "Alto consenso";
    if (value === "Moderada") return "Consenso moderado";
    return "Opiniones divididas";
  }

  function solidezHumana(ciInfEnc: number, ciSupEnc: number) {
    const value = precisionTagByCI(ciInfEnc, ciSupEnc);
    if (value === "Alta") return "Alta";
    if (value === "Moderada") return "Moderada";
    return "En observación";
  }

  function confiabilidadHumana(alpha: number) {
    const value = consistencyTag(alpha);
    if (value === "Muy alta") return "Muy alta";
    if (value === "Alta") return "Alta";
    if (value === "Aceptable") return "Adecuada";
    return "Baja";
  }

  function riskBandByMean(mean: number): "Bajo" | "Medio" | "Alto" {
    const value = clamp5(mean);
    if (value < 2.5) return "Bajo";
    if (value < 3.5) return "Medio";
    return "Alto";
  }

  function chipStyle(band: "Bajo" | "Medio" | "Alto") {
    if (band === "Alto") {
      return {
        bg: BRAND_SUPPORT_SOFT,
        fg: PURPLE,
        bd: BRAND_BORDER,
        dot: PURPLE,
        glow: `0 0 0 6px ${BRAND_SOFT}`,
      };
    }
    if (band === "Medio") {
      return {
        bg: BRAND_SOFT,
        fg: PURPLE,
        bd: BRAND_BORDER,
        dot: BRAND_SECONDARY,
        glow: `0 0 0 6px ${BRAND_SOFT}`,
      };
    }
    return {
      bg: "rgba(2,6,23,0.04)",
      fg: "#0f172a",
      bd: "rgba(2,6,23,0.10)",
      dot: "rgba(2,6,23,0.40)",
      glow: "0 0 0 6px rgba(2,6,23,0.03)",
    };
  }

  const highG = gravedad && clamp5(gravedad.promedio) >= 3.5;
  const highN = normalidad && clamp5(normalidad.promedio) >= 3.5;
  const nearHighF = frecuencia && clamp5(frecuencia.promedio) >= 3.25;

  const headline =
    highG && highN
      ? "Gravedad y normalización altas: patrón severo y percibido como habitual."
      : highG
        ? "Gravedad alta: requiere atención prioritaria."
        : highN
          ? "Normalización alta: requiere intervención cultural."
          : nearHighF
            ? "Frecuencia medio-alta: reforzar monitoreo y prevención."
            : "Resultados en rango bajo–medio: mantener vigilancia y canales de reporte.";

  const actions: string[] = [];
  if (highG) {
    actions.push("Activar/fortalecer rutas de canalización y respuesta (protocolos y seguimiento).");
  }
  if (highN) {
    actions.push("Intervención cultural: sensibilización, comunicación y tolerancia cero.");
  }
  if (nearHighF || (frecuencia && clamp5(frecuencia.promedio) >= 3.0)) {
    actions.push("Refuerzo preventivo: presencia, difusión de canales y monitoreo periódico.");
  }

  const anyDivided = rows.some((row) => consensoHumano(row.std_dev) === "Opiniones divididas");
  if (anyDivided) {
    actions.push("Revisar diferencias entre grupos o áreas: no todas las personas reportan lo mismo.");
  }

  const anyObs = rows.some(
    (row) => solidezHumana(row.ic95_inferior_encuestas, row.ic95_superior_encuestas) === "En observación"
  );
  if (anyObs) {
    actions.push("Aumentar encuestas para fortalecer la solidez por participantes.");
  }

  if (actions.length === 0) {
    actions.push("Mantener monitoreo anual y reforzar cultura de reporte.");
  }

  const alphas = rows
    .map((row) => Number(row.alpha_cronbach ?? 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  const alphaAvg = alphas.length ? alphas.reduce((a, b) => a + b, 0) / alphas.length : 0;
  const confiabGlobal = alphaAvg ? confiabilidadHumana(alphaAvg) : "Alta";

  return (
    <>
      <div className="mb-5 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white">
        <div
          className="h-2 w-full"
          style={{
            background:
              "linear-gradient(90deg, var(--brand-primary, #7F017F), var(--brand-secondary, #C23C9A), rgba(2,6,23,0.04))",
          }}
        />

        <div className="p-5">
          <div className="grid gap-3 md:grid-cols-[1fr,320px]">
            <div
              className="rounded-[1.5rem] border border-slate-200 p-5"
              style={{
                background:
                  "radial-gradient(900px_circle_at_0%_0%, var(--brand-soft, rgba(127,1,127,0.10)), transparent 55%)",
              }}
            >
              <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: PURPLE }}>
                Síntesis
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-900 font-semibold">{headline}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {meta ? (
                  <Badge
                    variant="secondary"
                    className="rounded-full px-3 py-1 font-black text-[11px]"
                    style={{ background: "rgba(2,6,23,0.04)", color: "#0f172a" }}
                    title="Tamaño del levantamiento del año"
                  >
                    Muestra: {meta.n_encuestas} participantes
                  </Badge>
                ) : null}

                <Badge
                  variant="secondary"
                  className="rounded-full px-3 py-1 font-black text-[11px]"
                  style={{ background: "rgba(2,6,23,0.04)", color: "#0f172a" }}
                  title="Calidad general de la medición"
                >
                  Confiabilidad: {confiabGlobal}
                </Badge>

                {meta ? (
                  <Badge
                    variant="secondary"
                    className="rounded-full px-3 py-1 font-black text-[11px]"
                    style={{ background: "rgba(2,6,23,0.04)", color: "#0f172a" }}
                    title="Volumen de información capturada"
                  >
                    Datos: {meta.total_respuestas} respuestas
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">
                Acciones sugeridas
              </p>

              <div className="mt-3 space-y-2">
                {actions.slice(0, 4).map((action, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span
                      className="mt-1 inline-flex h-2 w-2 rounded-full"
                      style={{ background: PURPLE, boxShadow: `0 0 0 6px ${BRAND_SOFT}` }}
                    />
                    <p className="text-xs font-semibold text-slate-700 leading-5">{action}</p>
                  </div>
                ))}
                {actions.length > 4 ? (
                  <p className="pt-1 text-[11px] font-black text-slate-500">
                    +{actions.length - 4} acciones adicionales sugeridas
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {rows.map((row) => {
          const dim = String(row.dimension);
          const pretty = dimPretty(dim);
          const riskBand = riskBandByMean(row.promedio);
          const style = chipStyle(riskBand);
          const consenso = consensoHumano(row.std_dev);
          const solidez = solidezHumana(row.ic95_inferior_encuestas, row.ic95_superior_encuestas);
          const conf = confiabilidadHumana(row.alpha_cronbach);

          const implies =
            riskBand === "Alto"
              ? "Priorizar atención y seguimiento."
              : riskBand === "Medio"
                ? "Reforzar prevención y monitoreo."
                : "Mantener vigilancia y cultura de reporte.";

          const implies2 =
            consenso === "Opiniones divididas"
              ? "Puede haber focos específicos (diferencias por grupo/área)."
              : consenso === "Consenso moderado"
                ? "Patrón relativamente estable."
                : "Percepción homogénea.";

          const implies3 =
            solidez === "En observación"
              ? "Con más participantes, el mensaje se vuelve más sólido."
              : solidez === "Moderada"
                ? "Mensaje suficientemente estable para lectura institucional."
                : "Mensaje muy estable con la muestra actual.";

          return (
            <div
              key={dim}
              className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ background: PURPLE }} />
                  <div>
                    <p className="font-black text-slate-900">{pretty}</p>
                    <p className="text-[11px] font-semibold text-slate-500">
                      {pctFrom5(row.promedio)}% · {fmt2(row.promedio)} / 5
                    </p>
                  </div>
                </div>

                <div
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest"
                  style={{
                    background: style.bg,
                    color: style.fg,
                    border: `1px solid ${style.bd}`,
                    boxShadow: style.glow,
                  }}
                  title="Semáforo ejecutivo"
                >
                  <span className="inline-flex h-2 w-2 rounded-full" style={{ background: style.dot }} />
                  {riskBand}
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Consenso del grupo
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-900">{consenso}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Solidez con la muestra actual
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-900">{solidez}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4" style={{ background: BRAND_SOFT }}>
                  <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: PURPLE }}>
                    Confiabilidad de la medición
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-900">{conf}</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 p-4" style={{ background: BRAND_SOFT }}>
                <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: PURPLE }}>
                  Qué significa
                </p>
                <div className="mt-2 space-y-2 text-xs font-semibold text-slate-700 leading-5">
                  <p>• {implies}</p>
                  <p>• {implies2}</p>
                  <p>• {implies3}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-white p-4 text-[11px] font-semibold text-slate-600 leading-5">
        <span className="font-black" style={{ color: PURPLE }}>
          Nota ejecutiva:
        </span>{" "}
        Esta lectura resume <span className="font-black">nivel</span>,{" "}
        <span className="font-black">consenso</span> y <span className="font-black">solidez</span>.
        Los detalles técnicos permanecen en “Estadística aplicada”.
      </div>
    </>
  );
}
