"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactECharts from "echarts-for-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";

import { ArrowLeft, Home, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";

// =========================
// Tipos del backend
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
  promedio: number;
};

type EncuestaResumenResponseBE = {
  encuesta_id: string;
  global: ResumenGlobalBE;
  matriz: MatrizItemBE[];
};

// =========================
// Constantes UI
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
// Mapeo LGAMVLV
// =========================
const LGAM_MAP: Record<number, { tipo: string; articulo?: string; nota?: string }[]> = {
  1: [{ tipo: "Violencia psicológica", articulo: "LGAMVLV Art. 6", nota: "Humillación, descalificación o devaluación que afecta la estabilidad emocional." }],
  2: [
    { tipo: "Violencia psicológica", articulo: "LGAMVLV Art. 6", nota: "Discriminación y trato degradante por razón de género." },
    { tipo: "Violencia institucional", nota: "Obstaculización del acceso a derechos o atención por parte de autoridades." },
  ],
  3: [{ tipo: "Violencia sexual", articulo: "LGAMVLV Art. 6", nota: "Sexualización, comentarios o conductas de contenido sexual no consentido." }],
  4: [
    { tipo: "Violencia sexual", articulo: "LGAMVLV Art. 6", nota: "Hostigamiento o presión de naturaleza sexual." },
    { tipo: "Violencia laboral y docente", nota: "En contextos de poder jerárquico escolar o laboral." },
  ],
  5: [
    { tipo: "Violencia psicológica", articulo: "LGAMVLV Art. 6", nota: "Control, intimidación o abuso jerárquico." },
    { tipo: "Violencia económica", articulo: "LGAMVLV Art. 6", nota: "Limitación de recursos o oportunidades por razón de género." },
    { tipo: "Violencia institucional", nota: "Uso indebido de autoridad para restringir derechos." },
  ],
  6: [
    { tipo: "Violencia laboral y docente", nota: "Obstaculización en ámbitos escolar/laboral por razón de género." },
    { tipo: "Violencia económica", articulo: "LGAMVLV Art. 6", nota: "Afectación de ingresos o condiciones laborales." },
    { tipo: "Violencia psicológica", articulo: "LGAMVLV Art. 6", nota: "Amenazas o desvalorización ligada al desempeño." },
  ],
  7: [{ tipo: "Violencia digital y mediática", nota: "Daño mediante difusión, exposición o hostigamiento digital." }],
  8: [
    { tipo: "Violencia física", articulo: "LGAMVLV Art. 6", nota: "Agresión o daño físico no accidental." },
    { tipo: "Violencia psicológica", articulo: "LGAMVLV Art. 6", nota: "Amenazas que generan temor o control." },
  ],
};

// =========================
// Helpers
// =========================
function fmt(v: unknown): string {
  const n = typeof v === "number" && Number.isFinite(v) ? v : NaN;
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

function levelLabel(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (v < 2) return "Bajo";
  if (v < 3) return "Medio";
  if (v < 4) return "Alto";
  return "Muy alto";
}

function levelBadgeVariant(v: number): "default" | "secondary" | "destructive" | "outline" {
  if (v < 2) return "secondary";
  if (v < 3) return "outline";
  if (v < 4) return "default";
  return "destructive";
}

function useIsMobile(breakpointPx = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    setIsMobile(mq.matches);
    const handler = () => setIsMobile(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpointPx]);
  return isMobile;
}

function colorForValue(v: number): string {
  if (!Number.isFinite(v)) return "#f9fafb";
  const t = (Math.min(Math.max(v, 1), 5) - 1) / 4;
  const r = Math.round(247 - 125 * t);
  const g = Math.round(243 - 220 * t);
  const b = Math.round(246 - 185 * t);
  return `rgb(${r}, ${g}, ${b})`;
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
  const isMobile = useIsMobile();

  const encuestaId = (params?.encuestaId as string) || (params?.id as string) || "";

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState<EncuestaResumenResponseBE | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<{ tipoIndex: number; dimIndex: number } | null>(null);

  useEffect(() => {
    let alive = true;
    async function fetchData() {
      if (!encuestaId) {
        setErr("Falta el identificador de la encuesta.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const payload = await api<EncuestaResumenResponseBE>(`/api/encuestas/${encuestaId}/resumen`);
        if (alive) setData(payload);
      } catch (e: any) {
        if (alive) setErr(e?.message || "Error al cargar los resultados.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    fetchData();
    return () => { alive = false; };
  }, [encuestaId]);

  const global = data?.global;

  const tipos = useMemo(() => {
    const map = new Map<number, string>();
    data?.matriz.forEach(it => {
      if (!map.has(it.tipo_num)) map.set(it.tipo_num, it.tipo_nombre);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([tipo_num, tipo_nombre]) => ({ tipo_num, tipo_nombre }));
  }, [data]);

  const tipoAgg = useMemo<TipoAgg[]>(() => {
    const map = new Map<number, TipoAgg>();
    tipos.forEach(t => map.set(t.tipo_num, { ...t }));
    data?.matriz.forEach(it => {
      const obj = map.get(it.tipo_num);
      if (obj) (obj as any)[it.dimension] = it.promedio;
    });
    return tipos.map(t => map.get(t.tipo_num)!);
  }, [data, tipos]);

  const yAxisLabelsFull = useMemo(() => tipos.map(t => `${t.tipo_num}. ${t.tipo_nombre}`), [tipos]);
  const yAxisLabelsShort = useMemo(() => tipos.map(t => String(t.tipo_num)), [tipos]);

  const heatmapSeriesData = useMemo<[number, number, number][]>(() => {
    const yMap = new Map<number, number>();
    tipos.forEach((t, i) => yMap.set(t.tipo_num, i));
    const xMap: Record<BackendDimension, number> = { frecuencia: 0, normalidad: 1, gravedad: 2 };
    return (data?.matriz ?? []).map(it => [
      xMap[it.dimension],
      yMap.get(it.tipo_num) ?? 0,
      it.promedio
    ]);
  }, [data, tipos]);

  const xAxisLabels = useMemo(() => 
    isMobile ? DIM_ORDER.map(d => DIM_LABEL_SHORT[d]) : DIM_ORDER.map(d => DIM_LABEL_FULL[d])
  , [isMobile]);

  const chartHeight = useMemo(() => {
    const rows = Math.max(1, tipos.length);
    return isMobile 
      ? Math.min(900, Math.max(560, 140 + rows * 64))
      : Math.min(640, Math.max(360, 100 + rows * 48));
  }, [tipos.length, isMobile]);

  const chartOption = useMemo(() => ({
    animation: false,
    grid: { left: 16, right: 16, top: 16, bottom: 80, containLabel: true },
    tooltip: {
      show: !isMobile,
      trigger: "item",
      confine: true,
      backgroundColor: "rgba(255,255,255,0.95)",
      borderColor: "#e5e7eb",
      borderWidth: 1,
      padding: 12,
      textStyle: { color: "#111", fontSize: 13 },
      formatter: (p: any) => {
        const x = p.data[0], y = p.data[1], v = p.data[2];
        const dim = DIM_LABEL_FULL[DIM_ORDER[x]];
        const tipo = yAxisLabelsFull[y];
        return `<strong>${tipo}</strong><br/>${dim}: <strong>${fmt(v)}</strong> <em>(${levelLabel(v)})</em>`;
      }
    },
    xAxis: {
      type: "category",
      data: xAxisLabels,
      axisLabel: { fontSize: 13, margin: 16 },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#e5e7eb" } }
    },
    yAxis: {
      type: "category",
      data: isMobile ? yAxisLabelsShort : yAxisLabelsFull,
      axisLabel: {
        fontSize: 12,
        width: isMobile ? 32 : 300,
        overflow: isMobile ? "truncate" : "truncate",
        margin: 14
      },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#e5e7eb" } }
    },
    visualMap: {
      min: 1, max: 5, calculable: false,
      orient: "horizontal", left: "center", bottom: 20,
      inRange: { color: ["#F7F3F6", "#E7C7D7", "#D29AB9", "#B96C98", "#7A003C"] },
      text: ["Muy alto (5)", "Bajo (1)"],
      textStyle: { fontSize: 12, fontWeight: 500 }
    },
    series: [{
      type: "heatmap",
      data: heatmapSeriesData,
      label: { show: !isMobile, fontSize: 11, formatter: (p: any) => fmt(p.data[2]) },
      itemStyle: {
        borderColor: "#fff",
        borderWidth: 2,
        borderRadius: isMobile ? 20 : 14,
        shadowBlur: 6,
        shadowColor: "rgba(0,0,0,0.08)"
      },
      emphasis: { itemStyle: { borderWidth: 4, borderColor: "#7A003C" } }
    }]
  }), [isMobile, xAxisLabels, yAxisLabelsFull, yAxisLabelsShort, heatmapSeriesData]);

  const onEvents = useMemo(() => isMobile ? {
    click: (params: any) => {
      if (params.data) {
        setSelected({ dimIndex: params.data[0], tipoIndex: params.data[1] });
        setDrawerOpen(true);
      }
    }
  } : {}, [isMobile]);

  const selectedDetail = useMemo(() => {
    if (!selected) return null;
    const tipo = tipoAgg[selected.tipoIndex];
    if (!tipo) return null;
    const dimKey = DIM_ORDER[selected.dimIndex];
    const value = tipo[dimKey as keyof typeof tipo] as number | undefined;
    return { tipo, dimKey, value, refs: LGAM_MAP[tipo.tipo_num] || [] };
  }, [selected, tipoAgg]);

  return (
    <main className="min-h-dvh bg-gradient-to-b from-neutral-50 to-white">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-600">Resultados del diagnóstico</p>
            <h1 className="mt-1 text-2xl font-bold text-neutral-900">Tu percepción del entorno</h1>
          </div>
         
        </div>

        {loading ? (
          <Card className="rounded-3xl border-neutral-200">
            <CardContent className="py-12 text-center text-neutral-600">Cargando resultados...</CardContent>
          </Card>
        ) : err ? (
          <Card className="rounded-3xl border-red-200 bg-red-50">
            <CardContent className="py-10 text-center text-red-700">{err}</CardContent>
          </Card>
        ) : (
          <>
            {/* Indicadores globales */}
            <Card className="overflow-hidden rounded-3xl border-neutral-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Indicadores globales</CardTitle>
                <p className="text-sm text-neutral-600">Promedio general en escala 1–5</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {DIM_ORDER.map(dim => (
                    <div key={dim} className="rounded-2xl bg-neutral-50 p-5 text-center">
                      <p className="text-sm font-medium text-neutral-600">{DIM_LABEL_FULL[dim]}</p>
                      <p className="mt-3 text-3xl font-bold tabular-nums text-neutral-900">
                        {fmt(global?.[dim])}
                      </p>
                      <Badge variant={levelBadgeVariant(global?.[dim] ?? 0)} className="mt-3">
                        {levelLabel(global?.[dim] ?? 0)}
                      </Badge>
                    </div>
                  ))}
                  
                  <div
                      className="rounded-2xl p-5 text-center"
                      style={{
                        backgroundColor: "var(--primary)",
                        color: "var(--primary-foreground)",
                      }}
                    >
                      <p className="text-sm font-medium">Total</p>

                      <p className="mt-3 text-3xl font-bold tabular-nums">
                        {fmt(global?.total)}
                      </p>

                      <Badge
                        variant="secondary"
                        className="mt-3"
                        style={{
                          backgroundColor: "color-mix(in oklch, var(--primary-foreground) 18%, transparent)",
                          color: "var(--primary-foreground)",
                          border: "1px solid color-mix(in oklch, var(--primary-foreground) 35%, transparent)",
                        }}
                      >
                        Promedio general
                      </Badge>
                    </div>

                
                </div>
              </CardContent>
            </Card>

            <Separator className="my-10" />

            {/* Heatmap */}
            <Card className="overflow-hidden rounded-3xl border-neutral-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Mapa de calor por tipo de conducta</CardTitle>
                <p className="text-xs text-neutral-600">
                  {isMobile 
                    ? "Toca una celda para ver detalle y referencias de la Ley General de Acceso de las Mujeres a una Vida Libre de Violencia (LGAMVLV)."
                    : "Pasa el ratón sobre una celda para ver detalle."}
                </p>
              </CardHeader>
              <CardContent className="pb-8">
                <div className="rounded-2xl bg-neutral-50/50 p-4">
                  <ReactECharts
                    option={chartOption}
                    style={{ height: chartHeight, width: "100%" }}
                    opts={{ renderer: "canvas" }}
                    onEvents={onEvents}
                  />
                </div>
                {isMobile && (
                  <div className="mt-6 space-y-4">
                    <div className="rounded-2xl border bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Leyenda de dimensiones</span>
                        <span className="text-neutral-500">Escala 1 → 5</span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        {[1,2,3,4,5].map(v => (
                          <div key={v} className="h-6 flex-1 rounded-full" style={{ backgroundColor: colorForValue(v) }} />
                        ))}
                      </div>
                    </div>
                   
                    <div className="rounded-2xl border bg-white p-4 shadow-sm">
                      <p className="mb-3 text-sm font-medium">Lista de tipos</p>

                      <div className="space-y-2">
                        {tipos.map(t => (
                          <div
                              key={t.tipo_num}
                              className="flex items-start gap-3 rounded-xl px-3 py-2 hover:bg-neutral-50 transition-colors"
                            >
                              {/* Pill morado */}
                              <span
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums"
                                style={{
                                  backgroundColor: "var(--primary)",
                                  color: "var(--primary-foreground)",
                                  boxShadow: "0 0 0 3px color-mix(in oklch, var(--ring) 18%, transparent)",
                                }}
                              >
                                {t.tipo_num}
                              </span>

                              <span className="text-sm text-neutral-800 leading-snug">
                                {t.tipo_nombre}
                              </span>
                            </div>
                        ))}
                      </div>
                    </div>

                  
                  </div>
                )}
              </CardContent>
            </Card>

            <Separator className="my-10" />

            {/* Acciones finales */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              
              <Button
                size="lg"
                className="h-14 rounded-full text-base font-semibold text-white"
                style={{ backgroundColor: "#7F017F" }}
                onClick={() => router.push("/")}
              >
                <Home className="mr-3 h-5 w-5" />
                Ir al inicio
              </Button>


            </div>
          </>
        )}
      </div>

      {/* Drawer móvil */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[90dvh] rounded-t-3xl">
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-neutral-300" />
          <DrawerHeader className="pt-4">
            <DrawerTitle>Detalle del tipo seleccionado</DrawerTitle>
            <DrawerDescription>Referencias legales y valores por dimensión</DrawerDescription>
          </DrawerHeader>

          <ScrollArea className="px-4 pb-6">
            {selectedDetail ? (
              <div className="space-y-5">
                <Card className="rounded-2xl border-neutral-200">
                  <CardContent className="pt-6">
                    <h3 className="mb-4 text-lg font-bold text-neutral-900">
                      {selectedDetail.tipo.tipo_num}. {selectedDetail.tipo.tipo_nombre}
                    </h3>

                    {selectedDetail.refs.length > 0 && (
                      <div className="mb-5">
                        <p className="mb-3 text-sm font-medium text-neutral-700">Clasificación LGAMVLV</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedDetail.refs.map((ref, i) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className="bg-pink-50 text-pink-900 border-pink-200"
                            >
                              {ref.tipo}
                            </Badge>
                          ))}
                        </div>
                        {selectedDetail.refs[0]?.nota && (
                          <p className="mt-3 text-sm text-neutral-600">{selectedDetail.refs[0].nota}</p>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-3">
                      {DIM_ORDER.map(dim => {
                        const val = selectedDetail.tipo[dim as keyof TipoAgg] as number | undefined;
                        const isActive = dim === selectedDetail.dimKey;
                        return (
                          <div
                            key={dim}
                            className={`rounded-2xl border-2 p-4 text-center transition-all ${
                              isActive ? "border-neutral-900 bg-neutral-50" : "border-neutral-200"
                            }`}
                          >
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-lg font-bold">{DIM_LABEL_SHORT[dim]}</span>
                              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: colorForValue(val ?? 1) }} />
                            </div>
                            <p className="mt-2 text-2xl font-bold tabular-nums">{fmt(val)}</p>
                            <p className="mt-1 text-xs text-neutral-600">{levelLabel(val ?? 0)}</p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-5 rounded-xl bg-neutral-100 p-4 text-center">
                      <p className="text-sm text-neutral-600">
                        Dimensión seleccionada:{" "}
                        <span className="font-bold text-neutral-900">
                          {DIM_LABEL_FULL[selectedDetail.dimKey]}
                        </span>
                      </p>
                      <p className="mt-1 text-2xl font-bold">
                        {fmt(selectedDetail.value)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <p className="text-center text-neutral-600">Selecciona una celda del mapa de calor.</p>
            )}
          </ScrollArea>

          <DrawerFooter className="border-t pt-4">
            <Button className="h-12 rounded-full" onClick={() => setDrawerOpen(false)}>
              Cerrar
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </main>
  );
}