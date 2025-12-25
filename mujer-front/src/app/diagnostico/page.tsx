// src/app/diagnostico/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Separator } from "../../components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

import {
  Building2,
  Mail,
  User,
  ShieldCheck,
  ChevronRight,
  Loader2,
  RotateCcw,
  Lock,
  BadgeCheck,
} from "lucide-react";

import { api } from "../../lib/api";

type Centro = {
  id: number;
  tipo: string;
  nombre: string;
  clave?: string;
  ciudad?: string;
  estado?: string;
};

type Genero = {
  id: number;
  clave: string;
  etiqueta: string;
  descripcion?: string | null;
};

const PRIMARY = "#7F017F";

// === Detectar “encuesta en progreso” ===
const LS_PREFIX = "mujer_alerta:diagnostico:";
const LS_SUFFIX = ":v1";

type SavedProgress = {
  v: number;
  updated_at: number;
  qIndex: number;
  comentario: string;
  answers: Record<string, number>;
};

function safeParseProgress(raw: string): SavedProgress | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (Number((parsed as any).v) !== 1) return null;
    if (!Number.isFinite(Number((parsed as any).updated_at))) return null;
    if (!Number.isFinite(Number((parsed as any).qIndex))) return null;
    if (typeof (parsed as any).comentario !== "string") return null;
    const ans = (parsed as any).answers;
    if (!ans || typeof ans !== "object") return null;
    return parsed as SavedProgress;
  } catch {
    return null;
  }
}

function findLatestInProgress(): { encuestaId: string; progress: SavedProgress } | null {
  if (typeof window === "undefined") return null;

  let best: { encuestaId: string; progress: SavedProgress } | null = null;

  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i) || "";
      if (!k.startsWith(LS_PREFIX) || !k.endsWith(LS_SUFFIX)) continue;

      const encuestaId = k.slice(LS_PREFIX.length, k.length - LS_SUFFIX.length).trim();
      if (!encuestaId) continue;

      const raw = window.localStorage.getItem(k);
      if (!raw) continue;

      const prog = safeParseProgress(raw);
      if (!prog) continue;

      const hasSomething =
        (prog.answers && Object.keys(prog.answers).length > 0) ||
        (prog.comentario && prog.comentario.trim().length > 0) ||
        prog.qIndex > 0;

      if (!hasSomething) continue;

      if (!best || prog.updated_at > best.progress.updated_at) {
        best = { encuestaId, progress: prog };
      }
    }
  } catch {
    return null;
  }

  return best;
}

// === “candado suave” local por centro ===
const LOCK_VERSION = 1;
const LOCK_TTL_MS = 24 * 60 * 60 * 1000; // 24h
function lockKey(centroId: string) {
  return `mujer_alerta:lock:centro:${centroId}:v${LOCK_VERSION}`;
}

type LocalLock = {
  v: number;
  created_at: number;
  encuesta_id: string;
};

function readLock(centroId: string): LocalLock | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(lockKey(centroId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (Number((parsed as any).v) !== LOCK_VERSION) return null;
    const created_at = Number((parsed as any).created_at);
    const encuesta_id = String((parsed as any).encuesta_id || "");
    if (!Number.isFinite(created_at) || !encuesta_id) return null;
    return { v: LOCK_VERSION, created_at, encuesta_id };
  } catch {
    return null;
  }
}

function writeLock(centroId: string, encuestaId: string) {
  if (typeof window === "undefined") return;
  try {
    const payload: LocalLock = {
      v: LOCK_VERSION,
      created_at: Date.now(),
      encuesta_id: encuestaId,
    };
    window.localStorage.setItem(lockKey(centroId), JSON.stringify(payload));
  } catch {}
}

function clearLock(centroId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(lockKey(centroId));
  } catch {}
}

// ✅ NUEVO: si borras progreso, también borrar el lock que apunta a esa encuesta
function clearLockByEncuestaId(encuestaId: string) {
  if (typeof window === "undefined") return;
  try {
    const prefix = "mujer_alerta:lock:centro:";
    const suffix = `:v${LOCK_VERSION}`;

    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i) || "";
      if (!k.startsWith(prefix) || !k.endsWith(suffix)) continue;

      const raw = window.localStorage.getItem(k);
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw);
        const lkEncuesta = String((parsed as any)?.encuesta_id || "");
        if (lkEncuesta && lkEncuesta === encuestaId) {
          window.localStorage.removeItem(k);
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

function formatRemaining(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h <= 0) return `${m} min`;
  return `${h} h ${m} min`;
}

// ✅ NUEVO: “Ya finalizó” en este navegador (sin IP)
const DONE_BROWSER_VERSION = 1;
const DONE_BROWSER_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días (ajusta)
const DONE_BROWSER_KEY = `mujer_alerta:done:browser:v${DONE_BROWSER_VERSION}`;

type BrowserDone = { v: number; done_at: number; encuesta_id?: string };

function readBrowserDone(): BrowserDone | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DONE_BROWSER_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || typeof p !== "object") return null;
    if (Number((p as any).v) !== DONE_BROWSER_VERSION) return null;
    const done_at = Number((p as any).done_at);
    if (!Number.isFinite(done_at)) return null;
    return p as BrowserDone;
  } catch {
    return null;
  }
}

function clearBrowserDone() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DONE_BROWSER_KEY);
  } catch {}
}

function remainingDoneMs(done_at: number) {
  return DONE_BROWSER_TTL_MS - (Date.now() - done_at);
}

export default function DiagnosticoInicioPage() {
  const router = useRouter();

  const [centros, setCentros] = useState<Centro[]>([]);
  const [generos, setGeneros] = useState<Genero[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [centroId, setCentroId] = useState<string>("");
  const [generoId, setGeneroId] = useState<string>("");
  const [edad, setEdad] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  // resume existente
  const [resume, setResume] = useState<{ encuestaId: string; updatedAt: number } | null>(null);

  // lock local del centro seleccionado
  const [lock, setLock] = useState<{ encuestaId: string; remainingMs: number } | null>(null);

  // ✅ NUEVO: bloqueo por “ya finalizó” en este navegador
  const [doneBlocked, setDoneBlocked] = useState<{ remainingMs: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [c, g] = await Promise.all([
          api<Centro[]>("/api/centros?limit=50"),
          api<Genero[]>("/api/generos"),
        ]);
        setCentros(c);
        setGeneros(g);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const best = findLatestInProgress();
    if (best) setResume({ encuestaId: best.encuestaId, updatedAt: best.progress.updated_at });
    else setResume(null);
  }, []);

  // ✅ NUEVO: al entrar, revisar si este navegador ya “finalizó”
  useEffect(() => {
    const d = readBrowserDone();
    if (!d) {
      setDoneBlocked(null);
      return;
    }
    const rem = remainingDoneMs(d.done_at);
    if (rem <= 0) {
      clearBrowserDone();
      setDoneBlocked(null);
    } else {
      setDoneBlocked({ remainingMs: rem });
    }
  }, []);

  // al cambiar centroId, revisa lock
  useEffect(() => {
    if (!centroId) {
      setLock(null);
      return;
    }
    const lk = readLock(centroId);
    if (!lk) {
      setLock(null);
      return;
    }
    const age = Date.now() - lk.created_at;
    const remaining = LOCK_TTL_MS - age;
    if (remaining <= 0) {
      clearLock(centroId);
      setLock(null);
      return;
    }
    setLock({ encuestaId: lk.encuesta_id, remainingMs: remaining });
  }, [centroId]);

  // tick para actualizar “restante”
  useEffect(() => {
    if (!lock || !centroId) return;
    const t = window.setInterval(() => {
      const lk = readLock(centroId);
      if (!lk) {
        setLock(null);
        return;
      }
      const remaining = LOCK_TTL_MS - (Date.now() - lk.created_at);
      if (remaining <= 0) {
        clearLock(centroId);
        setLock(null);
      } else {
        setLock({ encuestaId: lk.encuesta_id, remainingMs: remaining });
      }
    }, 30_000);
    return () => window.clearInterval(t);
  }, [lock, centroId]);

  // ✅ Email validación (opcional, pero si existe debe ser válido)
  const emailTrim = email.trim();
  const emailOk = emailTrim === "" || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(emailTrim);

  const canSubmit = useMemo(() => {
    const e = Number(edad);
    return (
      centroId !== "" &&
      generoId !== "" &&
      Number.isFinite(e) &&
      e >= 15 &&
      e <= 75 &&
      emailOk &&
      !submitting
    );
  }, [centroId, generoId, edad, emailOk, submitting]);

  const blockedByLock = Boolean(lock && lock.remainingMs > 0);
  const blockedByResume = Boolean(resume); // ✅ si hay progreso, no permitir nueva
  const blockedByDoneBrowser = Boolean(doneBlocked); // ✅ si ya finalizó, no permitir nueva

  async function onSubmit() {
    if (!canSubmit) return;

    if (blockedByResume) {
      alert("Tienes un diagnóstico en progreso. Continúala o borra el progreso para iniciar otra.");
      return;
    }
    if (blockedByDoneBrowser) {
      alert(
        `Este navegador ya registró un diagnóstico recientemente.\n\nIntenta más tarde o borra el bloqueo si era prueba.`
      );
      return;
    }
    if (blockedByLock) {
      alert(
        `Ya se inició un diagnóstico recientemente para este centro en este navegador.\n\nPuedes continuarla o esperar ${formatRemaining(
          lock!.remainingMs
        )}.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        centro_id: Number(centroId),
        genero_id: Number(generoId),
        edad: Number(edad),
        email: emailTrim ? emailTrim : undefined,
      };

      const resp = await api<{ encuesta_id: string }>("/api/encuestas", {
        method: "POST",
        body: JSON.stringify(body),
      });

      writeLock(centroId, resp.encuesta_id);
      router.push(`/diagnostico/${resp.encuesta_id}`);
    } catch (err: any) {
      alert(err?.message || "No se pudo crear la encuesta.");
    } finally {
      setSubmitting(false);
    }
  }

  function onContinue() {
    if (!resume?.encuestaId) return;
    router.push(`/diagnostico/${resume.encuestaId}`);
  }

  // ✅ AJUSTADO: borrar progreso también borra el lock amarrado a esa encuesta
  function onResetResume() {
    if (!resume?.encuestaId) return;
    try {
      window.localStorage.removeItem(`${LS_PREFIX}${resume.encuestaId}${LS_SUFFIX}`);
      clearLockByEncuestaId(resume.encuestaId);
    } catch {}
    setResume(null);

    // refresca lock del centro seleccionado (por si estaba mostrando aviso)
    if (centroId) {
      const lk = readLock(centroId);
      if (!lk) setLock(null);
    }
  }

  function onClearLock() {
    if (!centroId) return;
    clearLock(centroId);
    setLock(null);
  }

  function onClearDoneBrowser() {
    clearBrowserDone();
    setDoneBlocked(null);
  }

  return (
    <main className="min-h-dvh bg-white">
      <div className="relative min-h-dvh overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-[#faf7fb] to-white" />

        <div className="relative mx-auto w-full max-w-md px-5 pb-10 pt-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight" style={{ color: PRIMARY }}>
                Diagnóstico
              </h1>
            </div>
            <div className="mt-1 shrink-0 rounded-2xl border border-black/5 bg-white/70 p-3 shadow-sm backdrop-blur">
              <ShieldCheck className="h-5 w-5" style={{ color: PRIMARY }} />
            </div>
          </div>

          {/* ✅ aviso si ya finalizó en este navegador */}
          {blockedByDoneBrowser ? (
            <Card className="mt-5 overflow-hidden border-black/5 bg-white/70 shadow-sm backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Este navegador ya registró una encuesta</CardTitle>
                <p className="text-xs text-neutral-500">
                  Bloqueo suave para evitar registros repetidos desde el mismo dispositivo/navegador.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border border-black/5 bg-white/70 px-3 py-2 text-xs text-neutral-700">
                  <div className="flex items-start gap-2">
                    <BadgeCheck className="mt-0.5 h-4 w-4" style={{ color: PRIMARY }} />
                    <div className="min-w-0">
                      <p className="font-medium">Registro reciente detectado</p>
                      <p className="text-neutral-600">
                        Intenta más tarde (restante aprox:{" "}
                        <span className="font-semibold">{formatRemaining(doneBlocked!.remainingMs)}</span>).
                      </p>
                    </div>
                  </div>
                </div>

                {/* Si quieres mostrar botón dev, descomenta */}
                {/*
                <Button onClick={onClearDoneBrowser} variant="outline" className="h-11 w-full rounded-full">
                  Quitar bloqueo (pruebas)
                </Button>
                */}
              </CardContent>
            </Card>
          ) : null}

          {/* Continuar */}
          {resume ? (
            <Card className="mt-5 overflow-hidden border-black/5 bg-white/70 shadow-sm backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Tienes una encuesta en progreso</CardTitle>
                <p className="text-xs text-neutral-500">
                  Progreso guardado automáticamente en este navegador.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={onContinue}
                  className="h-12 w-full rounded-full text-base font-semibold"
                  style={{
                    background: `linear-gradient(135deg, ${PRIMARY} 0%, #9b1aa0 45%, ${PRIMARY} 100%)`,
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    Continuar
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </Button>

                <Button onClick={onResetResume} variant="outline" className="h-11 w-full rounded-full">
                  <span className="inline-flex items-center gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Borrar progreso guardado
                  </span>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card className="mt-6 overflow-hidden border-black/5 bg-white/70 shadow-[0_18px_50px_-22px_rgba(0,0,0,.25)] backdrop-blur">
            <CardHeader className="space-y-1 pb-3">
              <CardTitle className="text-base">Datos iniciales</CardTitle>
              <p className="text-xs leading-5 text-neutral-500">
                Esto ayuda a contextualizar el entorno (no es una evaluación personal).
              </p>
            </CardHeader>

            <CardContent className="space-y-5">
              {loading ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-neutral-600">
                    <Loader2 className="h-4 w-4 animate-spin" style={{ color: PRIMARY }} />
                    Cargando catálogos…
                  </div>
                  <div className="space-y-3">
                    <div className="h-12 w-full rounded-xl bg-neutral-200/60" />
                    <div className="h-12 w-full rounded-xl bg-neutral-200/60" />
                    <div className="h-12 w-full rounded-xl bg-neutral-200/60" />
                    <div className="h-12 w-full rounded-xl bg-neutral-200/60" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm">Centro escolar o laboral</Label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                        <Building2 className="h-4 w-4 text-neutral-500" />
                      </div>
                      <Select value={centroId} onValueChange={setCentroId}>
                        <SelectTrigger className="h-12 rounded-xl pl-10 shadow-sm">
                          <SelectValue placeholder="Selecciona un centro" />
                        </SelectTrigger>
                        <SelectContent>
                          {centros.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* aviso de lock suave */}
                    {blockedByLock ? (
                      <div className="mt-2 rounded-2xl border border-black/5 bg-white/70 px-3 py-2 text-xs text-neutral-700">
                        <div className="flex items-start gap-2">
                          <Lock className="mt-0.5 h-4 w-4" style={{ color: PRIMARY }} />
                          <div className="min-w-0">
                            <p className="font-medium">
                              Ya realizaste un diagnóstico reciente para este centro.
                            </p>
                            <p className="text-neutral-600">
                              Puedes continuarla o esperar{" "}
                              <span className="font-semibold">{formatRemaining(lock!.remainingMs)}</span>.
                            </p>

                            {/* Si quieres permitir quitar lock manualmente, descomenta */}
                            {/*
                            <Button
                              onClick={onClearLock}
                              variant="outline"
                              className="mt-2 h-9 rounded-full text-xs"
                            >
                              Quitar candado (pruebas)
                            </Button>
                            */}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Género</Label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                        <User className="h-4 w-4 text-neutral-500" />
                      </div>
                      <Select value={generoId} onValueChange={setGeneroId}>
                        <SelectTrigger className="h-12 rounded-xl pl-10 shadow-sm">
                          <SelectValue placeholder="Selecciona una opción" />
                        </SelectTrigger>
                        <SelectContent>
                          {generos.map((g) => (
                            <SelectItem key={g.id} value={String(g.id)}>
                              {g.etiqueta}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Edad</Label>
                    <Input
                      className="h-12 rounded-xl shadow-sm"
                      inputMode="numeric"
                      placeholder="Ej. 19"
                      value={edad}
                      onChange={(e) => setEdad(e.target.value.replace(/[^\d]/g, ""))}
                    />
                    <p className="text-xs text-neutral-500">
                      Rango permitido: <span className="font-medium">15</span> a{" "}
                      <span className="font-medium">75</span>.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Correo electrónico</Label>
                      <span
                        className="text-[11px] font-medium animate-pulse rounded-full px-2 py-0.5 text-white shadow-sm"
                        style={{
                          background: `linear-gradient(135deg, ${PRIMARY}, #9b1aa0)`,
                          boxShadow: "0 0 10px rgba(127,1,127,.45)",
                        }}
                      >
                        Opcional
                      </span>
                    </div>

                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                        <Mail className="h-4 w-4 text-neutral-500" />
                      </div>

                      <Input
                        type="email"
                        className={[
                          "h-12 rounded-xl pl-10 shadow-sm",
                          emailTrim && !emailOk ? "border-red-500 focus-visible:ring-red-500" : "",
                        ].join(" ")}
                        inputMode="email"
                        placeholder="tucorreo@ejemplo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>

                    {emailTrim && !emailOk ? (
                      <p className="text-xs text-red-600">Escribe un correo válido o déjalo vacío.</p>
                    ) : (
                      <p className="text-xs text-neutral-500">
                        Si lo proporcionas, puede usarse para enviarte seguimiento o confirmaciones.
                      </p>
                    )}
                  </div>

                  <Separator />

                  {/* ✅ Botón Nueva encuesta: se desactiva si hay resume o doneBlocked */}
                  <Button
                    onClick={onSubmit}
                    disabled={!canSubmit || blockedByLock || blockedByResume || blockedByDoneBrowser}
                    className="h-12 w-full rounded-full text-base font-semibold"
                    style={{
                      background: `linear-gradient(135deg, ${PRIMARY} 0%, #9b1aa0 45%, ${PRIMARY} 100%)`,
                      opacity: !canSubmit || blockedByLock || blockedByResume || blockedByDoneBrowser ? 0.7 : 1,
                    }}
                    title={
                      blockedByResume
                        ? "Tienes una encuesta en progreso. Continúala o borra el progreso para iniciar otra."
                        : blockedByDoneBrowser
                        ? "Este navegador ya registró una encuesta recientemente."
                        : blockedByLock
                        ? "Ya se inició una encuesta reciente para este centro en este navegador."
                        : ""
                    }
                  >
                    {submitting ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creando…
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        Nueva encuesta
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
