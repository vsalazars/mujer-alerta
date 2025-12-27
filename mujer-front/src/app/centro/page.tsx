"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  Users,
  Sigma,
  Activity,
  Sparkles,
  BarChart3,
  Radar as RadarIcon,
  Grid3X3,
  ArrowUpRight,
  Calendar,
} from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendsModal } from "@/components/centro/TrendsModal";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/* ======= Nivo (SVG versions) ======= */
const ResponsiveHeatMap = dynamic(
  () => import("@nivo/heatmap").then((m) => m.ResponsiveHeatMap),
  { ssr: false }
);
const ResponsiveRadar = dynamic(
  () => import("@nivo/radar").then((m) => m.ResponsiveRadar),
  { ssr: false }
);
const ResponsiveBar = dynamic(
  () => import("@nivo/bar").then((m) => m.ResponsiveBar),
  { ssr: false }
);

/* =======================
   Types (según tu back)
   ======================= */
type ResumenGlobal = {
  frecuencia: number;
  normalidad: number;
  gravedad: number;
  total: number;
};

type MatrizItem = {
  tipo_num: number;
  tipo_nombre: string;
  dimension: "frecuencia" | "normalidad" | "gravedad";
  promedio: number;
};

type CountItem = { clave: string; label: string; total: number };

type GeneroDimItem = {
  clave: string;
  label: string;
  frecuencia: number;
  normalidad: number;
  gravedad: number;
};

type ComentarioItem = {
  encuesta_id: string;
  fecha: string;
  genero: string;
  edad: number;
  texto: string;
};

type CentroStats = {
  total_participantes: number;
  total_encuestas: number;
  total_respuestas: number;

  encuestas_por_genero: CountItem[];
  respuestas_por_genero: CountItem[];

  encuestas_por_edad: CountItem[];
  respuestas_por_edad: CountItem[];

  resumen_por_genero: GeneroDimItem[];
  comentarios?: ComentarioItem[];
};

type CentroResumenResponse = {
  centros: number[];
  global: ResumenGlobal;
  matriz: MatrizItem[];
  stats: CentroStats;
};

const PURPLE = "#7F017F";

/* =======================
   ✅ NUEVO: Estadística avanzada
   ======================= */
type AdvRow = {
  dimension: "frecuencia" | "normalidad" | "gravedad" | string;

  n_respuestas: number;
  n_encuestas: number;

  total_respuestas: number;
  k_items: number;         

  promedio: number;
  std_dev: number;

  mediana: number;
  p25: number;
  p75: number;

  ic95_inferior: number;
  ic95_superior: number;

  alpha_cronbach: number;

  std_dev_encuestas: number;
  ic95_inferior_encuestas: number;
  ic95_superior_encuestas: number;

};


type CentroEstadisticaAvanzadaResponse = {
  centros: number[];
  year: number;
  datos: AdvRow[];
};

/* =======================
   Helpers
   ======================= */
function clamp5(x: number) {
  const n = Number.isFinite(x) ? x : 0;
  return Math.max(0, Math.min(5, n));
}
function fmt2(x: number) {
  return clamp5(x).toFixed(2);
}
function fmtInt(x: number) {
  return Math.round(Number.isFinite(x) ? x : 0).toLocaleString("es-MX");
}
function safeArr<T>(v?: T[] | null) {
  return Array.isArray(v) ? v : [];
}
function pctFrom5(x: number) {
  const v = clamp5(x);
  return Math.round((v / 5) * 100);
}

type Semantic5 = "Muy bajo" | "Bajo" | "Medio" | "Alto" | "Muy alto";
function toNearestLikert(x: number): 1 | 2 | 3 | 4 | 5 {
  const v = clamp5(x);
  const r = Math.round(v);
  const rr = Math.max(1, Math.min(5, r));
  return rr as 1 | 2 | 3 | 4 | 5;
}
function semanticLevel5(x: number): Semantic5 {
  const k = toNearestLikert(x);
  switch (k) {
    case 1:
      return "Muy bajo";
    case 2:
      return "Bajo";
    case 3:
      return "Medio";
    case 4:
      return "Alto";
    case 5:
      return "Muy alto";
  }
}
function semanticBadgeClass5(level: Semantic5, onDark = false) {
  if (onDark) return "bg-primary text-primary-foreground border border-primary";
  switch (level) {
    case "Muy bajo":
      return "bg-slate-50 text-slate-700 border border-slate-200";
    case "Bajo":
      return "bg-slate-100 text-slate-800 border border-slate-200";
    case "Medio":
      return "bg-[rgba(127,1,127,0.10)] text-[rgba(127,1,127,1)] border border-[rgba(127,1,127,0.18)]";
    case "Alto":
      return "bg-[rgba(127,1,127,0.18)] text-[rgba(127,1,127,1)] border border-[rgba(127,1,127,0.22)]";
    case "Muy alto":
      return "bg-[rgba(127,1,127,0.26)] text-[rgba(127,1,127,1)] border border-[rgba(127,1,127,0.28)]";
  }
}
function wrapLabel(s: string, maxLen = 18, maxLines = 2) {
  const txt = (s || "").trim();
  if (!txt) return "";
  const words = txt.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxLen) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
    if (lines.length >= maxLines) break;
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  const joined = lines.join(" ");
  if (joined.length < txt.length) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/\s+$/, "") + "…";
  }
  return lines.join("\n");
}

/* =======================
   ✅ Años (desde back si existe)
   ======================= */
type YearOption = { value: string; label: string };

function fallbackYears(): YearOption[] {
  const y = new Date().getFullYear();
  const out: YearOption[] = [{ value: "all", label: "Todos" }];
  for (let i = 0; i < 8; i++) out.push({ value: String(y - i), label: String(y - i) });
  return out;
}

export default function CentroPage() {
  const [data, setData] = useState<CentroResumenResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [showSemantic, setShowSemantic] = useState(true);

  // ✅ Modal Tendencias
  const [trendsOpen, setTrendsOpen] = useState(false);

  // ✅ options reales
  const [yearOptions, setYearOptions] = useState<YearOption[]>(fallbackYears());
  const [year, setYear] = useState<string>("all");

  /* ✅ NUEVO: hooks de estadística avanzada (DENTRO del componente) */
  const [advRows, setAdvRows] = useState<AdvRow[]>([]);
  const [advLoading, setAdvLoading] = useState(false);
  const [advErr, setAdvErr] = useState("");

  async function load(selectedYear?: string) {
    const y = selectedYear ?? year;

    setLoading(true);
    setErr("");
    try {
      const qs = y && y !== "all" ? `?year=${encodeURIComponent(y)}` : "";
      const res = await api<CentroResumenResponse>(`/api/centro/resumen${qs}`);
      setData(res);

      try {
        localStorage.setItem("centro_dashboard_year", y || "all");
      } catch {}
    } catch (e: any) {
      setErr(e?.message || "No se pudo cargar el resumen");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadAdvanced(selectedYear?: string) {
    const y = selectedYear ?? year;

    // solo aplica cuando hay año específico
    if (!y || y === "all") {
      setAdvRows([]);
      setAdvErr("");
      setAdvLoading(false);
      return;
    }

    setAdvLoading(true);
    setAdvErr("");
    try {
      const res = await api<CentroEstadisticaAvanzadaResponse>(
        `/api/centro/estadistica-avanzada?year=${encodeURIComponent(y)}`
      );
      setAdvRows(Array.isArray(res?.datos) ? res.datos : []);
    } catch (e: any) {
      setAdvErr(e?.message || "Error al cargar estadística avanzada");
      setAdvRows([]);
    } finally {
      setAdvLoading(false);
    }
  }

  // ✅ NUEVO: carga years desde back (si existe) + carga dashboard con año persistido
  useEffect(() => {
    (async () => {
      // 1) Año guardado (si existe)
      let saved: string | null = null;
      try {
        saved = localStorage.getItem("centro_dashboard_year");
      } catch {}

      // 2) Intenta traer años reales del back
      try {
        const years = await api<number[] | { years: number[] }>(`/api/centro/years`);
        const arr = Array.isArray(years)
          ? years
          : Array.isArray((years as any)?.years)
          ? (years as any).years
          : [];
        const clean = arr
          .map((n) => Number(n))
          .filter((n) => Number.isFinite(n) && n >= 2000 && n <= 2100)
          .sort((a, b) => b - a);

        if (clean.length) {
          const opts: YearOption[] = [{ value: "all", label: "Todos" }].concat(
            clean.map((yy) => ({ value: String(yy), label: String(yy) }))
          );
          setYearOptions(opts);

          const ok = saved && (saved === "all" || opts.some((o) => o.value === saved));
          const initialYear = ok ? (saved as string) : "all";

          setYear(initialYear);
          await load(initialYear);
          await loadAdvanced(initialYear);
          return;
        }
      } catch {
        // swallow → fallback
      }

      // 3) Fallback years + carga
      const ok = saved && (saved === "all" || /^\d{4}$/.test(saved));
      const initialYear = ok ? (saved as string) : "all";
      setYearOptions(fallbackYears());
      setYear(initialYear);
      await load(initialYear);
      await loadAdvanced(initialYear);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ si usuario cambia año, recarga todo
  useEffect(() => {
    if (!data && loading) return;
    load(year);
    loadAdvanced(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  /* =======================
     HeatMap data prep
     ======================= */
  const heatmap = useMemo(() => {
    if (!data) return null;

    const tipoMap = new Map<number, string>();
    for (const r of data.matriz) tipoMap.set(r.tipo_num, r.tipo_nombre);

    const tipos = Array.from(tipoMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([n, name]) => ({ n, name }));

    const map = new Map<string, number>();
    for (const r of data.matriz) {
      map.set(`${r.dimension}:${r.tipo_num}`, clamp5(r.promedio));
    }

    const mkRow = (id: string, dim: MatrizItem["dimension"]) => ({
      id,
      data: tipos.map((t) => ({
        x: `${t.name}`,
        y: Number((map.get(`${dim}:${t.n}`) ?? 0).toFixed(2)),
      })),
    });

    return {
      xCount: tipos.length,
      data: [
        mkRow("Frecuencia", "frecuencia"),
        mkRow("Normalización", "normalidad"),
        mkRow("Gravedad", "gravedad"),
      ],
    };
  }, [data]);

  /* =======================
     Radar data prep
     ======================= */
  const radar = useMemo(() => {
    if (!data) return null;
    return {
      keys: ["Global"],
      data: [
        { dimension: "Frecuencia", Global: clamp5(data.global.frecuencia) },
        { dimension: "Normalización", Global: clamp5(data.global.normalidad) },
        { dimension: "Gravedad", Global: clamp5(data.global.gravedad) },
        { dimension: "Total", Global: clamp5(data.global.total) },
      ],
    };
  }, [data]);

  const generoBars = useMemo(() => {
    if (!data) return [];
    return safeArr(data.stats.encuestas_por_genero)
      .slice()
      .sort((a, b) => (b.total || 0) - (a.total || 0))
      .map((x) => ({ label: x.label, total: x.total || 0 }));
  }, [data]);

  const edadBars = useMemo(() => {
    if (!data) return [];
    return safeArr(data.stats.encuestas_por_edad)
      .slice()
      .sort((a, b) => a.label.localeCompare(b.label, "es", { numeric: true }))
      .map((x) => ({ label: x.label, total: x.total || 0 }));
  }, [data]);

  const generoStack = useMemo(() => {
    if (!data) return [];
    return safeArr(data.stats.resumen_por_genero)
      .slice()
      .map((g) => ({
        label: g.label,
        Frecuencia: clamp5(g.frecuencia),
        Normalización: clamp5(g.normalidad),
        Gravedad: clamp5(g.gravedad),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "es", { numeric: true }));
  }, [data]);

  // ✅ helper (no hook)
  function truncate(s: string, n = 180) {
    const t = (s || "").trim();
    if (t.length <= n) return t;
    return t.slice(0, n).trimEnd() + "…";
  }

  function formatFechaES(iso?: string) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;

    return new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  }

  // ✅ hook SIEMPRE antes de returns condicionales
  const comentarios = useMemo(() => {
    if (!data) return [];
    return safeArr(data.stats.comentarios)
      .filter((c) => (c?.texto || "").trim().length > 0)
      .slice();
  }, [data]);

  const comentariosCount = comentarios.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500 font-semibold">
          <RefreshCw className="h-5 w-5 animate-spin" />
          Cargando resultados…
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] p-10">
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle className="text-slate-900">Sin datos</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-red-600">{err || "Error"}</CardContent>
        </Card>
      </div>
    );
  }

  const s = data.stats;

  const kpis: Array<{ label: string; value: number }> = [
    { label: "Frecuencia", value: data.global.frecuencia },
    { label: "Normalización", value: data.global.normalidad },
    { label: "Gravedad", value: data.global.gravedad },
    { label: "Total", value: data.global.total },
  ];

  const BarValueChipLayer = ({ bars }: any) => {
    return (
      <>
        {bars.map((bar: any) => {
          const value = Math.round(bar.data.value);
          if (!value) return null;

          return (
            <g
              key={bar.key}
              transform={`translate(${bar.x + bar.width + 8}, ${bar.y + bar.height / 2})`}
            >
              <foreignObject
                width={56}
                height={28}
                x={0}
                y={-14}
                style={{ overflow: "visible" }}
              >
                <div
                  style={{
                    background: "rgba(127,1,127,0.12)",
                    color: "#7F017F",
                    border: "1px solid rgba(127,1,127,0.25)",
                    borderRadius: 999,
                    padding: "2px 10px",
                    fontSize: 12,
                    fontWeight: 900,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    whiteSpace: "nowrap",
                    boxShadow: "0 6px 18px rgba(127,1,127,0.25)",
                  }}
                >
                  {value}
                </div>
              </foreignObject>
            </g>
          );
        })}
      </>
    );
  };

  const GroupedBarValuePillLayer = ({ bars }: any) => {
    return (
      <>
        {bars.map((bar: any) => {
          const raw = Number(bar.data.value);
          if (!Number.isFinite(raw)) return null;

          const txt = fmt2(raw);

          return (
            <g
              key={bar.key}
              transform={`translate(${bar.x + bar.width + 8}, ${bar.y + bar.height / 2})`}
            >
              <foreignObject
                width={62}
                height={24}
                x={0}
                y={-12}
                style={{ overflow: "visible" }}
              >
                <div
                  style={{
                    background: "rgba(127,1,127,0.12)",
                    color: "#7F017F",
                    border: "1px solid rgba(127,1,127,0.25)",
                    borderRadius: 999,
                    padding: "1px 8px",
                    fontSize: 9,
                    fontWeight: 900,
                    letterSpacing: "0.01em",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    whiteSpace: "nowrap",
                    boxShadow: "0 6px 18px rgba(127,1,127,0.22)",
                  }}
                >
                  {txt}
                </div>
              </foreignObject>
            </g>
          );
        })}
      </>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-6 py-10 lg:px-12 text-slate-900">
      {/* HERO */}
      <div className="mx-auto max-w-[1400px] mb-10">
        <div className="relative overflow-hidden rounded-[2.25rem] border bg-white shadow-sm">
          <div
            className="pointer-events-none absolute -top-32 -right-32 h-[420px] w-[420px] rounded-full blur-3xl opacity-25"
            style={{ background: PURPLE }}
          />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_circle_at_0%_0%,rgba(127,1,127,0.10),transparent_55%)]" />
          <div className="relative p-8 md:p-10">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Badge
                    variant="secondary"
                    className="rounded-full px-3 py-1 font-black tracking-[0.18em] uppercase"
                    style={{
                      color: PURPLE,
                      background: "rgba(127,1,127,0.08)",
                    }}
                  >
                    Analítica agregada
                  </Badge>
                  <Sparkles className="h-4 w-4 opacity-70" style={{ color: PURPLE }} />
                </div>

                <h1 className="text-4xl md:text-5xl font-light tracking-tight">
                  Dashboard <span className="font-black">Mujer Alerta</span>
                </h1>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold text-slate-600">
                    Total de percepción de violencia contra la mujer
                  </span>

                  <Badge
                    className="rounded-full px-3 py-1 font-black text-sm"
                    style={{ background: "rgba(127,1,127,0.12)", color: PURPLE }}
                  >
                    {pctFrom5(data.global.total)}%
                  </Badge>

                  {showSemantic ? (
                    <Badge
                      className={`rounded-full font-black ${semanticBadgeClass5(
                        semanticLevel5(data.global.total),
                        true
                      )}`}
                    >
                      {semanticLevel5(data.global.total)}
                    </Badge>
                  ) : null}

                  <Badge
                    variant="secondary"
                    className="rounded-full px-3 py-1 font-black tracking-wide"
                    style={{ background: "rgba(2,6,23,0.04)", color: "#0f172a" }}
                  >
                    {year === "all" ? "Histórico: Todos" : `Año: ${year}`}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-col items-end gap-3">
                {/* ✅ Selector año + botón Tendencias */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-600">
                    <Calendar className="h-4 w-4" style={{ color: PURPLE }} />
                    Año
                  </div>

                  <Select value={year} onValueChange={(v) => setYear(v)}>
                    <SelectTrigger className="h-10 w-[180px] rounded-2xl bg-white border-slate-200 hover:border-purple-300">
                      <SelectValue placeholder="Selecciona año" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {yearOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-2xl bg-white border-slate-200 hover:border-purple-300"
                    onClick={() => setTrendsOpen(true)}
                    title="Comparar promedios anuales"
                  >
                    <Activity className="mr-2 h-4 w-4" style={{ color: PURPLE }} />
                    Tendencias
                  </Button>
                </div>

                <div className="flex items-center gap-3"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1400px] space-y-8">
        {/* KPI + RADAR */}
        <section className="grid gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-7 rounded-[2rem] border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-black tracking-wide">
                  Principales indicadores
                </CardTitle>
                <Badge
                  variant="secondary"
                  className="rounded-full font-black uppercase tracking-widest text-[10px]"
                >
                  Resumen
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Separator className="mb-5" />

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500 font-semibold">Participantes</p>
                    <Users className="h-4 w-4" style={{ color: PURPLE }} />
                  </div>
                  <p className="mt-2 text-3xl font-black" style={{ color: PURPLE }}>
                    {fmtInt(s.total_participantes)}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-emerald-600 text-xs font-black">
                    <ArrowUpRight className="h-4 w-4" />
                    Activos
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500 font-semibold">Respuestas</p>
                    <Sigma className="h-4 w-4" style={{ color: PURPLE }} />
                  </div>
                  <p className="mt-2 text-3xl font-black" style={{ color: PURPLE }}>
                    {fmtInt(s.total_respuestas)}
                  </p>
                </div>

                <div className="rounded-2xl border border-primary bg-primary p-4 shadow-[0_18px_50px_rgba(2,6,23,0.25)]">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-300 font-semibold">Global</p>
                    <Activity className="h-4 w-4 text-purple-300" />
                  </div>

                  <p className="mt-2 text-3xl font-black text-white">
                    {pctFrom5(data.global.total)}%
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge className="rounded-full bg-white/10 text-white border border-white/15 font-black">
                      {fmt2(data.global.total)} / 5
                    </Badge>

                    {showSemantic ? (
                      <Badge
                        className={`rounded-full font-black ${semanticBadgeClass5(
                          semanticLevel5(data.global.total),
                          true
                        )}`}
                      >
                        {semanticLevel5(data.global.total)}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-4">
                {kpis.map((k) => {
                  const pct = pctFrom5(k.value);
                  const sem = semanticLevel5(k.value);
                  return (
                    <div
                      key={k.label}
                      className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,rgba(127,1,127,0.08),rgba(255,255,255,0.0))] p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-slate-500 font-semibold">{k.label}</p>
                        {showSemantic ? (
                          <Badge
                            className={`rounded-full text-[10px] font-black ${semanticBadgeClass5(
                              sem
                            )}`}
                          >
                            {sem}
                          </Badge>
                        ) : null}
                      </div>

                      <p className="mt-2 text-3xl font-black" style={{ color: PURPLE }}>
                        {pct}%
                      </p>

                      <p className="mt-1 text-[11px] text-slate-500 font-semibold">
                        Promedio: <span className="font-black">{fmt2(k.value)}</span> / 5
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-5 rounded-[2rem] border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-black tracking-wide">
                  Radar de vectores de violencia
                </CardTitle>
                <div className="flex items-center gap-2">
                  <RadarIcon className="h-4 w-4" style={{ color: PURPLE }} />
                  <Badge
                    variant="secondary"
                    className="rounded-full font-black text-[10px] uppercase tracking-widest"
                  >
                    Vectores
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Separator className="mb-5" />
              <div className="h-[380px]">
                {radar ? (
                  <ResponsiveRadar
                    data={radar.data as any}
                    keys={radar.keys as any}
                    indexBy="dimension"
                    maxValue={5}
                    valueFormat={(v: any) => fmt2(Number(v))}
                    margin={{ top: 70, right: 80, bottom: 40, left: 80 }}
                    gridLabelOffset={36}
                    curve="catmullRomClosed"
                    dotSize={10}
                    dotColor={{ theme: "background" }}
                    dotBorderWidth={2}
                    colors={[PURPLE]}
                    fillOpacity={0.14}
                    borderWidth={3}
                    blendMode="multiply"
                    enableDotLabel={false}
                    legends={[]}
                    theme={{
                      text: { fontSize: 12, fontWeight: 900, fill: "#111827" },
                      grid: {
                        line: { stroke: "rgba(2,6,23,0.10)", strokeWidth: 1 },
                      },
                      tooltip: {
                        container: {
                          background: "rgba(17,24,39,0.92)",
                          color: "#fff",
                          borderRadius: 12,
                          boxShadow: "0 14px 40px rgba(0,0,0,0.22)",
                          fontWeight: 900,
                        },
                      },
                    }}
                  />
                ) : null}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Distribuciones */}
        <section className="grid gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-6 rounded-[2rem] border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-black tracking-wide">
                  Participantes por género
                </CardTitle>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" style={{ color: PURPLE }} />
                  <Badge
                    variant="secondary"
                    className="rounded-full font-black text-[10px] uppercase tracking-widest"
                  >
                    Género
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Separator className="mb-5" />
              <div className="h-[380px]">
                <ResponsiveBar
                  data={generoBars as any}
                  keys={["total"]}
                  indexBy="label"
                  layout="horizontal"
                  margin={{ top: 10, right: 96, bottom: 36, left: 190 }}
                  padding={0.32}
                  colors={[PURPLE]}
                  borderRadius={10}
                  enableGridY={false}
                  axisTop={null}
                  axisRight={null}
                  axisBottom={{
                    tickSize: 0,
                    tickPadding: 8,
                    format: (v) => String(Math.round(Number(v))),
                  }}
                  axisLeft={{ tickSize: 0, tickPadding: 10 }}
                  enableLabel={false}
                  layers={["grid", "axes", "bars", "markers", "legends", BarValueChipLayer]}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-6 rounded-[2rem] border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-black tracking-wide">
                  Participantes por edad
                </CardTitle>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" style={{ color: PURPLE }} />
                  <Badge
                    variant="secondary"
                    className="rounded-full font-black text-[10px] uppercase tracking-widest"
                  >
                    Edad
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Separator className="mb-5" />
              <div className="h-[380px]">
                <ResponsiveBar
                  data={edadBars as any}
                  keys={["total"]}
                  indexBy="label"
                  layout="horizontal"
                  margin={{ top: 10, right: 96, bottom: 36, left: 190 }}
                  padding={0.32}
                  colors={[PURPLE]}
                  borderRadius={10}
                  enableGridY={false}
                  axisTop={null}
                  axisRight={null}
                  axisBottom={{
                    tickSize: 0,
                    tickPadding: 8,
                    format: (v) => String(Math.round(Number(v))),
                  }}
                  axisLeft={{ tickSize: 0, tickPadding: 10 }}
                  enableLabel={false}
                  layers={["grid", "axes", "bars", "markers", "legends", BarValueChipLayer]}
                />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Heatmap */}
        <Card className="rounded-[2rem] border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-black tracking-wide">
                Heatmap por tipo de violencia contra la mujer
              </CardTitle>
              <div className="flex items-center gap-2">
                <Grid3X3 className="h-4 w-4" style={{ color: PURPLE }} />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <Separator className="mb-5" />

            <div className="mt-2 w-full overflow-x-auto">
              <div style={{ minWidth: Math.max(980, (heatmap?.xCount || 0) * 112) }}>
                <div className="h-[520px]">
                  {heatmap ? (
                    <ResponsiveHeatMap
                      data={heatmap.data as any}
                      margin={{ top: 30, right: 180, bottom: 140, left: 160 }}
                      valueFormat=">-.2f"
                      minValue={0}
                      maxValue={5}
                      axisTop={null}
                      axisRight={null}
                      axisLeft={{ tickSize: 0, tickPadding: 10 }}
                      tooltipPosition="fixed"
                      axisBottom={{
                        tickSize: 0,
                        tickPadding: 16,
                        tickRotation: -22,
                        format: () => "",
                      }}
                      colors={{
                        type: "sequential",
                        scheme: "purples",
                        minValue: 0,
                        maxValue: 5,
                      }}
                      emptyColor="#F1F5F9"
                      cellOpacity={1}
                      cellBorderWidth={1}
                      cellBorderColor="rgba(2,6,23,0.06)"
                      enableLabels={true}
                      labelTextColor={{ from: "color", modifiers: [["darker", 2.1]] }}
                      legends={[
                        {
                          anchor: "bottom",
                          translateX: 0,
                          translateY: 80,
                          length: 420,
                          thickness: 26,
                          direction: "row",
                          tickPosition: "after",
                          tickSize: 3,
                          tickSpacing: 6,
                          tickOverlap: false,
                          tickFormat: ">-.1f",
                          title: "Intensidad →",
                          titleAlign: "start",
                          titleOffset: 6,
                        },
                      ]}
                      theme={{
                        text: {
                          fontFamily: "Montserrat",
                          fontSize: 14,
                          fontWeight: 900,
                          fill: "#111827",
                        },
                        axis: { ticks: { text: { fill: "#111827", fontWeight: 900 } } },
                        tooltip: {
                          container: {
                            background: "rgba(17,24,39,0.92)",
                            color: "#fff",
                            borderRadius: 12,
                            boxShadow: "0 14px 40px rgba(0,0,0,0.22)",
                            fontWeight: 900,
                          },
                        },
                      }}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Barras por género (vectores) */}
        <Card className="rounded-[2rem] border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-black tracking-wide">
                Frecuencia / Normalización / Gravedad por género
              </CardTitle>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" style={{ color: PURPLE }} />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <Separator className="mb-5" />

            {generoStack.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                <span className="font-black" style={{ color: PURPLE }}>
                  Sin datos por género
                </span>{" "}
                para frecuencia/normalización/gravedad.
              </div>
            ) : (
              <div className="h-[520px]">
                <ResponsiveBar
                  data={generoStack as any}
                  keys={["Frecuencia", "Normalización", "Gravedad"]}
                  indexBy="label"
                  groupMode="grouped"
                  layout="horizontal"
                  minValue={0}
                  maxValue={5}
                  valueScale={{ type: "linear", min: 0, max: 5 }}
                  indexScale={{ type: "band", round: true }}
                  margin={{ top: 44, right: 110, bottom: 52, left: 210 }}
                  padding={0.32}
                  innerPadding={10}
                  borderRadius={10}
                  colors={({ id }) => {
                    const k = String(id);
                    if (k === "Frecuencia") return "rgba(127,1,127,0.95)";
                    if (k === "Normalización") return "rgba(127,1,127,0.55)";
                    return "rgba(127,1,127,0.30)";
                  }}
                  enableGridX={true}
                  enableGridY={false}
                  axisTop={null}
                  axisRight={null}
                  axisBottom={{
                    tickSize: 0,
                    tickPadding: 10,
                    tickValues: [0, 1, 2, 3, 4, 5],
                    format: (v) => String(v),
                    legend: "Promedio (1–5)",
                    legendPosition: "middle",
                    legendOffset: 38,
                  }}
                  axisLeft={{
                    tickSize: 0,
                    tickPadding: 12,
                    format: (v) => wrapLabel(String(v), 22, 2),
                  }}
                  enableLabel={false}
                  layers={[
                    "grid",
                    "axes",
                    "bars",
                    "markers",
                    "legends",
                    GroupedBarValuePillLayer,
                  ]}
                  valueFormat={(v: any) => fmt2(Number(v))}
                  legends={[
                    {
                      dataFrom: "keys",
                      anchor: "top",
                      direction: "row",
                      justify: false,
                      translateY: -28,
                      itemsSpacing: 18,
                      itemWidth: 90,
                      itemHeight: 18,
                      symbolSize: 10,
                      symbolShape: "circle",
                    },
                  ]}
                  theme={{
                    text: {
                      fontFamily: "Montserrat",
                      fontSize: 12,
                      fontWeight: 900,
                      fill: "#111827",
                    },
                    axis: { ticks: { text: { fill: "#111827", fontWeight: 900 } } },
                    grid: { line: { stroke: "rgba(2,6,23,0.08)", strokeWidth: 1 } },
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Comentarios */}
        <Card className="rounded-[2rem] border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-black tracking-wide">
                Comentarios del entorno
              </CardTitle>

              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="rounded-full font-black text-[10px] uppercase tracking-widest"
                  style={{ background: "rgba(127,1,127,0.10)", color: PURPLE }}
                >
                  {comentariosCount.toLocaleString("es-MX")} comentarios
                </Badge>

                <Badge
                  variant="secondary"
                  className="rounded-full font-black text-[10px] uppercase tracking-widest"
                  style={{ background: "rgba(2,6,23,0.04)", color: "#0f172a" }}
                >
                  {year === "all" ? "Histórico" : `Año ${year}`}
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <Separator className="mb-5" />

            {comentariosCount === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                <span className="font-black" style={{ color: PURPLE }}>
                  Sin comentarios
                </span>{" "}
                para el periodo seleccionado.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {comentarios.map((c, idx) => (
                  <div
                    key={`${c.encuesta_id}-${idx}`}
                    className="group relative overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
                  >
                    <div
                      className="pointer-events-none absolute -top-24 -right-24 h-[220px] w-[220px] rounded-full blur-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-30"
                      style={{ background: PURPLE }}
                    />

                    <div className="relative">
                      <div className="flex flex-wrap items-center gap-2">
                        {c.genero ? (
                          <Badge
                            variant="secondary"
                            className="rounded-full font-black text-[10px] uppercase tracking-widest"
                            style={{
                              background: "rgba(127,1,127,0.10)",
                              color: PURPLE,
                            }}
                          >
                            {c.genero}
                          </Badge>
                        ) : null}

                        {Number.isFinite(c.edad) && c.edad > 0 ? (
                          <Badge
                            variant="secondary"
                            className="rounded-full font-black text-[10px] uppercase tracking-widest"
                            style={{ background: "rgba(2,6,23,0.04)", color: "#0f172a" }}
                          >
                            {c.edad} años
                          </Badge>
                        ) : null}

                        {c.fecha ? (
                          <span className="ml-auto text-[11px] font-black text-slate-400">
                            {formatFechaES(c.fecha)}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-3 text-sm leading-6 text-slate-700 font-semibold">
                        {truncate(c.texto, 180)}
                      </p>

                      {c.texto.length > 180 && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <button
                              className="mt-3 text-xs font-black uppercase tracking-widest"
                              style={{ color: PURPLE }}
                            >
                              Ver comentario completo
                            </button>
                          </DialogTrigger>

                          <DialogContent className="max-w-xl rounded-[1.75rem]">
                            <DialogHeader>
                              <DialogTitle className="text-sm font-black tracking-wide">
                                Comentario completo
                              </DialogTitle>
                            </DialogHeader>

                            <div className="flex flex-wrap items-center gap-2 mb-3">
                              {c.genero && (
                                <Badge
                                  variant="secondary"
                                  className="rounded-full font-black text-[10px] uppercase tracking-widest"
                                  style={{
                                    background: "rgba(127,1,127,0.10)",
                                    color: PURPLE,
                                  }}
                                >
                                  {c.genero}
                                </Badge>
                              )}

                              {Number.isFinite(c.edad) && c.edad > 0 && (
                                <Badge
                                  variant="secondary"
                                  className="rounded-full font-black text-[10px] uppercase tracking-widest"
                                >
                                  {c.edad} años
                                </Badge>
                              )}

                              {c.fecha && (
                                <span className="ml-auto text-[11px] font-black text-slate-400">
                                  {formatFechaES(c.fecha)}
                                </span>
                              )}
                            </div>

                            <p className="text-sm leading-6 text-slate-700 font-semibold whitespace-pre-wrap">
                              {c.texto}
                            </p>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* =======================
            ✅ Estadística avanzada (por año)
          ======================= */}
        <Card className="rounded-[2rem] border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-black tracking-wide">
                Estadística avanzada (precisión y consistencia)
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
                Calculando estadística avanzada…
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
                para estadística avanzada en el año seleccionado.
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
                      <Sigma className="h-4 w-4" style={{ color: PURPLE }} />
                      <p className="text-xs font-black tracking-wide text-slate-700">
                        Dispersión (σ)
                      </p>
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
                      Alpha de Cronbach: <span className="font-black">≥ 0.70</span> suele
                      considerarse aceptable.
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
                          <th className="px-4 py-3 font-black">σ</th>
                          <th className="px-4 py-3 font-black">Mediana</th>
                          <th className="px-4 py-3 font-black">P25</th>
                          <th className="px-4 py-3 font-black">P75</th>
                          <th className="px-4 py-3 font-black">IC 95% (ítems / encuestas)</th>
                          <th className="px-4 py-3 font-black">α</th>
                          <th className="px-4 py-3 font-black">k</th>
                          <th className="px-4 py-3 font-black">σ encuestas</th>


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
                                  {/* IC por ítems */}
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

                                  {/* IC conservador por encuestas */}
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
                    IC 95% calculado con aproximación normal (1.96·σ/√n). Percentiles por{" "}
                    <span className="font-black">percentile_cont</span>. Alpha por dimensión.
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>

      {/* ✅ Modal Tendencias */}
      <TrendsModal open={trendsOpen} onOpenChange={setTrendsOpen} />
    </div>
  );
}
