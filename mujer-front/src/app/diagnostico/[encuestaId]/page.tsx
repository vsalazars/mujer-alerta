"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Separator } from "../../../components/ui/separator";

import { api } from "../../../lib/api";

type LikertOption = { value: number; label: string };
type DimensionKey = "frecuencia" | "normalidad" | "gravedad";

type Instrumento = {
  instrument_id: string;
  name: string;
  subtitle?: string;
  version: string;
  instructions?: string;

  dimensions: { key: DimensionKey; label: string; scale_id: string }[];

  scales: Record<
    string,
    { type: "likert"; min: number; max: number; options: LikertOption[] }
  >;

  types_of_violence: Array<{
    type_id: string;
    order: number;
    label: string;
    notes?: string;
    questions: Array<{
      question_id: string;
      order: number;
      stem: string;
      cards: Array<{
        dimension: DimensionKey;
        prompt: string;
        scale_id: string;
        required: boolean;
      }>;
    }>;
  }>;

  scoring?: { total_responses_expected?: number };
};

// Brand
const BRAND = "#7F017F";

// === PROGRESS BAR PRO (Glow + Gradient) ===
const TRACK_H = 10; // px
const DOT_SIZE = 14; // px
const DOT_R = DOT_SIZE / 2; // px

// Degradado institucional (guinda)
const GRADIENT =
  "linear-gradient(90deg, #7A003C 0%, #9A1B6E 55%, #C23C9A 100%)";

// Glow sutil (no exagerado)
const GLOW = "0 0 10px rgba(122,0,60,0.35)";

function isObject(v: unknown): v is Record<string, any> {
  return typeof v === "object" && v !== null;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function pickInstPayload(raw: any) {
  if (!raw) return raw;
  if (isObject(raw) && isObject(raw.data)) return raw.data;
  if (isObject(raw) && isObject(raw.instrumento)) return raw.instrumento;
  return raw;
}

function pickTypesOfViolence(inst: any): any[] {
  const candidates = [
    inst?.types_of_violence,
    inst?.typesOfViolence,
    inst?.types,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

function pickScale(inst: any, scaleId: string) {
  const scales = inst?.scales;
  if (!isObject(scales)) return null;
  const scale = scales[scaleId];
  if (!isObject(scale)) return null;
  if (!Array.isArray(scale.options)) return null;
  return scale as {
    type: "likert";
    min: number;
    max: number;
    options: LikertOption[];
  };
}

type RespuestaItem = {
  pregunta_id: string;
  dimension: DimensionKey;
  valor: number;
};

export default function DiagnosticoEncuestaPage() {
  const params = useParams<{ encuestaId: string }>();
  const encuestaId = params?.encuestaId || "";
  const router = useRouter();

  const [inst, setInst] = useState<Instrumento | null>(null);
  const [rawKeys, setRawKeys] = useState<string[]>([]);
  const [tovKind, setTovKind] = useState<string>("(no cargado)");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [qIndex, setQIndex] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const raw = await api<any>("/api/instrumento");
        const payload = pickInstPayload(raw);

        if (isObject(payload)) {
          setRawKeys(Object.keys(payload).sort());
          const tov = (payload as any).types_of_violence;
          setTovKind(
            Array.isArray(tov)
              ? `array (len=${tov.length})`
              : typeof tov === "undefined"
              ? "undefined"
              : `${typeof tov}`
          );
        } else {
          setRawKeys([]);
          setTovKind(typeof payload);
        }

        setInst(payload as Instrumento);
      } catch (e: any) {
        console.error("instrumento error:", e);
        setInst(null);
        setRawKeys([]);
        setTovKind("(error)");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const questions = useMemo(() => {
    if (!inst) return [];

    const anyInst = inst as any;
    const rawTypes = pickTypesOfViolence(anyInst);
    if (!Array.isArray(rawTypes)) return [];

    const flat: any[] = [];
    const types = [...rawTypes].sort(
      (a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0)
    );

    types.forEach((t: any) => {
      const rawQs = t?.questions;
      if (!Array.isArray(rawQs)) return;

      const qs = [...rawQs].sort(
        (a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0)
      );

      qs.forEach((q: any) => {
        if (!q?.question_id || !q?.stem || !Array.isArray(q?.cards)) return;
        flat.push(q);
      });
    });

    return flat as Instrumento["types_of_violence"][number]["questions"];
  }, [inst]);

  const current = questions[qIndex];

  const totalQuestions = questions.length || 16;
  const totalExpected =
    (inst as any)?.scoring?.total_responses_expected ?? totalQuestions * 3;

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

  const currentDone = useMemo(() => {
    if (!current) return false;
    if (!Array.isArray(current.cards)) return false;

    return current.cards.every((c) => {
      const k = `${current.question_id}:${c.dimension}`;
      return typeof answers[k] === "number";
    });
  }, [current, answers]);

  const allDone = useMemo(
    () => answeredCount >= totalExpected,
    [answeredCount, totalExpected]
  );

  function setAnswer(
    questionId: string,
    dimension: RespuestaItem["dimension"],
    value: number
  ) {
    const key = `${questionId}:${dimension}`;
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function goPrev() {
    setQIndex((i) => Math.max(0, i - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goNext() {
    setQIndex((i) => Math.min(totalQuestions - 1, i + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function findFirstIncompleteIndex(): number {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!Array.isArray(q.cards)) return i;
      for (const c of q.cards) {
        if (!c.required) continue;
        const k = `${q.question_id}:${c.dimension}`;
        if (typeof answers[k] !== "number") return i;
      }
    }
    return -1;
  }

  async function onSubmitAll() {
    if (!inst) return;
    if (saving) return;

    const firstBad = findFirstIncompleteIndex();
    if (firstBad !== -1) {
      setQIndex(firstBad);
      window.scrollTo({ top: 0, behavior: "smooth" });
      alert("Te faltan respuestas. Te llevé a la primera pregunta incompleta.");
      return;
    }

    const respuestas: RespuestaItem[] = [];
    questions.forEach((q) => {
      if (!Array.isArray(q.cards)) return;
      q.cards.forEach((c) => {
        const k = `${q.question_id}:${c.dimension}`;
        const v = answers[k];
        respuestas.push({
          pregunta_id: q.question_id,
          dimension: c.dimension,
          valor: Number(v),
        });
      });
    });

    setSaving(true);
    try {
      await api<{ ok: boolean }>("/api/respuestas", {
        method: "POST",
        body: JSON.stringify({
          encuesta_id: encuestaId,
          respuestas,
        }),
      });

      router.push(`/resumen/${encuestaId}`);
    } catch (err: any) {
      console.error("save error:", err);
      alert(err?.message || "No se pudieron guardar las respuestas.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-dvh bg-white">
        <div className="mx-auto w-full max-w-md px-5 py-8">
          <p className="text-sm text-neutral-600">Cargando instrumento…</p>
        </div>
      </main>
    );
  }

  if (inst && questions.length === 0) {
    return (
      <main className="min-h-dvh bg-white">
        <div className="mx-auto w-full max-w-md px-5 py-8 space-y-4">
          <p className="text-sm text-neutral-800">
            El instrumento se cargó, pero no se detectaron preguntas.
          </p>

          <div className="rounded-2xl border p-4 text-xs text-neutral-700">
            <p className="font-semibold">Debug /api/instrumento</p>
            <p className="mt-2">
              <b>types_of_violence:</b> {tovKind}
            </p>
            <p className="mt-2">
              <b>keys:</b> {rawKeys.length ? rawKeys.join(", ") : "(sin llaves)"}
            </p>
            <p className="mt-2">
              Si aquí dice <b>undefined</b>, el backend no está devolviendo el JSON
              esperado.
            </p>
          </div>

          <Button
            className="h-12 w-full rounded-full"
            style={{ backgroundColor: BRAND }}
            onClick={() => router.push("/diagnostico")}
          >
            Volver
          </Button>
        </div>
      </main>
    );
  }

  if (!inst || !current) {
    return (
      <main className="min-h-dvh bg-white">
        <div className="mx-auto w-full max-w-md px-5 py-8">
          <p className="text-sm text-neutral-600">
            No se pudo cargar el instrumento.
          </p>
          <Button
            className="mt-4 h-12 w-full rounded-full"
            style={{ backgroundColor: BRAND }}
            onClick={() => router.push("/diagnostico")}
          >
            Volver
          </Button>
        </div>
      </main>
    );
  }

  // ✅ SNAP por pregunta (dot siempre avanza con qIndex)
  const steps = Math.max(1, totalQuestions);
  const denom = Math.max(1, steps - 1);
  const snapPct = clamp((qIndex / denom) * 100, 0, 100);
  const snapPctLabel = Math.round(((qIndex + 1) / steps) * 100);
  const stepLabel = `Paso ${qIndex + 1} de ${steps}`;

  // rail útil (dot no se corta)
  const railWidthExpr = `(100% - ${DOT_SIZE}px)`;
  const dotLeft = `calc(${DOT_R}px + (${snapPct} / 100) * ${railWidthExpr})`;
  const fillWidth = `calc((${snapPct} / 100) * ${railWidthExpr})`;

  return (
    <main className="h-dvh bg-white overflow-hidden">
      {/* ↓↓↓ Ajuste: menos padding vertical + safe-area inferior para que NO se corte */}
      <div className="mx-auto h-dvh w-full max-w-md px-5 py-5 pb-[env(safe-area-inset-bottom)] flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2
              className="text-xl font-extrabold tracking-tight"
              style={{ color: BRAND }}
            >
              {inst.name}
            </h2>

            {/* ✅ Barra PRO: degradado + glow + dot snap */}
            <div className="mt-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-neutral-600">
                  {stepLabel}
                </span>
                <span
                  className="text-[11px] font-semibold tabular-nums"
                  style={{ color: BRAND }}
                >
                  {snapPctLabel}%
                </span>
              </div>

              <div
                className="relative mt-2 w-full"
                style={{ height: `${TRACK_H}px` }}
                role="progressbar"
                aria-label="Progreso del cuestionario"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(snapPct)}
              >
                {/* Track */}
                <div
                  className="absolute inset-0 rounded-full"
                  style={{ backgroundColor: "rgba(122,0,60,0.12)" }}
                />

                {/* Fill con degradado + glow */}
                <div
                  className="absolute left-0 top-0 h-full rounded-full transition-[width] duration-300 ease-out"
                  style={{
                    width: `calc(${DOT_R}px + ${fillWidth})`,
                    background: GRADIENT,
                    boxShadow: snapPct > 0 ? GLOW : "none",
                  }}
                />

                {/* Dot */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 transition-[left] duration-250 ease-out"
                  style={{ left: dotLeft }}
                  aria-hidden="true"
                >
                  <div
                    className="rounded-full bg-white"
                    style={{
                      width: `${DOT_SIZE}px`,
                      height: `${DOT_SIZE}px`,
                      border: "2px solid #7A003C",
                      boxShadow:
                        snapPct > 0
                          ? "0 0 6px rgba(122,0,60,0.45)"
                          : "0 2px 6px rgba(0,0,0,0.15)",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {inst.instructions ? (
          <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
            {inst.instructions}
          </p>
        ) : null}

        {/* ✅ Card a altura fija ocupando el resto de la pantalla */}
        {/* ↓↓↓ Ajuste: mt-6 -> mt-4 para ganar espacio vertical */}
        <Card className="mt-4 mb-2 flex-1 min-h-0 flex flex-col">

          <CardHeader>
            <CardTitle
              className="text-base font-heading font-semibold leading-snug"
              style={{ color: "var(--primary)" }}
            >
              {current.question_id}. {current.stem}
            </CardTitle>
          </CardHeader>

          {/* ✅ Mantener formato: no tocamos tus colores ni estilos internos,
              solo hacemos que el CardContent distribuya altura sin scroll */}
          <CardContent className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Top: contenido con tu mismo espaciado */}
            {/* ↓↓↓ Ajuste: space-y-6 -> space-y-4 para que quepan botones */}
            <div className="space-y-4">
              {Array.isArray(current.cards) &&
                current.cards.map((c) => {
                  const scale = pickScale(inst as any, c.scale_id);
                  const picked = answers[`${current.question_id}:${c.dimension}`];

                  if (!scale) {
                    return (
                      <div
                        key={`${current.question_id}:${c.dimension}`}
                        className="rounded-xl border p-3"
                      >
                        <p className="text-sm text-neutral-700">
                          No se encontró la escala <code>{c.scale_id}</code>.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`${current.question_id}:${c.dimension}`}
                      className="space-y-3"
                    >
                      <p className="text-sm font-medium text-neutral-800">
                        {c.prompt}
                      </p>

                      <div className="grid grid-cols-5 gap-2">
                        {scale.options.map((opt) => {
                          const active = picked === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() =>
                                setAnswer(
                                  current.question_id,
                                  c.dimension,
                                  opt.value
                                )
                              }
                              aria-pressed={active}
                              className={[
                                "h-11 w-11 rounded-full flex items-center justify-center",
                                "border transition-colors duration-150",
                                "focus-visible:outline-none focus-visible:ring-2",
                                active ? "font-bold" : "font-medium",
                              ].join(" ")}
                              style={{
                                backgroundColor: active
                                  ? "var(--primary)"
                                  : "transparent",
                                color: active
                                  ? "var(--primary-foreground)"
                                  : "var(--foreground)",
                                borderColor: active
                                  ? "var(--primary)"
                                  : "var(--border)",
                                boxShadow: active
                                  ? "0 0 0 4px color-mix(in oklch, var(--ring) 35%, transparent)"
                                  : "none",
                              }}
                            >
                              {opt.value}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex justify-between text-[11px] leading-none">
                        <span
                          className="px-2 py-1 rounded-full font-bold"
                          style={{
                            color: "var(--chart-2)",
                            background:
                              "color-mix(in oklch, var(--accent) 70%, transparent)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          {scale.options[0]?.label}
                        </span>

                        <span
                          className="px-2 py-1 rounded-full font-bold"
                          style={{
                            color: "var(--chart-2)",
                            background:
                              "color-mix(in oklch, var(--accent) 70%, transparent)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          {scale.options[scale.options.length - 1]?.label}
                        </span>
                      </div>

                      <Separator />
                    </div>
                  );
                })}
            </div>

            {/* Bottom: botones siempre abajo, sin scroll */}
            {/* ↓↓↓ Ajuste: pt-6 -> pt-4 para ganar espacio */}
            <div className="mt-auto pt-4">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="h-12 flex-1 rounded-full"
                  onClick={goPrev}
                  disabled={qIndex === 0}
                >
                  Atrás
                </Button>

                {qIndex < totalQuestions - 1 ? (
                  <Button
                    className="h-12 flex-1 rounded-full text-base font-semibold"
                    style={{ backgroundColor: BRAND }}
                    onClick={goNext}
                    disabled={!currentDone}
                  >
                    Siguiente
                  </Button>
                ) : (
                  <Button
                    className="h-12 flex-1 rounded-full text-base font-semibold"
                    style={{ backgroundColor: BRAND }}
                    onClick={onSubmitAll}
                    disabled={!allDone || saving}
                  >
                    {saving ? "Guardando…" : "Finalizar"}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
