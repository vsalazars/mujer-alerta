"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

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

// ✅ Mujer Alerta — paleta diversa morado / violeta / rosa (sobria, diferenciable)
const YEAR_PALETTE = [
  "#4C1D95",
  "#9D174D",
  "#5E17EB",
  "#7A3EF0",
  "#8E44AD",
  "#A855F7",
  "#B83280",
  "#C026D3",
  "#BE185D",
  "#DB2777",
  "#E11D48",
  "#6B1D5C",
];

function yearColorByIndex(i: number) {
  return YEAR_PALETTE[i % YEAR_PALETTE.length];
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let mounted = true;

    setError(null);
    setLoadingYears(true);
    setLoadingSeries(false);
    setYears([]);
    setSelected([]);
    setAllSeries([]);

    (async () => {
      try {
        const resp = await api<number[] | { years: any[] }>(`/api/centro/years`);

        const raw = Array.isArray(resp)
          ? resp
          : Array.isArray((resp as any)?.years)
            ? (resp as any).years
            : [];

        const nums = (Array.isArray(raw) ? raw : [])
          .map((x: any) => {
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
          setError("Aún no hay años con datos finalizados.");
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

          const s = Array.isArray((data as any)?.series) ? (data as any).series : [];
          const ordered = [...s].sort((a, b) => a.year - b.year);

          if (!mounted) return;
          setAllSeries(ordered);

          if (ordered.length === 0) setError("No hay datos para los años disponibles.");
        } catch {
          if (!mounted) return;
          setError("No se pudo generar la serie anual.");
        } finally {
          if (!mounted) return;
          setLoadingSeries(false);
        }
      } catch {
        if (!mounted) return;
        setError("No se pudieron cargar los años disponibles.");
        setLoadingYears(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [open]);

  useEffect(() => {
    if (open) return;
    setError(null);
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
    const map: Record<string, string> = {};
    years.forEach((y, i) => {
      map[y.value] = yearColorByIndex(i);
    });
    return map;
  }, [years]);

  const chartModel = useMemo(() => {
    if (!visibleSeries || visibleSeries.length === 0) {
      return {
        keys: [] as string[],
        data: [] as any[],
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
      const base: any = { vector };
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

  const DeltaLayer = (props: any) => {
    const { bars, innerWidth } = props;

    const groups: Record<string, { minY: number; maxY: number; maxX: number }> =
      {};

    for (const b of bars as any[]) {
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
                fill="rgba(2,6,23,0.06)"
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
      >
        <div className="h-full flex flex-col p-6">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-lg font-black tracking-tight">
              Tendencias
            </DialogTitle>
            <DialogDescription className="text-sm">
             
            </DialogDescription>
          </DialogHeader>

          <Separator className="my-4 shrink-0" />

          {/* Pills */}
          <div className="shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-black text-slate-700">Años visibles</div>

              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="rounded-full text-[10px] font-black uppercase tracking-widest"
                >
                  {selected.length}/{years.length}
                </Badge>

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  disabled={years.length === 0}
                  onClick={() => setSelected(years.map((y) => y.value))}
                >
                  Mostrar todo
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  disabled={years.length === 0}
                  onClick={() => setSelected([])}
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

                    const inactiveStyle: React.CSSProperties = {
                      backgroundColor: "rgba(2,6,23,0.04)",
                      borderColor: "rgba(2,6,23,0.10)",
                      color: "#0f172a",
                    };

                    const activeStyle: React.CSSProperties = {
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

            {error ? (
              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}
          </div>

          {/* Chart card */}
          <div className="mt-4 flex-1 min-h-0 rounded-[1.75rem] border border-slate-200 bg-white p-4 flex flex-col">
            {/* Header row */}
            <div className="shrink-0 flex items-start justify-between gap-3">
              <div className="text-sm font-black text-slate-800">
                Comparación anual por vector de violencia contra la mujer
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="rounded-full text-[10px] font-black uppercase tracking-widest"
                >
                  0–100%
                </Badge>

                <Badge
                  variant="secondary"
                  className="rounded-full text-[10px] font-black uppercase tracking-widest"
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
                        <span className="text-xs font-black text-slate-700">{k}</span>
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
                        fill: "#111827",
                      },
                      axis: {
                        ticks: { text: { fill: "#111827", fontWeight: 900 } },
                        legend: { text: { fill: "#111827", fontWeight: 900 } },
                      },
                      grid: {
                        line: { stroke: "rgba(2,6,23,0.08)", strokeWidth: 1 },
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
                <span className="rounded-full bg-slate-100 px-3 py-1">
                  Δ pp: {chartModel.yearsEdge.last} − {chartModel.yearsEdge.first}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1">
                  <span style={{ color: "#16a34a" }}>↓</span> disminución
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1">
                  <span style={{ color: "#e11d48" }}>↑</span> aumento
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1">
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
            >
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
