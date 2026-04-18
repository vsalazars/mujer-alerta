"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { api } from "@/lib/api";
import { mixColors, normalizeBrandColor, withAlpha } from "@/lib/branding";
import { toast } from "sonner";

// ✅ Nivo Bar (SSR off)
const ResponsiveBar = dynamic(
  () => import("@nivo/bar").then((m) => m.ResponsiveBar),
  { ssr: false }
);

// ✅ criterio de color para Δ pp (ruido vs cambio real)
const DELTA_EPS_PP = 0.5;

type YearItem = { value: string; label: string };

type AnnualPoint = {
  year: number;
  frecuencia: number; // 1..5
  normalidad: number; // 1..5
  gravedad: number; // 1..5
  total: number; // 1..5
  encuestas?: number;
  respuestas?: number;
};

type AnnualResponse = {
  series: AnnualPoint[];
};

type RawYearValue = number | { value?: unknown };

type YearsResponse = number[] | { years?: RawYearValue[] };

type ChartRow = {
  vector: string;
} & Record<string, number | string>;

type DeltaLayerBar = {
  data: {
    indexValue: string | number;
  };
  x: number;
  y: number;
  width: number;
  height: number;
};

type DeltaLayerProps = {
  bars: DeltaLayerBar[];
  innerWidth: number;
};

type ActiveBrandTheme = {
  primary: string;
  secondary: string;
  support: string;
  soft: string;
  supportSoft: string;
  border: string;
  glow: string;
};

// 1..5 => 0..100
function toPct(v: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, (n / 5) * 100));
}

function fmtPp(delta: number) {
  const d = Number(delta);
  const sign = d > 0 ? "+" : d < 0 ? "−" : "±";
  const abs = Math.abs(d);
  return `${sign}${abs.toFixed(1)} pp`;
}

function deltaTone(delta: number) {
  // ✅ En violencia: bajar = verde. subir = rojo.
  const d = Number(delta);
  const abs = Math.abs(d);

  const GREEN = "#16a34a";
  const RED = "#e11d48";
  const GRAY = "#64748b";

  if (abs < DELTA_EPS_PP) return { fill: GRAY, kind: "neutral" as const };
  if (d < 0) return { fill: GREEN, kind: "down" as const };
  return { fill: RED, kind: "up" as const };
}

function deltaLabelKind(kind: "neutral" | "down" | "up") {
  if (kind === "down") return "↓";
  if (kind === "up") return "↑";
  return "•";
}

function resolveActiveBrandTheme(): ActiveBrandTheme {
  const fallbackPrimary = "#7F017F";
  const fallbackSecondary = "#C23C9A";
  const fallbackSupport = "#EAD5F1";

  if (typeof window === "undefined") {
    return {
      primary: fallbackPrimary,
      secondary: fallbackSecondary,
      support: fallbackSupport,
      soft: withAlpha(fallbackPrimary, 0.1),
      supportSoft: withAlpha(fallbackSupport, 0.55),
      border: withAlpha(fallbackPrimary, 0.18),
      glow: withAlpha(fallbackPrimary, 0.35),
    };
  }

  const source =
    Array.from(document.querySelectorAll<HTMLElement>("[style*='--brand-primary']")).at(-1) ??
    document.documentElement;
  const computed = getComputedStyle(source);

  const primary = normalizeBrandColor(
    computed.getPropertyValue("--brand-primary").trim(),
    fallbackPrimary
  );
  const secondary = normalizeBrandColor(
    computed.getPropertyValue("--brand-secondary").trim(),
    fallbackSecondary
  );
  const support = normalizeBrandColor(
    computed.getPropertyValue("--brand-support").trim(),
    fallbackSupport
  );

  return {
    primary,
    secondary,
    support,
    soft: computed.getPropertyValue("--brand-soft").trim() || withAlpha(primary, 0.1),
    supportSoft:
      computed.getPropertyValue("--brand-support-soft").trim() || withAlpha(support, 0.55),
    border: computed.getPropertyValue("--brand-border").trim() || withAlpha(primary, 0.18),
    glow: computed.getPropertyValue("--brand-glow").trim() || withAlpha(primary, 0.35),
  };
}

function buildYearPalette(theme: ActiveBrandTheme) {
  const { primary, secondary, support } = theme;
  return [
    primary,
    secondary,
    mixColors(primary, secondary, 0.35),
    mixColors(primary, secondary, 0.65),
    mixColors(primary, support, 0.22),
    mixColors(secondary, support, 0.18),
    mixColors(primary, "#0F172A", 0.18),
    mixColors(secondary, "#1E293B", 0.22),
    mixColors(primary, "#FFFFFF", 0.14),
    mixColors(secondary, "#FFFFFF", 0.12),
    mixColors(primary, secondary, 0.5),
    mixColors(primary, support, 0.34),
  ];
}

function yearColorByIndex(i: number, palette: string[]) {
  return palette[i % palette.length];
}

function textOnColor(bg: string) {
  const c = bg.replace("#", "");
  if (c.length !== 6) return "#ffffff";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.62 ? "#111827" : "#ffffff";
}

export function TrendsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [years, setYears] = useState<YearItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loadingYears, setLoadingYears] = useState(false);
  const [loadingSeries, setLoadingSeries] = useState(false);

  const [allSeries, setAllSeries] = useState<AnnualPoint[]>([]);
  const [brandTheme, setBrandTheme] = useState<ActiveBrandTheme>(() => resolveActiveBrandTheme());

  useEffect(() => {
    if (!open) return;
    setBrandTheme(resolveActiveBrandTheme());
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let mounted = true;

    setLoadingYears(true);
    setLoadingSeries(false);
    setYears([]);
    setSelected([]);
    setAllSeries([]);

    (async () => {
      try {
        const resp = await api<YearsResponse>(`/api/centro/years`);

        const raw = Array.isArray(resp)
          ? resp
          : Array.isArray(resp?.years)
            ? resp.years
            : [];

        const nums = (Array.isArray(raw) ? raw : [])
          .map((x) => {
            if (x && typeof x === "object" && "value" in x) return Number(x.value);
            return Number(x);
          })
          .filter((y) => Number.isFinite(y) && y >= 2000 && y <= 2100)
          .sort((a, b) => a - b);

        const list: YearItem[] = nums.map((y) => ({
          value: String(y),
          label: String(y),
        }));

        if (!mounted) return;
        setYears(list);
        setLoadingYears(false);

        if (list.length === 0) {
          toast.error("Aún no hay años con datos finalizados.");
          return;
        }

        // ✅ por default: seleccionar todos
        const all = list.map((x) => x.value);
        setSelected(all);

        // ✅ cargar serie completa 1 sola vez
        setLoadingSeries(true);
        try {
          const qs = all.join(",");
          const data = await api<AnnualResponse>(
            `/api/centro/resumen-anual?years=${encodeURIComponent(qs)}`
          );

          const s = Array.isArray(data?.series) ? data.series : [];
          const ordered = [...s].sort((a, b) => a.year - b.year);

          if (!mounted) return;
          setAllSeries(ordered);

          if (ordered.length === 0) toast.error("No hay datos para los años disponibles.");
        } catch {
          if (!mounted) return;
          toast.error("No se pudo generar la serie anual.");
        } finally {
          if (!mounted) return;
          setLoadingSeries(false);
        }
      } catch {
        if (!mounted) return;
        toast.error("No se pudieron cargar los años disponibles.");
        setLoadingYears(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [open]);

  useEffect(() => {
    if (open) return;
    setLoadingYears(false);
    setLoadingSeries(false);
    setYears([]);
    setSelected([]);
    setAllSeries([]);
  }, [open]);

  function toggleYear(v: string) {
    setSelected((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
    );
  }

  const visibleSeries = useMemo(() => {
    if (!allSeries || allSeries.length === 0) return [];
    const set = new Set(selected);
    return allSeries
      .filter((p) => set.has(String(p.year)))
      .sort((a, b) => a.year - b.year);
  }, [allSeries, selected]);

  const yearColorMap = useMemo(() => {
    const palette = buildYearPalette(brandTheme);
    const map: Record<string, string> = {};
    years.forEach((y, i) => {
      map[y.value] = yearColorByIndex(i, palette);
    });
    return map;
  }, [brandTheme, years]);

  const dialogBrandStyle = useMemo(
    () =>
      ({
        "--brand-primary": brandTheme.primary,
        "--brand-secondary": brandTheme.secondary,
        "--brand-support": brandTheme.support,
        "--brand-soft": brandTheme.soft,
        "--brand-support-soft": brandTheme.supportSoft,
        "--brand-border": brandTheme.border,
        "--brand-glow": brandTheme.glow,
        borderColor: brandTheme.border,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, color-mix(in srgb, var(--brand-support, #EAD5F1) 16%, white) 100%)",
        boxShadow: `0 24px 60px ${brandTheme.glow}`,
      }) as CSSProperties,
    [brandTheme]
  );

  const chartModel = useMemo(() => {
    if (!visibleSeries || visibleSeries.length === 0) {
      return {
        keys: [] as string[],
        data: [] as ChartRow[],
        deltaByVector: {} as Record<string, number>,
        yearsEdge: { first: "", last: "" },
      };
    }

    const pts = [...visibleSeries].sort((a, b) => a.year - b.year);
    const keys = pts.map((p) => String(p.year));

    const yearsEdge = {
      first: keys[0] ?? "",
      last: keys[keys.length - 1] ?? "",
    };

    const deltaPp = (getRaw: (p: AnnualPoint) => number) => {
      const first = pts[0];
      const last = pts[pts.length - 1];
      if (!first || !last) return 0;
      return toPct(getRaw(last)) - toPct(getRaw(first));
    };

    const deltaByVector: Record<string, number> = {
      Frecuencia: deltaPp((p) => p.frecuencia),
      Normalización: deltaPp((p) => p.normalidad),
      Gravedad: deltaPp((p) => p.gravedad),
    };

    const row = (vector: string, getRaw: (p: AnnualPoint) => number) => {
      const base: ChartRow = { vector };
      for (const p of pts) {
        const y = String(p.year);
        const raw = Number(getRaw(p));
        base[y] = toPct(raw);
        base[`${y}__raw`] = raw;
      }
      return base;
    };

    const data = [
      row("Frecuencia", (p) => p.frecuencia),
      row("Normalización", (p) => p.normalidad),
      row("Gravedad", (p) => p.gravedad),
    ];

    return { keys, data, deltaByVector, yearsEdge };
  }, [visibleSeries]);

  const DeltaLayer = (props: DeltaLayerProps) => {
    const { bars, innerWidth } = props;

    const groups: Record<string, { minY: number; maxY: number; maxX: number }> =
      {};

    for (const b of bars) {
      const v = String(b.data.indexValue);
      const xEnd = b.x + b.width;

      if (!groups[v]) {
        groups[v] = { minY: b.y, maxY: b.y + b.height, maxX: xEnd };
      } else {
        groups[v].minY = Math.min(groups[v].minY, b.y);
        groups[v].maxY = Math.max(groups[v].maxY, b.y + b.height);
        groups[v].maxX = Math.max(groups[v].maxX, xEnd);
      }
    }

    const show = chartModel.keys.length >= 2;
    const pad = 14; // ✅ un poco más a la derecha (se ve más limpio)
    const xText = (gMaxX: number) => Math.min(gMaxX + pad, innerWidth - 2);

    return (
      <g>
        {Object.entries(groups).map(([vector, g]) => {
          const d = Number(chartModel.deltaByVector?.[vector] ?? 0);
          const tone = deltaTone(d);
          const icon = deltaLabelKind(tone.kind);

          const yMid = (g.minY + g.maxY) / 2 + 4;

          return (
            <g key={vector} opacity={show ? 1 : 0}>
              <rect
                x={xText(g.maxX) - 2}
                y={yMid - 14}
                width={98}
                height={22}
                rx={11}
                fill="var(--brand-support-soft, rgba(234,213,241,0.55))"
              />
              <text
                x={xText(g.maxX) + 8}
                y={yMid + 2}
                textAnchor="start"
                style={{
                  fontFamily: "Montserrat",
                  fontSize: 12,
                  fontWeight: 900,
                  fill: tone.fill,
                }}
              >
                {icon}
              </text>
              <text
                x={xText(g.maxX) + 24}
                y={yMid + 2}
                textAnchor="start"
                style={{
                  fontFamily: "Montserrat",
                  fontSize: 12,
                  fontWeight: 900,
                  fill: tone.fill,
                }}
              >
                {fmtPp(d)}
              </text>
            </g>
          );
        })}
      </g>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          !w-[64vw] !h-[85vh]
          !max-w-[64vw] !max-h-[85vh]
          rounded-[2rem] border-slate-200 p-0 overflow-hidden
        "
        style={dialogBrandStyle}
      >
        <div className="h-full flex flex-col p-6">
          <DialogHeader className="shrink-0">
            <DialogTitle
              className="text-lg font-black tracking-tight"
              style={{ color: "var(--brand-primary, #7F017F)" }}
            >
              Tendencias
            </DialogTitle>
            <DialogDescription className="text-sm">
             
            </DialogDescription>
          </DialogHeader>

          <Separator className="my-4 shrink-0" />

          {/* Pills */}
          <div className="shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div
                className="text-sm font-black"
                style={{ color: "var(--brand-primary, #7F017F)" }}
              >
                Años visibles
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="rounded-full text-[10px] font-black uppercase tracking-widest"
                  style={{
                    backgroundColor: "var(--brand-support-soft, rgba(234,213,241,0.55))",
                    borderColor: "var(--brand-border, rgba(127,1,127,0.18))",
                    color: "var(--brand-primary, #7F017F)",
                  }}
                >
                  {selected.length}/{years.length}
                </Badge>

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  disabled={years.length === 0}
                  onClick={() => setSelected(years.map((y) => y.value))}
                  style={{
                    borderColor: "var(--brand-border, rgba(127,1,127,0.18))",
                    color: "var(--brand-primary, #7F017F)",
                    backgroundColor: "#fff",
                  }}
                >
                  Mostrar todo
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  disabled={years.length === 0}
                  onClick={() => setSelected([])}
                  style={{
                    borderColor: "var(--brand-border, rgba(127,1,127,0.18))",
                    color: "var(--brand-primary, #7F017F)",
                    backgroundColor: "var(--brand-support-soft, rgba(234,213,241,0.55))",
                  }}
                >
                  Ocultar todo
                </Button>
              </div>
            </div>

            <div className="mt-3">
              {loadingYears ? (
                <div className="text-sm text-slate-500">Cargando años...</div>
              ) : years.length === 0 ? (
                <div className="text-sm text-slate-500">
                  Aún no hay años con datos finalizados.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {years.map((y) => {
                    const active = selected.includes(y.value);
                    const c = yearColorMap[y.value] || "#334155";
                    const fg = textOnColor(c);

                    const inactiveStyle: CSSProperties = {
                      backgroundColor: "var(--brand-support-soft, rgba(234,213,241,0.55))",
                      borderColor: "var(--brand-border, rgba(127,1,127,0.18))",
                      color: "var(--brand-primary, #7F017F)",
                    };

                    const activeStyle: CSSProperties = {
                      backgroundColor: c,
                      color: fg,
                      borderColor: "transparent",
                      boxShadow: "0 10px 26px rgba(2,6,23,0.12)",
                    };

                    return (
                      <button
                        key={y.value}
                        type="button"
                        onClick={() => toggleYear(y.value)}
                        className={[
                          "h-9 px-4 rounded-full border text-sm font-black transition flex items-center gap-2",
                          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-300",
                          active
                            ? ""
                            : "hover:bg-[rgba(2,6,23,0.06)] hover:border-[rgba(2,6,23,0.16)]",
                        ].join(" ")}
                        style={active ? activeStyle : inactiveStyle}
                        aria-pressed={active}
                        title={active ? "Ocultar año" : "Mostrar año"}
                      >
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{
                            background: active ? "rgba(255,255,255,0.92)" : c,
                            boxShadow: active ? "0 0 0 2px rgba(255,255,255,0.25)" : "none",
                          }}
                        />
                        {y.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Chart card */}
          <div
            className="mt-4 flex-1 min-h-0 rounded-[1.75rem] border bg-white p-4 flex flex-col"
            style={{ borderColor: "var(--brand-border, rgba(127,1,127,0.18))" }}
          >
            {/* Header row */}
            <div className="shrink-0 flex items-start justify-between gap-3">
              <div
                className="text-sm font-black"
                style={{ color: "var(--brand-primary, #7F017F)" }}
              >
                Comparación anual por vector de violencia contra la mujer
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="rounded-full text-[10px] font-black uppercase tracking-widest"
                  style={{
                    backgroundColor: "var(--brand-support-soft, rgba(234,213,241,0.55))",
                    color: "var(--brand-primary, #7F017F)",
                  }}
                >
                  0–100%
                </Badge>

                <Badge
                  variant="secondary"
                  className="rounded-full text-[10px] font-black uppercase tracking-widest"
                  style={{
                    backgroundColor: "var(--brand-soft, rgba(127,1,127,0.10))",
                    color: "var(--brand-primary, #7F017F)",
                  }}
                >
                  Δ pp
                </Badge>
              </div>
            </div>

            {/* ✅ LEYENDA FULL ROW ARRIBA (custom, no se corta) */}
            {chartModel.keys.length > 0 ? (
              <div className="mt-3 shrink-0 w-full">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  {chartModel.keys.map((k) => {
                    const c = yearColorMap[String(k)] || "#334155";
                    return (
                      <div key={k} className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ background: c }}
                        />
                        <span
                          className="text-xs font-black"
                          style={{ color: "var(--brand-primary, #7F017F)" }}
                        >
                          {k}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <Separator className="my-3 shrink-0" />

            <div className="flex-1 min-h-0">
              {loadingSeries ? (
                <div className="text-sm text-slate-500">Preparando gráfica…</div>
              ) : chartModel.data.length === 0 ? (
                <div className="text-sm text-slate-500">
                  Activa al menos <span className="font-black">1 año</span> para ver la gráfica.
                </div>
              ) : (
                <div className="h-full">
                  <ResponsiveBar
                    data={chartModel.data}
                    keys={chartModel.keys}
                    indexBy="vector"
                    layout="horizontal"
                    groupMode="grouped"
                    valueScale={{ type: "linear", min: 0, max: 100 }}
                    valueFormat={(v) => `${Number(v).toFixed(2)}%`}
                    indexScale={{ type: "band", round: true }}
                    margin={{ top: 8, right: 170, bottom: 44, left: 150 }}
                    padding={0.38}
                    innerPadding={6}
                    enableLabel={false}
                    enableGridY={false}
                    enableGridX={true}
                    gridXValues={[0, 20, 40, 60, 80, 100]}
                    axisTop={null}
                    axisRight={null}
                    axisBottom={{
                      tickSize: 0,
                      tickPadding: 10,
                      tickValues: [0, 20, 40, 60, 80, 100],
                      legend: "Intensidad (0–100%)",
                      legendOffset: 36,
                      legendPosition: "middle",
                      format: (v) => `${v}%`,
                    }}
                    axisLeft={{
                      tickSize: 0,
                      tickPadding: 10,
                    }}
                    colors={({ id }) => yearColorMap[String(id)] || "#334155"}
                    borderRadius={10}
                    borderWidth={1}
                    borderColor={{ from: "color", modifiers: [["darker", 0.35]] }}
                    legends={[]} // ✅ desactivamos leyenda Nivo (la hacemos custom arriba)
                    theme={{
                      text: {
                        fontFamily: "Montserrat",
                        fontSize: 12,
                        fontWeight: 900,
                        fill: "var(--brand-primary, #7F017F)",
                      },
                      axis: {
                        ticks: {
                          text: {
                            fill: "var(--brand-primary, #7F017F)",
                            fontWeight: 900,
                          },
                        },
                        legend: {
                          text: {
                            fill: "var(--brand-primary, #7F017F)",
                            fontWeight: 900,
                          },
                        },
                      },
                      grid: {
                        line: {
                          stroke: "var(--brand-border, rgba(127,1,127,0.18))",
                          strokeWidth: 1,
                        },
                      },
                    }}
                    layers={["grid", "axes", "bars", DeltaLayer]}
                    animate={true}
                    motionConfig="gentle"
                  />
                </div>
              )}
            </div>

            {/* Leyenda Δ compacta */}
            {chartModel.keys.length >= 2 ? (
              <div className="mt-3 shrink-0 flex flex-wrap items-center gap-2 text-[11px] font-black text-slate-600">
                <span
                  className="rounded-full px-3 py-1"
                  style={{
                    backgroundColor: "var(--brand-support-soft, rgba(234,213,241,0.55))",
                    color: "var(--brand-primary, #7F017F)",
                  }}
                >
                  Δ pp: {chartModel.yearsEdge.last} − {chartModel.yearsEdge.first}
                </span>
                <span
                  className="rounded-full px-3 py-1"
                  style={{ backgroundColor: "rgba(22,163,74,0.10)" }}
                >
                  <span style={{ color: "#16a34a" }}>↓</span> disminución
                </span>
                <span
                  className="rounded-full px-3 py-1"
                  style={{ backgroundColor: "rgba(225,29,72,0.10)" }}
                >
                  <span style={{ color: "#e11d48" }}>↑</span> aumento
                </span>
                <span
                  className="rounded-full px-3 py-1"
                  style={{ backgroundColor: "rgba(100,116,139,0.10)" }}
                >
                  <span style={{ color: "#64748b" }}>•</span> marginal (±{DELTA_EPS_PP.toFixed(1)}{" "}
                  pp)
                </span>
              </div>
            ) : (
              <div className="mt-3 shrink-0 text-[11px] font-black text-slate-500">
                * Porcentaje: (promedio/5)×100
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-4 shrink-0 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={() => onOpenChange(false)}
              style={{
                borderColor: "var(--brand-border, rgba(127,1,127,0.18))",
                color: "var(--brand-primary, #7F017F)",
                backgroundColor: "#fff",
              }}
            >
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
