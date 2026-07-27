"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams, usePathname, useRouter } from "next/navigation";
import ReactECharts from "echarts-for-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";

import { ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import {
  cacheBranding,
  readCachedBranding,
  themeFromBranding,
} from "@/lib/branding";
import { extractInstitutionSlug } from "@/lib/routing";
import { CheckCircle } from "lucide-react";


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

type TenantBranding = {
  institucion_id: number;
  nombre_publico?: string;
  logo_url?: string;
  color_primario?: string;
  color_secundario?: string;
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
const LGAM_MAP: Record<
  number,
  { tipo: string; articulo?: string; nota?: string }[]
> = {
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
      nota: "Obstaculización del acceso a derechos o atención por parte de autoridades.",
    },
  ],
  3: [
    {
      tipo: "Violencia sexual",
      articulo: "LGAMVLV Art. 6",
      nota: "Sexualización, comentarios o conductas de contenido sexual no consentido.",
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
      nota: "En contextos de poder jerárquico escolar o laboral.",
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
      nota: "Limitación de recursos o oportunidades por razón de género.",
    },
    {
      tipo: "Violencia institucional",
      nota: "Uso indebido de autoridad para restringir derechos.",
    },
  ],
  6: [
    {
      tipo: "Violencia laboral y docente",
      nota: "Obstaculización en ámbitos escolar/laboral por razón de género.",
    },
    {
      tipo: "Violencia económica",
      articulo: "LGAMVLV Art. 6",
      nota: "Afectación de ingresos o condiciones laborales.",
    },
    {
      tipo: "Violencia psicológica",
      articulo: "LGAMVLV Art. 6",
      nota: "Amenazas o desvalorización ligada al desempeño.",
    },
  ],
  7: [
    {
      tipo: "Violencia digital y mediática",
      nota: "Daño mediante difusión, exposición o hostigamiento digital.",
    },
  ],
  8: [
    {
      tipo: "Violencia física",
      articulo: "LGAMVLV Art. 6",
      nota: "Agresión o daño físico no accidental.",
    },
    {
      tipo: "Violencia psicológica",
      articulo: "LGAMVLV Art. 6",
      nota: "Amenazas que generan temor o control.",
    },
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

function levelBadgeStyle(v: number, primary: string, secondary: string) {
  if (!Number.isFinite(v)) {
    return {
      backgroundColor: "#F3F4F6",
      color: "#4B5563",
      border: "1px solid #E5E7EB",
    };
  }
  if (v < 2) {
    return {
      backgroundColor: "rgba(148,163,184,0.12)",
      color: "#475569",
      border: "1px solid rgba(148,163,184,0.22)",
    };
  }
  if (v < 3) {
    return {
      backgroundColor: "rgba(148,163,184,0.18)",
      color: "#334155",
      border: "1px solid rgba(148,163,184,0.28)",
    };
  }
  if (v < 4) {
    return {
      backgroundColor: secondary,
      color: "white",
      border: `1px solid ${secondary}`,
    };
  }
  return {
    backgroundColor: primary,
    color: "white",
    border: `1px solid ${primary}`,
  };
}

function useIsMobile(breakpointPx = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${breakpointPx}px)`).matches;
  });
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx}px)`);
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

function colorForValueBrand(v: number, primary: string, secondary: string): string {
  if (!Number.isFinite(v)) return "#f9fafb";
  const t = (Math.min(Math.max(v, 1), 5) - 1) / 4;
  const start = { r: 247, g: 243, b: 246 };
  const mid = hexToRgb(secondary);
  const end = hexToRgb(primary);
  const target = t < 0.6 ? mix(start, mid, t / 0.6) : mix(mid, end, (t - 0.6) / 0.4);
  return `rgb(${target.r}, ${target.g}, ${target.b})`;
}

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function mix(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, t: number) {
  const safe = Math.max(0, Math.min(1, t));
  return {
    r: Math.round(a.r + (b.r - a.r) * safe),
    g: Math.round(a.g + (b.g - a.g) * safe),
    b: Math.round(a.b + (b.b - a.b) * safe),
  };
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
  const pathname = usePathname();
  const institucionSlug = extractInstitutionSlug(pathname);
  const isMobile = useIsMobile();

  const encuestaId =
    (params?.encuestaId as string) || (params?.id as string) || "";

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState<EncuestaResumenResponseBE | null>(null);
  const [branding, setBranding] = useState<TenantBranding | null>(() =>
    readCachedBranding<TenantBranding>(institucionSlug)
  );
  const [brandingReady, setBrandingReady] = useState(() => branding !== null);
  const theme = themeFromBranding(branding);

  const [farewellOpen, setFarewellOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<{
    tipoIndex: number;
    dimIndex: number;
  } | null>(null);

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
        const payload = await api<EncuestaResumenResponseBE>(
          `/api/encuestas/${encuestaId}/resumen`
        );
        if (alive) setData(payload);
      } catch (e: any) {
        if (alive) setErr(e?.message || "Error al cargar los resultados.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    fetchData();
    return () => {
      alive = false;
    };
  }, [encuestaId]);

  useEffect(() => {
    let alive = true;
    void api<TenantBranding>("/api/tenant/branding")
      .then((payload) => {
        if (!alive) return;
        cacheBranding(payload, institucionSlug);
        setBranding(payload);
      })
      .catch(() => {
        if (alive) setBranding(null);
      })
      .finally(() => {
        if (alive) setBrandingReady(true);
      });
    return () => {
      alive = false;
    };
  }, [institucionSlug]);

  const global = data?.global;

  const tipos = useMemo(() => {
    const map = new Map<number, string>();
    data?.matriz.forEach((it) => {
      if (!map.has(it.tipo_num)) map.set(it.tipo_num, it.tipo_nombre);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([tipo_num, tipo_nombre]) => ({ tipo_num, tipo_nombre }));
  }, [data]);

  const tipoAgg = useMemo<TipoAgg[]>(() => {
    const map = new Map<number, TipoAgg>();
    tipos.forEach((t) => map.set(t.tipo_num, { ...t }));
    data?.matriz.forEach((it) => {
      const obj = map.get(it.tipo_num);
      if (obj) (obj as any)[it.dimension] = it.promedio;
    });
    return tipos.map((t) => map.get(t.tipo_num)!);
  }, [data, tipos]);

  const yAxisLabelsFull = useMemo(
    () => tipos.map((t) => `${t.tipo_num}. ${t.tipo_nombre}`),
    [tipos]
  );
  const yAxisLabelsShort = useMemo(() => tipos.map((t) => String(t.tipo_num)), [
    tipos,
  ]);

  const heatmapSeriesData = useMemo<[number, number, number][]>(() => {
    const yMap = new Map<number, number>();
    tipos.forEach((t, i) => yMap.set(t.tipo_num, i));
    const xMap: Record<BackendDimension, number> = {
      frecuencia: 0,
      normalidad: 1,
      gravedad: 2,
    };
    return (data?.matriz ?? []).map((it) => [
      xMap[it.dimension],
      yMap.get(it.tipo_num) ?? 0,
      it.promedio,
    ]);
  }, [data, tipos]);

  const xAxisLabels = useMemo(
    () =>
      isMobile
        ? DIM_ORDER.map((d) => DIM_LABEL_SHORT[d])
        : DIM_ORDER.map((d) => DIM_LABEL_FULL[d]),
    [isMobile]
  );

  const chartHeight = useMemo(() => {
    const rows = Math.max(1, tipos.length);
    return isMobile
      ? Math.min(900, Math.max(560, 140 + rows * 64))
      : Math.min(640, Math.max(360, 100 + rows * 48));
  }, [tipos.length, isMobile]);

  const chartOption = useMemo(
    () => ({
      animation: false,
      grid: {
        left: 16,
        right: 16,
        top: 16,
        bottom: isMobile ? 104 : 80,
        containLabel: true,
      },
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
          const x = p.data[0],
            y = p.data[1],
            v = p.data[2];
          const dim = DIM_LABEL_FULL[DIM_ORDER[x]];
          const tipo = yAxisLabelsFull[y];
          return `<strong>${tipo}</strong><br/>${dim}: <strong>${fmt(
            v
          )}</strong> <em>(${levelLabel(v)})</em>`;
        },
      },
      xAxis: {
        type: "category",
        data: xAxisLabels,
        axisLabel: { fontSize: 13, margin: 16 },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#e5e7eb" } },
      },
      yAxis: {
        type: "category",
        data: isMobile ? yAxisLabelsShort : yAxisLabelsFull,
        axisLabel: {
          fontSize: 12,
          width: isMobile ? 32 : 300,
          overflow: isMobile ? "truncate" : "truncate",
          margin: 14,
        },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#e5e7eb" } },
      },
      visualMap: {
        min: 1,
        max: 5,
        calculable: false,
        orient: "horizontal",
        left: "center",
        bottom: 20,
        inRange: {
          color: [
            colorForValueBrand(1, theme.primary, theme.secondary),
            colorForValueBrand(2, theme.primary, theme.secondary),
            colorForValueBrand(3, theme.primary, theme.secondary),
            colorForValueBrand(4, theme.primary, theme.secondary),
            colorForValueBrand(5, theme.primary, theme.secondary),
          ],
        },
        text: ["Muy alto", "Bajo"],
        textGap: 14,
        textStyle: {
          fontSize: isMobile ? 11 : 12,
          fontWeight: 500,
          overflow: "break",
          width: isMobile ? 140 : 180,
        },
      },
      series: [
        {
          type: "heatmap",
          data: heatmapSeriesData,
          label: {
            show: !isMobile,
            fontSize: 11,
            formatter: (p: any) => fmt(p.data[2]),
          },
          itemStyle: {
            borderColor: "#fff",
            borderWidth: 2,
            borderRadius: isMobile ? 20 : 14,
            shadowBlur: 6,
            shadowColor: "rgba(0,0,0,0.08)",
          },
          emphasis: { itemStyle: { borderWidth: 4, borderColor: theme.primary } },
        },
      ],
    }),
    [isMobile, xAxisLabels, yAxisLabelsFull, yAxisLabelsShort, heatmapSeriesData, theme.primary, theme.secondary]
  );

  const onEvents = useMemo(
    () =>
      isMobile
        ? {
            click: (params: any) => {
              if (params.data) {
                setSelected({ dimIndex: params.data[0], tipoIndex: params.data[1] });
                setDrawerOpen(true);
              }
            },
          }
        : undefined,
    [isMobile]
  );

  const selectedDetail = useMemo(() => {
    if (!selected) return null;
    const tipo = tipoAgg[selected.tipoIndex];
    if (!tipo) return null;
    const dimKey = DIM_ORDER[selected.dimIndex];
    const value = tipo[dimKey as keyof typeof tipo] as number | undefined;
    return { tipo, dimKey, value, refs: LGAM_MAP[tipo.tipo_num] || [] };
  }, [selected, tipoAgg]);

  const panelStyle = {
    borderColor: theme.border,
    boxShadow: `0 22px 50px -30px ${theme.glow}`,
  } as React.CSSProperties;

  const softPanelStyle = {
    borderColor: theme.border,
    background: `linear-gradient(180deg, #ffffff 0%, ${theme.soft} 100%)`,
  } as React.CSSProperties;

  if (!brandingReady) return null;

  return (
    <main
      className="min-h-dvh bg-white"
      style={{
        backgroundImage: `linear-gradient(180deg, #ffffff 0%, ${theme.soft} 22%, #ffffff 100%)`,
      }}
    >
      <Dialog open={farewellOpen} onOpenChange={setFarewellOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-w-xl rounded-[2rem] border bg-white/98 p-0 shadow-[0_28px_90px_rgba(15,23,42,0.22)]"
          style={{ borderColor: theme.border }}
        >
          <div
            className="rounded-t-[2rem] px-6 py-5"
            style={{
              background: `linear-gradient(135deg, ${theme.soft} 0%, #ffffff 100%)`,
            }}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden">
                <Image
                  src="/avatar.png"
                  alt="Avatar de despedida"
                  width={80}
                  height={80}
                  className="h-full w-full object-cover"
                  priority
                />
              </div>
              <DialogHeader className="text-left">
                <DialogTitle style={{ color: theme.primary }}>Gracias</DialogTitle>
                <DialogDescription className="text-sm leading-7 text-neutral-700">
                  Por compartir tu tiempo, opinión y experiencia con nosotros.
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>

          <div className="px-6 pb-6 pt-4">
            <Button
              onClick={() => setFarewellOpen(false)}
              className="h-12 w-full rounded-full text-base font-semibold text-white"
              style={{ background: theme.gradient }}
            >
              Ver resultados
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="sticky top-0 z-20 -mx-4 mb-6 bg-white/92 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/80 sm:-mx-6 sm:mb-8 sm:px-6 lg:-mx-8 lg:px-8">
          <div
            className="rounded-[2rem] border px-4 py-4 sm:px-6 sm:py-5"
            style={{
              ...softPanelStyle,
              boxShadow: `0 18px 45px -32px ${theme.glow}`,
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
              {branding?.logo_url ? (
                <div className="mb-4 flex items-center gap-3">
                  <img
                    src={branding.logo_url}
                    alt={branding.nombre_publico || "Logo institucional"}
                    className="h-14 w-auto max-w-[96px] shrink-0 object-contain sm:h-16 sm:max-w-[120px]"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-5 sm:text-base" style={{ color: theme.primary }}>
                      {branding.nombre_publico || "Institución participante"}
                    </p>
                  </div>
                </div>
              ) : null}
              <p className="text-sm font-medium text-neutral-600">
                Resultados del diagnóstico
              </p>
              <h1 className="mt-1 text-2xl font-bold leading-tight sm:text-3xl" style={{ color: theme.primary }}>
                Tu percepción del entorno
              </h1>
              </div>
              {!branding?.logo_url ? (
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border bg-white shadow-sm" style={{ borderColor: theme.border }}>
                  <ShieldCheck className="h-5 w-5" style={{ color: theme.primary }} />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {loading ? (
          <Card className="rounded-3xl border-neutral-200">
            <CardContent className="py-12 text-center text-neutral-600">
              Cargando resultados...
            </CardContent>
          </Card>
        ) : err ? (
          <Card className="rounded-3xl border-red-200 bg-red-50">
            <CardContent className="py-10 text-center text-red-700">
              {err}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Indicadores globales */}
            <Card className="overflow-hidden rounded-3xl border shadow-sm" style={panelStyle}>
              <CardHeader>
                <CardTitle className="text-lg font-semibold" style={{ color: theme.primary }}>
                  Indicadores globales
                </CardTitle>
                <p className="text-sm text-neutral-600">
                  Promedio general en escala 1–5
                </p>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-4">
                  {DIM_ORDER.map((dim) => (
                    <div
                      key={dim}
                      className="rounded-2xl p-5 text-center"
                      style={{
                        background: `linear-gradient(180deg, #ffffff 0%, ${theme.soft} 100%)`,
                        border: `1px solid ${theme.border}`,
                      }}
                    >
                      <p className="text-sm font-medium" style={{ color: theme.primary }}>
                        {DIM_LABEL_FULL[dim]}
                      </p>

                      <p className="mt-3 text-3xl font-bold tabular-nums text-neutral-900">
                        {fmt(global?.[dim])}
                      </p>

                      <Badge
                        variant="outline"
                        className="mt-3"
                        style={levelBadgeStyle(global?.[dim] ?? 0, theme.primary, theme.secondary)}
                      >
                        {levelLabel(global?.[dim] ?? 0)}
                      </Badge>
                    </div>
                  ))}

                  {/* ✅ ÚNICO CAMBIO: card Total con layout flex para centrar el badge REAL */}
                  <div
                    className="rounded-2xl p-5 flex min-h-[154px] flex-col items-center justify-center text-center"
                    style={{
                      background: theme.gradientWide,
                      color: "white",
                      boxShadow: `0 16px 40px -28px ${theme.glow}`,
                    }}
                  >
                    <p className="text-sm font-medium">Total</p>

                    <p className="mt-3 text-3xl font-bold tabular-nums">
                      {fmt(global?.total)}
                    </p>

                   <div className="mt-3 flex justify-center">
                      <Badge
                        variant="secondary"
                        className="
                          inline-flex
                          w-[110px]
                          min-h-[34px]
                          items-center
                          justify-center
                          text-center
                          leading-[1.05]
                          py-1
                        "
                        style={{
                          backgroundColor: "rgba(255,255,255,0.16)",
                          color: "white",
                          border: "1px solid rgba(255,255,255,0.28)",
                        }}
                      >
                        <span className="block">
                          Promedio<br />general
                        </span>
                      </Badge>
                  </div>

                  </div>
                </div>
              </CardContent>
            </Card>

            <Separator className="my-10" />

            {/* Heatmap */}
            <Card className="overflow-hidden rounded-3xl border shadow-sm" style={panelStyle}>
              <CardHeader>
                <CardTitle className="text-lg font-semibold" style={{ color: theme.primary }}>
                  Mapa de calor por tipo de violencia
                </CardTitle>
                <p className="text-xs text-neutral-600">
                  {isMobile
                    ? "Toca una celda para ver detalle y referencias de la Ley General de Acceso de las Mujeres a una Vida Libre de Violencia (LGAMVLV)."
                    : "Pasa el ratón sobre una celda para ver detalle."}
                </p>
              </CardHeader>

              <CardContent className="pb-6 sm:pb-8">
                <div
                  className="overflow-hidden rounded-2xl p-3 sm:p-4"
                  style={{
                    background: `linear-gradient(180deg, #ffffff 0%, ${theme.soft} 100%)`,
                    border: `1px solid ${theme.border}`,
                  }}
                >
                  <ReactECharts
                    option={chartOption}
                    style={{ height: chartHeight, width: "100%" }}
                    opts={{ renderer: "canvas" }}
                    onEvents={onEvents}
                  />
                </div>

                {isMobile && (
                  <div className="mt-6 space-y-4">
                    <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: theme.border }}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium leading-none" style={{ color: theme.primary }}>
                          Leyenda de dimensiones
                        </span>
                        <span className="text-neutral-500 leading-none whitespace-nowrap">
                          Escala 1 → 5
                        </span>
                      </div>

                      <div className="mt-3 flex gap-2">
                        {[1, 2, 3, 4, 5].map((v) => (
                          <div
                            key={v}
                            className="h-6 flex-1 rounded-full"
                            style={{ backgroundColor: colorForValueBrand(v, theme.primary, theme.secondary) }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: theme.border }}>
                      <p className="mb-3 text-sm font-medium" style={{ color: theme.primary }}>
                        Tipos de Violencia contra la Mujer
                      </p>

                      <div className="space-y-2">
                        {tipos.map((t) => (
                          <div
                            key={t.tipo_num}
                            className="flex items-start gap-3 rounded-xl px-3 py-2 transition-colors"
                            style={{ backgroundColor: "transparent" }}
                          >
                            <span
                              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums"
                              style={{
                                background: theme.gradientWide,
                                color: "white",
                                boxShadow: `0 0 0 3px ${theme.softStrong}`,
                              }}
                            >
                              {t.tipo_num}
                            </span>

                            <span className="min-w-0 text-sm leading-snug text-neutral-800">
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
                style={{ background: theme.gradient }}
                onClick={() => router.push("/")}
              >
                <CheckCircle className="mr-3 h-5 w-5" />

                Finalizar
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Drawer móvil */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent
          className="rounded-t-3xl flex flex-col overflow-hidden"
          style={{ maxHeight: "calc(100dvh - 96px)" }}
        >
          {/* Handle */}
          <div className="mx-auto mt-2 h-1.5 w-12 rounded-full" style={{ backgroundColor: theme.softStrong }} />

          {/* Header compacto */}
          <DrawerHeader className="relative shrink-0 border-b pt-3 pb-2" style={{ borderColor: theme.border }}>
            <DrawerTitle className="text-base" style={{ color: theme.primary }}>
              Detalle del tipo seleccionado
            </DrawerTitle>
            <DrawerDescription className="text-xs">
              Referencias legales y valores por dimensión
            </DrawerDescription>

            <button
              aria-label="Cerrar"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full transition"
              style={{
                backgroundColor: theme.soft,
                color: theme.primary,
                border: `1px solid ${theme.border}`,
              }}
            >
              ✕
            </button>
          </DrawerHeader>

          {/* ✅ Scroll SOLO contenido */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-4 pb-28">
              {selectedDetail ? (
                <Card className="rounded-2xl border" style={panelStyle}>
                  <CardContent className="pt-4 pb-4">
                    <h3 className="mb-3 text-sm font-bold leading-snug" style={{ color: theme.primary }}>
                      {selectedDetail.tipo.tipo_num}.{" "}
                      {selectedDetail.tipo.tipo_nombre}
                    </h3>

                    {selectedDetail.refs.length > 0 && (
                      <div className="mb-3">
                        <p className="mb-2 text-xs font-medium" style={{ color: theme.primary }}>
                          Clasificación LGAMVLV
                        </p>

                        <div className="flex flex-wrap gap-1.5">
                          {selectedDetail.refs.map((ref, i) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className="px-2 py-0.5 text-[11px]"
                              style={{
                                backgroundColor: theme.soft,
                                color: theme.primary,
                                borderColor: theme.border,
                              }}
                            >
                              {ref.tipo}
                            </Badge>
                          ))}
                        </div>

                        {selectedDetail.refs[0]?.nota && (
                          <p className="mt-2 text-xs text-neutral-600 leading-snug">
                            {selectedDetail.refs[0].nota}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-3">
                      {DIM_ORDER.map((dim) => {
                        const val = selectedDetail.tipo[
                          dim as keyof TipoAgg
                        ] as number | undefined;
                        const isActive = dim === selectedDetail.dimKey;

                        return (
                          <div
                            key={dim}
                            className="rounded-2xl border-2 p-2.5 text-center transition-all"
                            style={{
                              borderColor: isActive ? theme.primary : theme.border,
                              background: isActive ? `linear-gradient(180deg, #ffffff 0%, ${theme.soft} 100%)` : "#ffffff",
                              boxShadow: isActive ? `0 10px 24px -18px ${theme.glow}` : "none",
                            }}
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="text-sm font-bold" style={{ color: isActive ? theme.primary : undefined }}>
                                {DIM_LABEL_SHORT[dim]}
                              </span>
                              <div
                                className="h-2.5 w-2.5 rounded-full"
                                style={{
                                  backgroundColor: colorForValue(val ?? 1),
                                }}
                              />
                            </div>

                            <p className="mt-1 text-xl font-bold tabular-nums leading-none">
                              {fmt(val)}
                            </p>
                            <p className="mt-0.5 text-[11px] text-neutral-600 leading-none">
                              {levelLabel(val ?? 0)}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    <div
                      className="mt-3 rounded-xl p-3 text-center"
                      style={{
                        background: `linear-gradient(180deg, #ffffff 0%, ${theme.soft} 100%)`,
                        border: `1px solid ${theme.border}`,
                      }}
                    >
                      <p className="text-xs text-neutral-600">
                        Dimensión seleccionada:{" "}
                        <span className="font-semibold" style={{ color: theme.primary }}>
                          {DIM_LABEL_FULL[selectedDetail.dimKey]}
                        </span>
                      </p>
                      <p className="mt-1 text-xl font-bold leading-none" style={{ color: theme.primary }}>
                        {fmt(selectedDetail.value)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <p className="px-4 text-center text-sm text-neutral-600">
                  Selecciona una celda del mapa de calor.
                </p>
              )}
            </div>
          </ScrollArea>

          {/* ✅ Footer fijo REAL (siempre visible) */}
          <div
            className="shrink-0 border-t bg-white/95 backdrop-blur px-4 pt-3"
            style={{
              borderColor: theme.border,
              paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
            }}
          >
            <Button
              className="mb-2 h-11 w-full rounded-full text-white"
              style={{ background: theme.gradientWide }}
              onClick={() => setDrawerOpen(false)}
            >
              Cerrar
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </main>
  );
}
