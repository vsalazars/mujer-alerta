"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactECharts from "echarts-for-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Separator } from "../../../components/ui/separator";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "../../../components/ui/drawer";

import { api } from "../../../lib/api";

// =========================
// Backend types (Go)
// =========================
type BackendDimension = "frecuencia" | "normalidad" | "gravedad";

type ResumenGlobalBE = {
  frecuencia: number;
  normalidad: number;
  gravedad: number;
  total: number;
};

type MatrizItemBE = {
  tipo_num: number;
  tipo_nombre: string;
  dimension: BackendDimension;
  promedio: number; // 1..5
};

type EncuestaResumenResponseBE = {
  encuesta_id: string;
  global: ResumenGlobalBE;
  matriz: MatrizItemBE[];
};

// =========================
// UI constants
// =========================
const DIM_ORDER: BackendDimension[] = ["frecuencia", "normalidad", "gravedad"];
const DIM_LABEL_FULL: Record<BackendDimension, string> = {
  frecuencia: "Frecuencia",
  normalidad: "Normalización",
  gravedad: "Gravedad",
};
const DIM_LABEL_SHORT: Record<BackendDimension, string> = {
  frecuencia: "F",
  normalidad: "N",
  gravedad: "G",
};

// =========================
// LGAMVLV mapping (UI)
// =========================
type LGAMRef = {
  tipo: string; // “Tipo de violencia” (LGAMVLV)
  modalidad?: string; // “Modalidad” cuando aplique
  articulo?: string; // para UI (opcional)
  nota?: string; // micro explicación (opcional)
};

// Mapeo práctico para tus 8 tipos (por tipo_num).
// Si en el futuro cambias el orden, lo ideal es mapear por una clave estable,
// pero esto ya te queda sólido y “fino” hoy.
const LGAM_MAP: Record<number, LGAMRef[]> = {
  1: [
    {
      tipo: "Violencia psicológica",
      articulo: "LGAMVLV Art. 6",
      nota: "Humillación, descalificación o devaluación que afecta la estabilidad emocional.",
    },
  ],
  2: [
    {
      tipo: "Violencia psicológica",
      articulo: "LGAMVLV Art. 6",
      nota: "Discriminación y trato degradante por razón de género.",
    },
    {
      tipo: "Violencia institucional",
      articulo: "LGAMVLV",
      nota: "Cuando la autoridad/estructura obstaculiza el acceso a derechos o la atención.",
    },
  ],
  3: [
    {
      tipo: "Violencia sexual",
      articulo: "LGAMVLV Art. 6",
      nota: "Sexualización/cosificación, comentarios o conductas de contenido sexual no deseado.",
    },
  ],
  4: [
    {
      tipo: "Violencia sexual",
      articulo: "LGAMVLV Art. 6",
      nota: "Hostigamiento o presión de naturaleza sexual.",
    },
    {
      tipo: "Violencia laboral y docente",
      articulo: "LGAMVLV",
      nota: "Si ocurre en el marco escolar/laboral y mediado por relación de poder.",
    },
  ],
  5: [
    {
      tipo: "Violencia psicológica",
      articulo: "LGAMVLV Art. 6",
      nota: "Control, intimidación o abuso jerárquico.",
    },
    {
      tipo: "Violencia económica",
      articulo: "LGAMVLV Art. 6",
      nota: "Si limita salario, recursos u oportunidades por razón de género.",
    },
    {
      tipo: "Violencia institucional",
      articulo: "LGAMVLV",
      nota: "Si la autoridad usa su función para limitar derechos/condiciones.",
    },
  ],
  6: [
    {
      tipo: "Violencia laboral y docente",
      articulo: "LGAMVLV",
      nota: "Obstaculización o afectación por razón de género en ámbitos escolar/laboral.",
    },
    {
      tipo: "Violencia económica",
      articulo: "LGAMVLV Art. 6",
      nota: "Si afecta ingresos, condiciones o permanencia laboral.",
    },
    {
      tipo: "Violencia psicológica",
      articulo: "LGAMVLV Art. 6",
      nota: "Si hay amenazas, presión o desvalorización ligada al desempeño.",
    },
  ],
  7: [
    {
      tipo: "Violencia digital y mediática",
      articulo: "LGAMVLV",
      nota: "Daño por medios digitales/mediáticos: difusión, exposición, hostigamiento o denigración.",
    },
  ],
  8: [
    {
      tipo: "Violencia física",
      articulo: "LGAMVLV Art. 6",
      nota: "Agresión o daño no accidental.",
    },
    {
      tipo: "Violencia psicológica",
      articulo: "LGAMVLV Art. 6",
      nota: "Amenazas e intimidación que generan temor o control.",
    },
  ],
};

// =========================
// Helpers
// =========================
function fmt(v: unknown) {
  const n = typeof v === "number" && Number.isFinite(v) ? v : NaN;
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function useIsMobile(breakpointPx = 720) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [breakpointPx]);
  return isMobile;
}

function levelLabel(v: number) {
  if (!Number.isFinite(v)) return "—";
  if (v < 2) return "Bajo";
  if (v < 3) return "Medio";
  if (v < 4) return "Alto";
  return "Muy alto";
}

function colorForValue(v: number) {
  if (!Number.isFinite(v)) return "rgba(0,0,0,0.04)";
  const t = (clamp(v, 1, 5) - 1) / 4; // 0..1
  const r = Math.round(247 - 125 * t);
  const g = Math.round(243 - 220 * t);
  const b = Math.round(246 - 185 * t);
  return `rgba(${r},${g},${b},1)`;
}

type TipoAgg = {
  tipo_num: number;
  tipo_nombre: string;
  frecuencia?: number;
  normalidad?: number;
  gravedad?: number;
};

export default function ResultadosEncuestaPage() {
  const router = useRouter();
  const params = useParams();
  const isMobile = useIsMobile(720);

  const encuestaId =
    (params?.encuestaId as string | undefined) ||
    (params?.id as string | undefined) ||
    "";

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [data, setData] = useState<EncuestaResumenResponseBE | null>(null);

  // Drawer (mobile)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<{
    tipoIndex: number;
    dimIndex: number;
  } | null>(null);

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setLoading(true);
        setErr("");

        const payload = await api<EncuestaResumenResponseBE>(
          `/api/encuestas/${encuestaId}/resumen`
        );

        if (!alive) return;
        setData(payload);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "No se pudieron cargar los resultados.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    if (encuestaId) run();
    else {
      setErr("Falta el identificador de la encuesta en la ruta.");
      setLoading(false);
    }

    return () => {
      alive = false;
    };
  }, [encuestaId]);

  const global = data?.global;

  // Tipos (filas) derivados de la matriz
  const tipos = useMemo(() => {
    const m = new Map<number, string>();
    for (const it of data?.matriz ?? []) {
      if (!m.has(it.tipo_num)) m.set(it.tipo_num, it.tipo_nombre);
    }
    return Array.from(m.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([tipo_num, tipo_nombre]) => ({ tipo_num, tipo_nombre }));
  }, [data]);

  // Agregado por tipo: F/N/G juntos (Drawer)
  const tipoAgg = useMemo<TipoAgg[]>(() => {
    const byTipo = new Map<number, TipoAgg>();
    for (const t of tipos) byTipo.set(t.tipo_num, { ...t });

    for (const it of data?.matriz ?? []) {
      const obj = byTipo.get(it.tipo_num);
      if (!obj) continue;
      if (it.dimension === "frecuencia") obj.frecuencia = it.promedio;
      if (it.dimension === "normalidad") obj.normalidad = it.promedio;
      if (it.dimension === "gravedad") obj.gravedad = it.promedio;
    }

    return tipos.map((t) => byTipo.get(t.tipo_num)!).filter(Boolean);
  }, [data, tipos]);

  const yAxisLabelsFull = useMemo(
    () => tipos.map((t) => `${t.tipo_num}. ${t.tipo_nombre}`),
    [tipos]
  );
  const yAxisLabelsShort = useMemo(
    () => tipos.map((t) => String(t.tipo_num)),
    [tipos]
  );

  // Heatmap data: [xIndex, yIndex, value]
  const heatmapSeriesData = useMemo(() => {
    const yIndexByTipo = new Map<number, number>();
    tipos.forEach((t, idx) => yIndexByTipo.set(t.tipo_num, idx));

    const xIndexByDim: Record<BackendDimension, number> = {
      frecuencia: 0,
      normalidad: 1,
      gravedad: 2,
    };

    const out: Array<[number, number, number]> = [];
    for (const it of data?.matriz ?? []) {
      const x = xIndexByDim[it.dimension];
      const y = yIndexByTipo.get(it.tipo_num);
      if (typeof y !== "number") continue;
      out.push([x, y, it.promedio]);
    }
    return out;
  }, [data, tipos]);

  // Labels X: móvil corto, desktop largo
  const xAxisLabels = useMemo(() => {
    return isMobile
      ? DIM_ORDER.map((d) => DIM_LABEL_SHORT[d])
      : DIM_ORDER.map((d) => DIM_LABEL_FULL[d]);
  }, [isMobile]);

  // Altura chart con “aire” en móvil
  const chartHeight = useMemo(() => {
    const rows = Math.max(1, tipos.length);
    if (isMobile) return Math.min(860, Math.max(520, 120 + rows * 58));
    return Math.min(600, Math.max(300, 80 + rows * 44));
  }, [tipos.length, isMobile]);

  const chartOption = useMemo(() => {
    const yLabels = isMobile ? yAxisLabelsShort : yAxisLabelsFull;

    return {
      animation: false,
      grid: {
        left: isMobile ? 10 : 12,
        right: 12,
        top: 8,
        bottom: 72,
        containLabel: true,
      },
      tooltip: {
        // Desktop tooltip OK; en móvil usaremos Drawer al tap.
        show: !isMobile,
        trigger: "item",
        confine: true,
        extraCssText:
          "max-width:320px; white-space:normal; border-radius:12px;",
        formatter: (p: any) => {
          const x = p?.data?.[0] as number;
          const y = p?.data?.[1] as number;
          const v = p?.data?.[2] as number;
          const dimKey = DIM_ORDER[x];
          const dim = dimKey ? DIM_LABEL_FULL[dimKey] : "—";
          const tipo = yAxisLabelsFull[y] ?? "—";
          return `
            <div style="font-size:12px; line-height:1.35">
              <div style="font-weight:700; margin-bottom:4px">${tipo}</div>
              <div>${dim}: <b>${fmt(v)}</b> (${levelLabel(v)})</div>
            </div>
          `;
        },
      },
      xAxis: {
        type: "category",
        data: xAxisLabels,
        axisLabel: {
          interval: 0,
          fontSize: isMobile ? 12 : 11,
          margin: 10,
        },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "rgba(0,0,0,0.14)" } },
      },
      yAxis: {
        type: "category",
        data: yLabels,
        axisLabel: {
          fontSize: isMobile ? 12 : 11,
          width: isMobile ? 22 : 280,
          overflow: isMobile ? "break" : "truncate",
          margin: 12,
        },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "rgba(0,0,0,0.14)" } },
      },
      visualMap: {
        min: 1,
        max: 5,
        calculable: false,
        orient: "horizontal",
        left: "center",
        bottom: 12,
        inRange: {
          color: ["#F7F3F6", "#E7C7D7", "#D29AB9", "#B96C98", "#7A003C"],
        },
        text: ["5", "1"],
        textStyle: { fontSize: 11 },
      },
      series: [
        {
          name: "Mapa de calor",
          type: "heatmap",
          data: heatmapSeriesData,
          label: {
            // móvil: limpio (sin números encima)
            show: !isMobile,
            fontSize: 10,
            formatter: (p: any) => fmt(p?.data?.[2]),
          },
          itemStyle: {
            borderColor: "rgba(0,0,0,0.10)",
            borderWidth: 1,
            borderRadius: isMobile ? 16 : 12,
          },
          emphasis: {
            itemStyle: {
              borderColor: "rgba(0,0,0,0.25)",
              borderWidth: 2,
            },
          },
        },
      ],
    };
  }, [isMobile, xAxisLabels, yAxisLabelsFull, yAxisLabelsShort, heatmapSeriesData]);

  // Eventos ECharts: tap -> Drawer (solo móvil)
  const onEvents = useMemo(() => {
    if (!isMobile) return {};
    return {
      click: (params: any) => {
        const x = params?.data?.[0];
        const y = params?.data?.[1];
        if (typeof x !== "number" || typeof y !== "number") return;
        setSelected({ dimIndex: x, tipoIndex: y });
        setDrawerOpen(true);
      },
    };
  }, [isMobile]);

  const selectedDetail = useMemo(() => {
    if (!selected) return null;
    const t = tipoAgg[selected.tipoIndex];
    if (!t) return null;

    const dimKey = DIM_ORDER[selected.dimIndex];
    const focusedValue =
      dimKey === "frecuencia"
        ? t.frecuencia
        : dimKey === "normalidad"
        ? t.normalidad
        : t.gravedad;

    const refs = LGAM_MAP[t.tipo_num] || [];

    return {
      tipo: t,
      dimKey,
      focusedValue,
      refs,
    };
  }, [selected, tipoAgg]);

  return (
    <main className="min-h-dvh bg-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-neutral-500">Encuesta</div>
            <h1 className="text-lg font-semibold text-neutral-900">
              Tu percepción del entorno
            </h1>
          </div>

          <Button variant="outline" onClick={() => router.back()}>
            Volver
          </Button>
        </div>

        {loading ? (
          <div className="rounded-2xl border p-6 text-sm text-neutral-600">
            Cargando resultados…
          </div>
        ) : err ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {err}
          </div>
        ) : (
          <>
            {/* Indicadores globales */}
            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Indicadores globales (promedio 1–5)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl border p-4">
                    <div className="text-xs text-neutral-500">Frecuencia</div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums">
                      {fmt(global?.frecuencia)}
                    </div>
                  </div>

                  <div className="rounded-2xl border p-4">
                    <div className="text-xs text-neutral-500">Normalización</div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums">
                      {fmt(global?.normalidad)}
                    </div>
                  </div>

                  <div className="rounded-2xl border p-4">
                    <div className="text-xs text-neutral-500">Gravedad</div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums">
                      {fmt(global?.gravedad)}
                    </div>
                  </div>

                  <div className="rounded-2xl border p-4">
                    <div className="text-xs text-neutral-500">Total</div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums">
                      {fmt(global?.total)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Separator className="my-6" />

            {/* Heatmap PRO */}
            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Mapa de calor por tipo
                </CardTitle>
                <div className="mt-1 text-sm text-neutral-600">
                  {isMobile
                    ? "Vista global (F, N, G). Toca una celda para ver detalle legal y valores."
                    : "Pasa el cursor o toca una celda para detalle."}
                </div>
              </CardHeader>

              <CardContent>
                <div className="rounded-2xl border bg-white p-2 sm:border-0 sm:p-0">
                  <ReactECharts
                    option={chartOption as any}
                    style={{ height: chartHeight, width: "100%" }}
                    notMerge={true}
                    lazyUpdate={true}
                    opts={{ renderer: "canvas" }}
                    onEvents={onEvents as any}
                  />
                </div>

                {/* Mobile-only legends */}
                {isMobile ? (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border p-3 text-xs text-neutral-700">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold">F</span>=Frecuencia ·{" "}
                          <span className="font-semibold">N</span>=Normalización ·{" "}
                          <span className="font-semibold">G</span>=Gravedad
                        </div>
                        <div className="text-neutral-500">1→5</div>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((v) => (
                          <span
                            key={v}
                            className="h-2.5 flex-1 rounded-full"
                            style={{ backgroundColor: colorForValue(v) }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border p-3">
                      <div className="mb-2 text-xs font-semibold text-neutral-800">
                        Tipos (referencia)
                      </div>
                      <div className="space-y-1 text-xs text-neutral-700">
                        {tipos.map((t) => (
                          <div key={t.tipo_num} className="flex gap-2">
                            <span className="w-6 shrink-0 font-semibold">
                              {t.tipo_num}.
                            </span>
                            <span className="leading-5">{t.tipo_nombre}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-neutral-600">
                    Escala: 1 (bajo) → 5 (alto).
                  </div>
                )}
              </CardContent>
            </Card>

            <Separator className="my-6" />

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                variant="outline"
                className="h-12 w-full rounded-full"
                onClick={() => router.push("/diagnostico")}
              >
                Nueva encuesta
              </Button>

              <Button
                className="h-12 w-full rounded-full"
                onClick={() => router.push("/")}
              >
                Ir al inicio
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Drawer PRO + LGAMVLV */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="rounded-t-3xl">
          <DrawerHeader className="pb-2">
            <DrawerTitle>Detalle</DrawerTitle>
            <DrawerDescription>
              Valores por dimensión (1–5) y referencia LGAMVLV.
            </DrawerDescription>
          </DrawerHeader>

          {selectedDetail ? (
            <div className="px-4 pb-6">
              <div className="rounded-2xl border p-4">
                {/* Título tipo */}
                <div className="text-sm font-semibold text-neutral-900">
                  {selectedDetail.tipo.tipo_num}. {selectedDetail.tipo.tipo_nombre}
                </div>

                {/* Chips LGAMVLV */}
                {selectedDetail.refs.length ? (
                  <>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedDetail.refs.map((r, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold text-neutral-900"
                          style={{
                            borderColor: "rgba(0,0,0,0.10)",
                            background: "rgba(122,0,60,0.06)",
                          }}
                          title={[r.modalidad, r.articulo, r.nota]
                            .filter(Boolean)
                            .join(" · ")}
                        >
                          {r.tipo}
                        </span>
                      ))}
                    </div>

                    {/* Nota legal corta (primera que exista) */}
                    {selectedDetail.refs.find((r) => r.nota)?.nota ? (
                      <div className="mt-2 text-xs text-neutral-600">
                        {selectedDetail.refs.find((r) => r.nota)!.nota}
                      </div>
                    ) : null}

                    {/* Línea de artículo (si existe) */}
                    {selectedDetail.refs.find((r) => r.articulo)?.articulo ? (
                      <div className="mt-1 text-[11px] text-neutral-500">
                        
                      </div>
                    ) : null}
                  </>
                ) : null}

                {/* 3 mini-cards F/N/G */}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {DIM_ORDER.map((d) => {
                    const v =
                      d === "frecuencia"
                        ? selectedDetail.tipo.frecuencia
                        : d === "normalidad"
                        ? selectedDetail.tipo.normalidad
                        : selectedDetail.tipo.gravedad;

                    const active = selectedDetail.dimKey === d;

                    return (
                      <div
                        key={d}
                        className={[
                          "rounded-2xl border p-3",
                          active ? "border-neutral-900" : "border-neutral-200",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold text-neutral-700">
                            {DIM_LABEL_SHORT[d]}
                          </div>
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: colorForValue(Number(v)) }}
                          />
                        </div>

                        <div className="mt-1 text-xl font-semibold tabular-nums text-neutral-900">
                          {fmt(v)}
                        </div>

                        <div className="text-[11px] text-neutral-600">
                          {DIM_LABEL_FULL[d]} · {levelLabel(Number(v))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selección */}
                <div className="mt-3 text-xs text-neutral-600">
                  Seleccionado:{" "}
                  <span className="font-semibold text-neutral-900">
                    {DIM_LABEL_FULL[selectedDetail.dimKey]}
                  </span>{" "}
                  ={" "}
                  <span className="font-semibold">
                    {fmt(selectedDetail.focusedValue)}
                  </span>
                </div>
              </div>

              <div className="mt-4">
                <Button
                  className="h-12 w-full rounded-full"
                  onClick={() => setDrawerOpen(false)}
                >
                  Cerrar
                </Button>
              </div>
            </div>
          ) : (
            <div className="px-4 pb-6 text-sm text-neutral-600">
              Selecciona una celda del mapa.
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </main>
  );
}
