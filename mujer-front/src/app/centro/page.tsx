"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { TrendsModal } from "@/components/centro/TrendsModal";
import { AdvancedStatsSection } from "@/components/centro/dashboard/AdvancedStatsSection";
import { CommentsSection } from "@/components/centro/dashboard/CommentsSection";
import { DashboardHero } from "@/components/centro/dashboard/DashboardHero";
import { DistributionSection } from "@/components/centro/dashboard/DistributionSection";
import { ExecutiveSummarySection } from "@/components/centro/dashboard/ExecutiveSummarySection";
import { HeatmapSection } from "@/components/centro/dashboard/HeatmapSection";
import { NLPProcessingSection } from "@/components/centro/dashboard/NLPProcessingSection";
import {
  clamp5,
  fallbackYears,
  safeArr,
} from "@/components/centro/dashboard/helpers";
import { OverviewSection } from "@/components/centro/dashboard/OverviewSection";
import type {
  AdvRow,
  CentroNLPOverviewResponse,
  CentroNLPProcessResponse,
  CentroNLPStatusResponse,
  CentroEstadisticaAvanzadaResponse,
  CentroResumenResponse,
  MatrizItem,
  NLPJobStatus,
  YearOption,
} from "@/components/centro/dashboard/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { extractInstitutionSlug } from "@/lib/routing";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function CentroPage() {
  const pathname = usePathname();
  const institucionSlug = extractInstitutionSlug(pathname);
  const [data, setData] = useState<CentroResumenResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [comentariosPage, setComentariosPage] = useState(1);
  const [sentimientoFilter, setSentimientoFilter] = useState<string>("all");
  const [showSemantic] = useState(true);
  const [trendsOpen, setTrendsOpen] = useState(false);
  const [yearOptions, setYearOptions] = useState<YearOption[]>(fallbackYears());
  const [year, setYear] = useState<string>("all");
  const [advRows, setAdvRows] = useState<AdvRow[]>([]);
  const [advLoading, setAdvLoading] = useState(false);
  const [advErr, setAdvErr] = useState("");
  const [nlpOverview, setNLPOverview] = useState<CentroNLPOverviewResponse | null>(null);
  const [nlpOverviewLoading, setNLPOverviewLoading] = useState(false);
  const [nlpStatus, setNLPStatus] = useState<NLPJobStatus | null>(null);
  const [nlpProcessError, setNLPProcessError] = useState("");

  async function load(selectedYear?: string) {
    const targetYear = selectedYear ?? year;

    setLoading(true);
    setErr("");
    try {
      const qs =
        targetYear && targetYear !== "all" ? `?year=${encodeURIComponent(targetYear)}` : "";
      const response = await api<CentroResumenResponse>(`/api/centro/resumen${qs}`);
      setData(response);

      try {
        localStorage.setItem(`centro_dashboard_year:${institucionSlug || "default"}`, targetYear || "all");
      } catch {}
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "No se pudo cargar el resumen"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadAdvanced(selectedYear?: string) {
    const targetYear = selectedYear ?? year;

    if (!targetYear || targetYear === "all") {
      setAdvRows([]);
      setAdvErr("");
      setAdvLoading(false);
      return;
    }

    setAdvLoading(true);
    setAdvErr("");
    try {
      const response = await api<CentroEstadisticaAvanzadaResponse>(
        `/api/centro/estadistica-avanzada?year=${encodeURIComponent(targetYear)}`
      );
      setAdvRows(Array.isArray(response?.datos) ? response.datos : []);
    } catch (error: unknown) {
      setAdvErr(getErrorMessage(error, "Error al cargar estadística avanzada"));
      setAdvRows([]);
    } finally {
      setAdvLoading(false);
    }
  }

  async function loadNLPOverview(selectedYear?: string, options?: { silent?: boolean }) {
    const targetYear = selectedYear ?? year;
    const shouldShowLoading = !options?.silent;
    if (shouldShowLoading) {
      setNLPOverviewLoading(true);
    }
    try {
      const qs =
        targetYear && targetYear !== "all" ? `?year=${encodeURIComponent(targetYear)}` : "";
      const response = await api<CentroNLPOverviewResponse>(`/api/centro/nlp/overview${qs}`);
      setNLPOverview(response);
    } catch {
      setNLPOverview(null);
    } finally {
      if (shouldShowLoading) {
        setNLPOverviewLoading(false);
      }
    }
  }

  async function loadNLPStatus(selectedYear?: string) {
    const targetYear = selectedYear ?? year;
    const qs =
      targetYear && targetYear !== "all" ? `?year=${encodeURIComponent(targetYear)}` : "";

    try {
      const response = await api<CentroNLPStatusResponse>(`/api/centro/nlp/status${qs}`);
      setNLPStatus(response.status);
      if (response.status.last_error && response.status.status === "failed") {
        setNLPProcessError(response.status.last_error);
      }
    } catch {
      setNLPStatus(null);
    }
  }

  useEffect(() => {
    (async () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(`centro_dashboard_year:${institucionSlug || "default"}`);
      } catch {}

      try {
        const years = await api<number[] | { years: number[] }>("/api/centro/years");
        const yearsPayload = years as { years?: number[] };
        const arr = Array.isArray(years)
          ? years
          : Array.isArray(yearsPayload?.years)
            ? yearsPayload.years
            : [];
        const clean = arr
          .map((n: unknown) => Number(n))
          .filter((n: number) => Number.isFinite(n) && n >= 2000 && n <= 2100)
          .sort((a: number, b: number) => b - a);

        if (clean.length) {
          const opts: YearOption[] = [{ value: "all", label: "Todos" }].concat(
            clean.map((yy: number) => ({ value: String(yy), label: String(yy) }))
          );
          setYearOptions(opts);

          const ok = saved && (saved === "all" || opts.some((option) => option.value === saved));
          const initialYear = ok && saved ? saved : "all";

          setYear(initialYear);
          await load(initialYear);
          await loadAdvanced(initialYear);
          await loadNLPOverview(initialYear);
          await loadNLPStatus(initialYear);
          return;
        }
      } catch {}

      const ok = saved && (saved === "all" || /^\d{4}$/.test(saved));
      const initialYear = ok && saved ? saved : "all";
      setYearOptions(fallbackYears());
      setYear(initialYear);
      await load(initialYear);
      await loadAdvanced(initialYear);
      await loadNLPOverview(initialYear);
      await loadNLPStatus(initialYear);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institucionSlug]);

  useEffect(() => {
    if (!data && loading) return;
    load(year);
    loadAdvanced(year);
    loadNLPOverview(year);
    loadNLPStatus(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  useEffect(() => {
    if (!nlpStatus?.running) return;

    const timer = window.setInterval(() => {
      void loadNLPStatus(year);
      void loadNLPOverview(year, { silent: true });
    }, 1000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nlpStatus?.running, year]);

  useEffect(() => {
    if (!nlpStatus || nlpStatus.running) return;
    if (nlpStatus.status === "completed" || nlpStatus.status === "failed") {
      void load(year);
      void loadNLPOverview(year, { silent: true });
    }
    if (nlpStatus.status === "failed" && nlpStatus.last_error) {
      setNLPProcessError(nlpStatus.last_error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nlpStatus?.running, nlpStatus?.status, year]);

  async function processNLPComments() {
    if (nlpStatus?.running) return;

    setNLPProcessError("");

    try {
      const response = await api<CentroNLPProcessResponse>("/api/centro/nlp/procesar", {
        method: "POST",
        body: JSON.stringify({
          year: year !== "all" ? Number(year) : undefined,
        }),
      });
      setNLPStatus(response.status);
      await loadNLPOverview(year, { silent: true });
      await loadNLPStatus(year);
    } catch (error: unknown) {
      setNLPProcessError(getErrorMessage(error, "No se pudo ejecutar el procesamiento NLP"));
    }
  }

  const heatmap = useMemo(() => {
    if (!data) return null;

    const tipoMap = new Map<number, string>();
    for (const row of data.matriz) tipoMap.set(row.tipo_num, row.tipo_nombre);

    const tipos = Array.from(tipoMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([n, name]) => ({ n, name }));

    const map = new Map<string, number>();
    for (const row of data.matriz) {
      map.set(`${row.dimension}:${row.tipo_num}`, clamp5(row.promedio));
    }

    const mkRow = (id: string, dim: MatrizItem["dimension"]) => ({
      id,
      data: tipos.map((tipo) => ({
        x: `${tipo.name}`,
        y: Number((map.get(`${dim}:${tipo.n}`) ?? 0).toFixed(2)),
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
      .map((item) => ({ label: item.label, total: item.total || 0 }));
  }, [data]);

  const edadBars = useMemo(() => {
    if (!data) return [];
    return safeArr(data.stats.encuestas_por_edad)
      .slice()
      .sort((a, b) => a.label.localeCompare(b.label, "es", { numeric: true }))
      .map((item) => ({ label: item.label, total: item.total || 0 }));
  }, [data]);

  const generoStack = useMemo(() => {
    if (!data) return [];
    return safeArr(data.stats.resumen_por_genero)
      .slice()
      .map((item) => ({
        label: item.label,
        Frecuencia: clamp5(item.frecuencia),
        Normalización: clamp5(item.normalidad),
        Gravedad: clamp5(item.gravedad),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "es", { numeric: true }));
  }, [data]);

  const comentarios = useMemo(() => {
    if (!data) return [];
    return safeArr(data.stats.comentarios)
      .filter((item) => (item?.texto || "").trim().length > 0)
      .slice();
  }, [data]);

  const sentimientoOptions = useMemo(() => {
    return Array.from(
      new Set(
        comentarios
          .map((item) => (item.sentimiento_label || "").trim().toLowerCase())
          .filter((value) => value.length > 0)
      )
    ).sort();
  }, [comentarios]);

  const comentariosFiltrados = useMemo(() => {
    return comentarios.filter((item) => {
      const sentimiento = (item.sentimiento_label || "").trim().toLowerCase();
      const matchesSentimiento =
        sentimientoFilter === "all" || sentimiento === sentimientoFilter;
      return matchesSentimiento;
    });
  }, [comentarios, sentimientoFilter]);

  const comentariosCount = comentariosFiltrados.length;
  const commentsPerPage = 9;
  const comentariosTotalPages = Math.max(1, Math.ceil(comentariosCount / commentsPerPage));
  const comentariosPageSafe = Math.min(comentariosPage, comentariosTotalPages);
  const comentariosPageItems = useMemo(() => {
    const start = (comentariosPageSafe - 1) * commentsPerPage;
    return comentariosFiltrados.slice(start, start + commentsPerPage);
  }, [comentariosFiltrados, comentariosPageSafe]);

  useEffect(() => {
    setComentariosPage(1);
  }, [year, comentariosCount, sentimientoFilter]);

  useEffect(() => {
    if (comentariosPage > comentariosTotalPages) {
      setComentariosPage(comentariosTotalPages);
    }
  }, [comentariosPage, comentariosTotalPages]);

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

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-6 py-10 lg:px-12 text-slate-900">
      <DashboardHero
        data={data}
        showSemantic={showSemantic}
        year={year}
        yearOptions={yearOptions}
        onYearChange={setYear}
        onOpenTrends={() => setTrendsOpen(true)}
      />

      <main className="mx-auto max-w-[1400px] space-y-8">
        <OverviewSection data={data} showSemantic={showSemantic} radar={radar} />
        <DistributionSection
          generoBars={generoBars}
          edadBars={edadBars}
          generoStack={generoStack}
        />
        <HeatmapSection heatmap={heatmap} />
        <AdvancedStatsSection
          year={year}
          advRows={advRows}
          advLoading={advLoading}
          advErr={advErr}
        />
        <ExecutiveSummarySection
          year={year}
          advRows={advRows}
          advLoading={advLoading}
          advErr={advErr}
        />
        <NLPProcessingSection
          year={year}
          overview={nlpOverview}
          loading={nlpOverviewLoading}
          status={nlpStatus}
          processError={nlpProcessError}
          onProcess={processNLPComments}
        />
        <CommentsSection
          year={year}
          comentarios={comentarios}
          comentariosCount={comentariosCount}
          comentariosPageItems={comentariosPageItems}
          comentariosPageSafe={comentariosPageSafe}
          comentariosTotalPages={comentariosTotalPages}
          sentimientoFilter={sentimientoFilter}
          sentimientoOptions={sentimientoOptions}
          onSentimientoChange={setSentimientoFilter}
          onPrevPage={() => setComentariosPage((page) => Math.max(1, page - 1))}
          onNextPage={() =>
            setComentariosPage((page) => Math.min(comentariosTotalPages, page + 1))
          }
        />
      </main>

      <TrendsModal open={trendsOpen} onOpenChange={setTrendsOpen} />
    </div>
  );
}
