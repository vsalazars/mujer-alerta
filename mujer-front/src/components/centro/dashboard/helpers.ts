import type {
  AdvRow,
  ConsTag,
  LevelTag,
  PrecTag,
  Semantic5,
  VarTag,
  YearOption,
} from "@/components/centro/dashboard/types";

export const PURPLE = "#7F017F";

export function clamp5(x: number) {
  const n = Number.isFinite(x) ? x : 0;
  return Math.max(0, Math.min(5, n));
}

export function fmt2(x: number) {
  return clamp5(x).toFixed(2);
}

export function fmtInt(x: number) {
  return Math.round(Number.isFinite(x) ? x : 0).toLocaleString("es-MX");
}

export function safeArr<T>(v?: T[] | null) {
  return Array.isArray(v) ? v : [];
}

export function pctFrom5(x: number) {
  const v = clamp5(x);
  return Math.round((v / 5) * 100);
}

export function toNearestLikert(x: number): 1 | 2 | 3 | 4 | 5 {
  const v = clamp5(x);
  const r = Math.round(v);
  const rr = Math.max(1, Math.min(5, r));
  return rr as 1 | 2 | 3 | 4 | 5;
}

export function semanticLevel5(x: number): Semantic5 {
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

export function semanticBadgeClass5(level: Semantic5, onDark = false) {
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

export function wrapLabel(s: string, maxLen = 18, maxLines = 2) {
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

export function levelFromMean(x: number): LevelTag {
  const v = clamp5(x);
  if (v < 1.5) return "Muy bajo";
  if (v < 2.5) return "Bajo";
  if (v < 3.5) return "Medio";
  if (v < 4.5) return "Alto";
  return "Muy alto";
}

export function variabilityTag(stdDevItems: number): VarTag {
  const s = Number.isFinite(stdDevItems) ? stdDevItems : 0;
  if (s < 0.6) return "Baja";
  if (s <= 0.9) return "Moderada";
  return "Alta";
}

export function precisionTagByCI(ciInf: number, ciSup: number): PrecTag {
  const a = Number.isFinite(ciInf) ? ciInf : 0;
  const b = Number.isFinite(ciSup) ? ciSup : 0;
  const width = Math.abs(b - a);
  if (width <= 0.4) return "Alta";
  if (width <= 0.7) return "Moderada";
  return "Baja";
}

export function consistencyTag(alpha: number): ConsTag {
  const a = Number.isFinite(alpha) ? alpha : 0;
  if (a >= 0.9) return "Muy alta";
  if (a >= 0.8) return "Alta";
  if (a >= 0.7) return "Aceptable";
  return "Baja";
}

export function dimPretty(dim: string) {
  if (dim === "frecuencia") return "Frecuencia";
  if (dim === "normalidad") return "Normalización";
  if (dim === "gravedad") return "Gravedad";
  return dim;
}

export function dimShortRisk(_dim: string, mean: number) {
  const lvl = levelFromMean(mean);
  const v = clamp5(mean);
  const nearHigh = lvl === "Medio" && v >= 3.25;
  if (nearHigh) return "Medio-alto";
  return lvl;
}

export function pickDim(rows: AdvRow[], dim: string) {
  return rows.find((r) => String(r.dimension) === dim);
}

export function fallbackYears(): YearOption[] {
  const y = new Date().getFullYear();
  const out: YearOption[] = [{ value: "all", label: "Todos" }];
  for (let i = 0; i < 8; i++) out.push({ value: String(y - i), label: String(y - i) });
  return out;
}

export function capitalizeWord(value?: string) {
  const txt = (value || "").trim();
  if (!txt) return "";
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

export function sentimentTone(sentimiento?: string) {
  switch ((sentimiento || "").toLowerCase()) {
    case "negativo":
      return { background: "rgba(220,38,38,0.10)", color: "#b91c1c" };
    case "positivo":
      return { background: "rgba(22,163,74,0.12)", color: "#15803d" };
    case "neutral":
      return { background: "rgba(2,6,23,0.06)", color: "#334155" };
    default:
      return { background: "rgba(148,163,184,0.16)", color: "#475569" };
  }
}

export function emotionTone(emocion?: string) {
  switch ((emocion || "").toLowerCase()) {
    case "fear":
      return { background: "rgba(14,116,144,0.12)", color: "#0f766e" };
    case "sadness":
      return { background: "rgba(37,99,235,0.12)", color: "#1d4ed8" };
    case "anger":
    case "disgust":
      return { background: "rgba(217,119,6,0.16)", color: "#b45309" };
    case "joy":
      return { background: "rgba(250,204,21,0.20)", color: "#a16207" };
    default:
      return { background: "rgba(15,23,42,0.05)", color: "#475569" };
  }
}

export function truncate(s: string, n = 180) {
  const t = (s || "").trim();
  if (t.length <= n) return t;
  return t.slice(0, n).trimEnd() + "…";
}

export function formatFechaES(iso?: string) {
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
