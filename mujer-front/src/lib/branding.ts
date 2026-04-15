"use client";

export const DEFAULT_BRAND_PRIMARY = "#7F017F";
export const DEFAULT_BRAND_SECONDARY = "#C23C9A";
export const DEFAULT_BRAND_SUPPORT = "#EAD5F1";

type BrandingLike = {
  color_primario?: string;
  color_secundario?: string;
  color_apoyo?: string;
};

function expandShortHex(value: string) {
  if (value.length !== 4) return value;
  return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
}

export function normalizeBrandColor(value?: string, fallback = DEFAULT_BRAND_PRIMARY) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return fallback;
  const normalized = expandShortHex(trimmed.startsWith("#") ? trimmed : `#${trimmed}`);
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toUpperCase() : fallback;
}

export function hexToRgb(hex: string) {
  const normalized = normalizeBrandColor(hex);
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

export function withAlpha(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
}

function mixChannel(a: number, b: number, weight: number) {
  return Math.round(a + (b - a) * weight);
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

export function mixColors(hexA: string, hexB: string, weight = 0.5) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const safeWeight = Math.max(0, Math.min(1, weight));
  return rgbToHex(
    mixChannel(a.r, b.r, safeWeight),
    mixChannel(a.g, b.g, safeWeight),
    mixChannel(a.b, b.b, safeWeight)
  );
}

export function themeFromBranding(branding?: BrandingLike | null) {
  const primary = normalizeBrandColor(branding?.color_primario, DEFAULT_BRAND_PRIMARY);
  const secondary = normalizeBrandColor(branding?.color_secundario, DEFAULT_BRAND_SECONDARY);
  const supportFallback = mixColors(primary, "#FFFFFF", 0.78);
  const support = normalizeBrandColor(branding?.color_apoyo, supportFallback || DEFAULT_BRAND_SUPPORT);
  return {
    primary,
    secondary,
    support,
    soft: withAlpha(primary, 0.1),
    softStrong: withAlpha(primary, 0.16),
    supportSoft: withAlpha(support, 0.55),
    border: withAlpha(primary, 0.18),
    glow: withAlpha(primary, 0.35),
    gradient: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
    gradientWide: `linear-gradient(90deg, ${primary} 0%, ${secondary} 55%, ${primary} 100%)`,
  };
}
