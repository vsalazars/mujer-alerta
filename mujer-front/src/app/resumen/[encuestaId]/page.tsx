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

import { Home } from "lucide-react";
import { api } from "@/lib/api";

/* =========================
   Tipos
========================= */
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

/* =========================
   Constantes
========================= */
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

/* =========================
   Helpers
========================= */
function fmt(v: unknown): string {
  const n = typeof v === "number" && Number.isFinite(v) ? v : NaN;
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

function levelLabel(v: number): string {
  if (v < 2) return "Bajo";
  if (v < 3) return "Medio";
  if (v < 4) return "Alto";
  return "Muy alto";
}

function levelBadgeVariant(v: number) {
  if (v < 2) return "secondary";
  if (v < 3) return "outline";
  if (v < 4) return "default";
  return "destructive";
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${breakpoint}px)`);
    setIsMobile(mq.matches);
    const h = () => setIsMobile(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, [breakpoint]);
  return isMobile;
}

function colorForValue(v: number): string {
  const t = (Math.min(Math.max(v, 1), 5) - 1) / 4;
  return `rgb(${247 - 125 * t}, ${243 - 220 * t}, ${246 - 185 * t})`;
}

/* =========================
   Página
========================= */
export default function ResultadosEncuestaPage() {
  const router = useRouter();
  const params = useParams();
  const isMobile = useIsMobile();

  const encuestaId =
    (params?.encuestaId as string) || (params?.id as string) || "";

  const [data, setData] = useState<EncuestaResumenResponseBE | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api<EncuestaResumenResponseBE>(
          `/api/encuestas/${encuestaId}/resumen`
        );
        if (alive) setData(res);
      } catch (e: any) {
        if (alive) setErr(e?.message || "Error al cargar resultados");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [encuestaId]);

  const tipos = useMemo(() => {
    const map = new Map<number, string>();
    data?.matriz.forEach((m) => map.set(m.tipo_num, m.tipo_nombre));
    return [...map.entries()].map(([tipo_num, tipo_nombre]) => ({
      tipo_num,
      tipo_nombre,
    }));
  }, [data]);

  const heatmapData = useMemo<[number, number, number][]>(() => {
    const yMap = new Map<number, number>();
    tipos.forEach((t, i) => yMap.set(t.tipo_num, i));
    const xMap = { frecuencia: 0, normalidad: 1, gravedad: 2 } as const;
    return (data?.matriz ?? []).map((m) => [
      xMap[m.dimension],
      yMap.get(m.tipo_num) ?? 0,
      m.promedio,
    ]);
  }, [data, tipos]);

  const chartOption = useMemo(
    () => ({
      animation: false,
      grid: {
        left: 16,
        right: 16,
        top: 16,
        bottom: isMobile ? 104 : 80, // ✅ espacio suficiente
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: isMobile
          ? DIM_ORDER.map((d) => DIM_LABEL_SHORT[d])
          : DIM_ORDER.map((d) => DIM_LABEL_FULL[d]),
      },
      yAxis: {
        type: "category",
        data: tipos.map((t) => String(t.tipo_num)),
      },
      visualMap: {
        min: 1,
        max: 5,
        orient: "horizontal",
        left: "center",
        bottom: isMobile ? 14 : 20,
        itemWidth: isMobile ? 170 : 220,
        itemHeight: 12,
        inRange: {
          color: ["#F7F3F6", "#E7C7D7", "#D29AB9", "#B96C98", "#7A003C"],
        },
        text: isMobile ? ["Muy alto", "Bajo"] : ["Muy alto (5)", "Bajo (1)"],
        textGap: isMobile ? 8 : 14,
        textStyle: {
          fontSize: isMobile ? 11 : 12,
          fontWeight: 500,
        },
      },
      series: [
        {
          type: "heatmap",
          data: heatmapData,
          itemStyle: {
            borderRadius: isMobile ? 20 : 14,
            borderWidth: 2,
            borderColor: "#fff",
          },
        },
      ],
    }),
    [heatmapData, tipos, isMobile]
  );

  if (loading) {
    return <p className="p-10 text-center">Cargando…</p>;
  }

  if (err) {
    return <p className="p-10 text-center text-red-600">{err}</p>;
  }

  const global = data!.global;

  return (
    <main className="min-h-dvh bg-neutral-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Indicadores globales</CardTitle>
            <p className="text-sm text-neutral-600">
              Promedio general en escala 1–5
            </p>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {DIM_ORDER.map((dim) => (
                <div
                  key={dim}
                  className="rounded-2xl bg-neutral-50 p-5 text-center"
                >
                  <p className="text-sm">{DIM_LABEL_FULL[dim]}</p>
                  <p className="mt-3 text-3xl font-bold">
                    {fmt(global[dim])}
                  </p>
                  <Badge
                    variant={levelBadgeVariant(global[dim])}
                    className="mt-3"
                  >
                    {levelLabel(global[dim])}
                  </Badge>
                </div>
              ))}

              {/* TOTAL */}
              <div
                className="rounded-2xl p-5 text-center"
                style={{
                  backgroundColor: "var(--primary)",
                  color: "var(--primary-foreground)",
                }}
              >
                <p className="text-sm font-medium">Total</p>
                <p className="mt-3 text-3xl font-bold">
                  {fmt(global.total)}
                </p>

                {/* ✅ CENTRADO PERFECTO */}
                <Badge
                  variant="secondary"
                  className="mt-3 mx-auto inline-flex w-[132px] justify-center text-center whitespace-normal leading-tight"
                  style={{
                    backgroundColor:
                      "color-mix(in oklch, var(--primary-foreground) 18%, transparent)",
                    color: "var(--primary-foreground)",
                    border:
                      "1px solid color-mix(in oklch, var(--primary-foreground) 35%, transparent)",
                  }}
                >
                  Promedio<br />general
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator className="my-10" />

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Mapa de calor</CardTitle>
          </CardHeader>
          <CardContent>
            <ReactECharts
              option={chartOption}
              style={{ height: 560, width: "100%" }}
            />
          </CardContent>
        </Card>

        <div className="mt-10">
          <Button
            size="lg"
            className="h-14 rounded-full"
            style={{ backgroundColor: "#7F017F" }}
            onClick={() => router.push("/")}
          >
            <Home className="mr-3 h-5 w-5" />
            Ir al inicio
          </Button>
        </div>
      </div>
    </main>
  );
}
