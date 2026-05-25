// src/app/diagnostico/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Separator } from "../../components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
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
import { themeFromBranding } from "../../lib/branding";
import { extractInstitutionSlug, withInstitutionSlug } from "../../lib/routing";

type Centro = {
  id: number;
  tipo: string;
  nombre: string;
  slug: string;
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

type TenantBranding = {
  institucion_id: number;
  nombre_publico?: string;
  logo_url?: string;
  color_primario?: string;
  color_secundario?: string;
};

// === Detectar “encuesta en progreso” ===
const LS_PREFIX = "mujer_alerta:diagnostico:";
const LS_SUFFIX = ":v1";

type SavedProgress = {
  v: number;
  updated_at: number;
  qIndex: number;
  comentario: string;
  initialAnswers?: Record<string, string>;
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
        (prog.initialAnswers && Object.keys(prog.initialAnswers).length > 0) ||
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
  const pathname = usePathname();
  const institucionSlug = extractInstitutionSlug(pathname);
  const accessSlug = institucionSlug.trim().toLowerCase();

  const [centros, setCentros] = useState<Centro[]>([]);
  const [generos, setGeneros] = useState<Genero[]>([]);
  const [branding, setBranding] = useState<TenantBranding | null>(null);
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
  const [welcomeOpen, setWelcomeOpen] = useState(true);
  const theme = themeFromBranding(branding);

  useEffect(() => {
    (async () => {
      try {
        const [c, g] = await Promise.all([
          api<Centro[]>("/api/centros?limit=50"),
          api<Genero[]>("/api/generos"),
        ]);
        setCentros(c);
        setGeneros(g);
        void api<TenantBranding>("/api/tenant/branding")
          .then((payload) => setBranding(payload))
          .catch(() => setBranding(null));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!accessSlug || centros.length === 0) return;

    const matched = centros.find((centro) => String(centro.slug || "").trim().toLowerCase() === accessSlug);
    if (matched) {
      setCentroId(String(matched.id));
    }
  }, [accessSlug, centros]);

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
  const selectedCentro = useMemo(
    () => centros.find((centro) => String(centro.id) === centroId) || null,
    [centros, centroId],
  );
  const isCentroFixedBySlug = Boolean(accessSlug && selectedCentro?.slug?.toLowerCase() === accessSlug);

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
        `Ya se inició un diagnóstico recientemente para este centro en este navegador.\n\nPuedes continuarla donde te quedaste`
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
      router.push(withInstitutionSlug(institucionSlug, `/diagnostico/${resp.encuesta_id}`));
    } catch (err: any) {
      alert(err?.message || "No se pudo crear la encuesta.");
    } finally {
      setSubmitting(false);
    }
  }

  function onContinue() {
    if (!resume?.encuestaId) return;
    router.push(withInstitutionSlug(institucionSlug, `/diagnostico/${resume.encuestaId}`));
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

  const tenantFieldStyle = {
    borderColor: theme.border,
    boxShadow: `0 1px 2px rgba(15, 23, 42, 0.06)`,
    "--ring": theme.primary,
    "--input": theme.border,
  } as React.CSSProperties;

  const tenantSelectContentStyle = {
    borderColor: theme.border,
    boxShadow: `0 18px 44px -24px ${theme.glow}`,
  } as React.CSSProperties;

  return (
    <main className="min-h-dvh bg-white">
      <Dialog open={welcomeOpen} onOpenChange={setWelcomeOpen}>
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
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden"
              >
                <Image
                  src="/avatar.png"
                  alt="Avatar de bienvenida"
                  width={80}
                  height={80}
                  className="h-full w-full object-cover"
                  priority
                />
              </div>
              <DialogHeader className="text-left">
                <DialogTitle style={{ color: theme.primary }}>Bienvenid@</DialogTitle>
                <DialogDescription className="text-sm leading-7 text-neutral-700">
                  Esta iniciativa busca identificar algunas manifestaciones de la violencia contra
                  las mujeres por razones de género que suceden en la vida cotidiana dentro de la
                  escuela. Te pedimos que al responder, consideres tu experiencia personal dentro
                  del plantel. Agradecemos tu participación.
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>

          <div className="px-6 pb-6 pt-4">
            <Button
              onClick={() => setWelcomeOpen(false)}
              className="h-12 w-full rounded-full text-base font-semibold text-white"
              style={{ background: theme.gradient }}
            >
              Continuar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="relative min-h-dvh overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(to bottom, #ffffff 0%, ${theme.soft} 55%, #ffffff 100%)` }}
        />

        <div className="fixed inset-x-0 top-0 z-30 bg-white/92 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="mx-auto w-full max-w-md px-4 py-3 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                {branding?.logo_url ? (
                  <div className="mb-1 flex items-center gap-3">
                    <img
                      src={branding.logo_url}
                      alt={branding.nombre_publico || "Logo institucional"}
                      className="h-14 w-auto max-w-[92px] shrink-0 object-contain sm:h-16 sm:max-w-[104px]"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-5" style={{ color: theme.primary }}>
                        {branding.nombre_publico || "Institución participante"}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="mt-1 shrink-0">
                {!branding?.logo_url ? (
                  <div className="rounded-2xl border border-black/5 bg-white/70 p-3 shadow-sm backdrop-blur">
                    <ShieldCheck className="h-5 w-5" style={{ color: theme.primary }} />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md px-4 pb-10 pt-28 sm:px-5 sm:pt-32">

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
                    <BadgeCheck className="mt-0.5 h-4 w-4" style={{ color: theme.primary }} />
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
                    background: theme.gradient,
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

          <Card className="mt-4 overflow-hidden border-black/5 bg-white/70 shadow-[0_18px_50px_-22px_rgba(0,0,0,.25)] backdrop-blur sm:mt-6">
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
                    <Loader2 className="h-4 w-4 animate-spin" style={{ color: theme.primary }} />
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
                   
                    {isCentroFixedBySlug && selectedCentro ? (
                      <div className="rounded-xl border border-black/5 bg-white/80 px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#faf5ff]">
                            <Building2 className="h-4 w-4" style={{ color: theme.primary }} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold leading-6 text-neutral-900">{selectedCentro.nombre}</p>
                            
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                          <Building2 className="h-4 w-4 text-neutral-500" />
                        </div>
                        <Select value={centroId} onValueChange={setCentroId}>
                          <SelectTrigger className="h-12 w-full rounded-xl pl-10 shadow-sm" style={tenantFieldStyle}>
                            <SelectValue placeholder="Selecciona un centro" />
                          </SelectTrigger>
                          <SelectContent style={tenantSelectContentStyle}>
                            {centros.map((c) => (
                              <SelectItem
                                key={c.id}
                                value={String(c.id)}
                                className="data-[highlighted]:bg-[var(--tenant-soft)] data-[highlighted]:text-[var(--tenant-primary)]"
                                style={
                                  {
                                    "--tenant-primary": theme.primary,
                                    "--tenant-soft": theme.soft,
                                  } as React.CSSProperties
                                }
                              >
                                {c.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* aviso de lock suave */}
                    {blockedByLock ? (
                      <div className="mt-2 rounded-2xl border border-black/5 bg-white/70 px-3 py-2 text-xs text-neutral-700">
                        <div className="flex items-start gap-2">
                          <Lock className="mt-0.5 h-4 w-4" style={{ color: theme.primary }} />
                          <div className="min-w-0">
                            <p className="font-medium">
                              Ya realizaste un diagnóstico reciente para este centro.
                            </p>
                            <p className="text-neutral-600">
                              Puedes continuarla más tarde.
                            </p>

                           
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
                        <SelectTrigger className="h-12 w-full rounded-xl pl-10 shadow-sm" style={tenantFieldStyle}>
                          <SelectValue placeholder="Selecciona una opción" />
                        </SelectTrigger>
                        <SelectContent style={tenantSelectContentStyle}>
                          {generos.map((g) => (
                            <SelectItem
                              key={g.id}
                              value={String(g.id)}
                              className="data-[highlighted]:bg-[var(--tenant-soft)] data-[highlighted]:text-[var(--tenant-primary)]"
                              style={
                                  {
                                  "--tenant-primary": theme.primary,
                                  "--tenant-soft": theme.soft,
                                } as React.CSSProperties
                              }
                            >
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
                      style={tenantFieldStyle}
                    />
                    <p className="text-xs text-neutral-500">
                      Rango permitido: <span className="font-medium">15</span> a{" "}
                      <span className="font-medium">75</span>.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label className="text-sm">Correo electrónico</Label>
                      <span
                        className="shrink-0 text-[11px] font-medium animate-pulse rounded-full px-2 py-0.5 text-white shadow-sm"
                        style={{
                          background: theme.gradient,
                          boxShadow: `0 0 10px ${theme.glow}`,
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
                        style={emailTrim && !emailOk ? undefined : tenantFieldStyle}
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
                      background: theme.gradient,
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
                        Responder encuesta
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
