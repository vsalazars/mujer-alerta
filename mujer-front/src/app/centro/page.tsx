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
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { extractInstitutionSlug } from "@/lib/routing";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function CentroPage() {
  const pathname = usePathname();
  const institucionSlug = extractInstitutionSlug(pathname);
  const [centroLabel, setCentroLabel] = useState("");
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
    try {
      const raw = localStorage.getItem("auth_user") || "";
      if (!raw) return;
      const parsed = JSON.parse(raw) as { centro_nombres?: string[]; centros?: number[] };
      const names = Array.isArray(parsed.centro_nombres) ? parsed.centro_nombres.filter(Boolean) : [];
      if (names.length) {
        setCentroLabel(names.join(" / "));
        return;
      }
      if (Array.isArray(parsed.centros) && parsed.centros.length) {
        setCentroLabel(parsed.centros.map((id) => `Centro #${id}`).join(" / "));
      }
    } catch {}
  }, []);

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
  const isEmptyState = err.trim().toLowerCase() === "no_data";

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
      <div className="min-h-screen bg-[#F8FAFC] px-6 py-10 lg:px-12 text-slate-900">
        <div className="mx-auto max-w-[1400px]">
          <section className="overflow-hidden rounded-[32px] border border-[#E9D8F3] bg-white shadow-[0_18px_50px_rgba(127,1,127,0.08)]">
            <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="relative overflow-hidden border-b border-[#F1E5F8] px-8 py-10 lg:border-b-0 lg:border-r lg:px-10 lg:py-12">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(127,1,127,0.10),transparent_40%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(249,241,252,0.92))]" />
                <div className="relative">
                  <div className="mb-5 inline-flex items-center rounded-full border border-[#E9D8F3] bg-[#FAF5FD] px-4 py-1 text-xs font-black uppercase tracking-[0.28em] text-[#7F017F]">
                    Panel del centro
                  </div>
                  <h1 className="max-w-2xl text-3xl font-black tracking-tight text-slate-900 md:text-5xl">
                    Aun no hay respuestas para mostrar.
                  </h1>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
                    {centroLabel
                      ? `El centro ${centroLabel} todavia no tiene encuestas finalizadas, por eso el tablero aparece vacio.`
                      : "Todavia no hay encuestas finalizadas para este centro, por eso el tablero aparece vacio."}
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    {centroLabel ? (
                      <span className="inline-flex items-center rounded-full bg-[#F3E5FB] px-4 py-2 text-sm font-bold text-[#7F017F]">
                        Centro: {centroLabel}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-[0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-[#E9D8F3]">
                      Ano seleccionado: {year === "all" ? "Todos" : year}
                    </span>
                  </div>

                  <div className="mt-8 flex flex-wrap gap-3">
                    <Button
                      onClick={() => void load(year)}
                      className="rounded-full bg-[#7F017F] px-6 text-white hover:bg-[#680168]"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Recargar panel
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setYear("all")}
                      className="rounded-full border-[#E9D8F3] text-[#7F017F] hover:bg-[#FAF5FD]"
                    >
                      Ver todos los anos
                    </Button>
                  </div>
                </div>
              </div>

              <div className="bg-[#FCF9FE] px-8 py-10 lg:px-10 lg:py-12">
                <div className="rounded-[28px] border border-[#E9D8F3] bg-white p-6 shadow-[0_12px_30px_rgba(127,1,127,0.06)]">
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-[#7F017F]">
                    Que sigue
                  </p>
                  <div className="mt-5 space-y-4 text-sm leading-6 text-slate-600">
                    <div className="rounded-2xl bg-[#FAF5FD] px-4 py-4">
                      <p className="font-bold text-slate-900">1. Levanta las primeras encuestas</p>
                      <p className="mt-1">
                        En cuanto este centro reciba respuestas finalizadas, el tablero empezara a poblarse automaticamente.
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#FAF5FD] px-4 py-4">
                      <p className="font-bold text-slate-900">2. Revisa el ano seleccionado</p>
                      <p className="mt-1">
                        Si las respuestas existen pero pertenecen a otro periodo, cambia el filtro de ano para ubicarlas.
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#FAF5FD] px-4 py-4">
                      <p className="font-bold text-slate-900">3. Confirma que estas en el centro correcto</p>
                      <p className="mt-1">
                        El encabezado muestra el centro asignado a tu cuenta para evitar confusiones entre sedes o unidades.
                      </p>
                    </div>
                  </div>

                  {!isEmptyState && err ? (
                    <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      <span className="font-bold">Detalle tecnico:</span> {err}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-6 py-10 lg:px-12 text-slate-900">
        <DashboardHero
          data={data}
          centerLabel={centroLabel}
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
