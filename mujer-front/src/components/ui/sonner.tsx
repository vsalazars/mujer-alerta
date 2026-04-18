"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import {
  DEFAULT_BRAND_PRIMARY,
  DEFAULT_BRAND_SECONDARY,
  DEFAULT_BRAND_SUPPORT,
  mixColors,
  normalizeBrandColor,
  withAlpha,
} from "@/lib/branding";

type ToastBrandVars = CSSProperties & {
  "--toast-brand-primary": string;
  "--toast-brand-secondary": string;
  "--toast-brand-support": string;
  "--toast-brand-border": string;
  "--toast-brand-soft": string;
  "--toast-brand-support-soft": string;
  "--toast-brand-glow": string;
  "--normal-bg": string;
  "--normal-border": string;
  "--normal-text": string;
  "--success-bg": string;
  "--success-border": string;
  "--success-text": string;
  "--error-bg": string;
  "--error-border": string;
  "--error-text": string;
  "--warning-bg": string;
  "--warning-border": string;
  "--warning-text": string;
  "--info-bg": string;
  "--info-border": string;
  "--info-text": string;
};

function resolveToastBrandVars(): ToastBrandVars {
  if (typeof window === "undefined") {
    const normalBorder = withAlpha(DEFAULT_BRAND_PRIMARY, 0.18);
    const supportSoft = withAlpha(DEFAULT_BRAND_SUPPORT, 0.55);
    return {
      "--toast-brand-primary": DEFAULT_BRAND_PRIMARY,
      "--toast-brand-secondary": DEFAULT_BRAND_SECONDARY,
      "--toast-brand-support": DEFAULT_BRAND_SUPPORT,
      "--toast-brand-border": normalBorder,
      "--toast-brand-soft": withAlpha(DEFAULT_BRAND_PRIMARY, 0.1),
      "--toast-brand-support-soft": supportSoft,
      "--toast-brand-glow": withAlpha(DEFAULT_BRAND_PRIMARY, 0.35),
      "--normal-bg": "#FFFFFF",
      "--normal-border": normalBorder,
      "--normal-text": DEFAULT_BRAND_PRIMARY,
      "--success-bg": supportSoft,
      "--success-border": normalBorder,
      "--success-text": DEFAULT_BRAND_PRIMARY,
      "--error-bg": mixColors("#FEE2E2", DEFAULT_BRAND_SUPPORT, 0.22),
      "--error-border": withAlpha("#DC2626", 0.24),
      "--error-text": "#B91C1C",
      "--warning-bg": mixColors("#FEF3C7", DEFAULT_BRAND_SUPPORT, 0.18),
      "--warning-border": withAlpha("#D97706", 0.26),
      "--warning-text": "#B45309",
      "--info-bg": mixColors(DEFAULT_BRAND_SUPPORT, "#FFFFFF", 0.36),
      "--info-border": withAlpha(DEFAULT_BRAND_SECONDARY, 0.22),
      "--info-text": DEFAULT_BRAND_PRIMARY,
    };
  }

  const source =
    Array.from(document.querySelectorAll<HTMLElement>("[style*='--brand-primary']")).at(-1) ??
    document.documentElement;
  const computed = getComputedStyle(source);

  const primary = normalizeBrandColor(
    computed.getPropertyValue("--brand-primary").trim(),
    DEFAULT_BRAND_PRIMARY
  );
  const secondary = normalizeBrandColor(
    computed.getPropertyValue("--brand-secondary").trim(),
    DEFAULT_BRAND_SECONDARY
  );
  const support = normalizeBrandColor(
    computed.getPropertyValue("--brand-support").trim(),
    DEFAULT_BRAND_SUPPORT
  );
  const border = computed.getPropertyValue("--brand-border").trim() || withAlpha(primary, 0.18);
  const soft = computed.getPropertyValue("--brand-soft").trim() || withAlpha(primary, 0.1);
  const supportSoft =
    computed.getPropertyValue("--brand-support-soft").trim() || withAlpha(support, 0.55);
  const glow = computed.getPropertyValue("--brand-glow").trim() || withAlpha(primary, 0.35);
  const normalBg = mixColors("#FFFFFF", support, 0.14);
  const infoBg = mixColors("#FFFFFF", support, 0.3);
  const warningBg = mixColors("#FEF3C7", support, 0.16);
  const errorBg = mixColors("#FEE2E2", support, 0.18);

  return {
    "--toast-brand-primary": primary,
    "--toast-brand-secondary": secondary,
    "--toast-brand-support": support,
    "--toast-brand-border": border,
    "--toast-brand-soft": soft,
    "--toast-brand-support-soft": supportSoft,
    "--toast-brand-glow": glow,
    "--normal-bg": normalBg,
    "--normal-border": border,
    "--normal-text": primary,
    "--success-bg": supportSoft,
    "--success-border": border,
    "--success-text": primary,
    "--error-bg": errorBg,
    "--error-border": withAlpha("#DC2626", 0.24),
    "--error-text": "#B91C1C",
    "--warning-bg": warningBg,
    "--warning-border": withAlpha("#D97706", 0.26),
    "--warning-text": "#B45309",
    "--info-bg": infoBg,
    "--info-border": withAlpha(secondary, 0.24),
    "--info-text": primary,
  };
}

export function AppToaster() {
  const pathname = usePathname();
  const [brandVars, setBrandVars] = useState<ToastBrandVars>(() => resolveToastBrandVars());

  useEffect(() => {
    function syncBrand() {
      setBrandVars(resolveToastBrandVars());
    }

    syncBrand();

    window.addEventListener("institucion-config-updated", syncBrand);

    const observer = new MutationObserver(() => {
      syncBrand();
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });

    return () => {
      window.removeEventListener("institucion-config-updated", syncBrand);
      observer.disconnect();
    };
  }, [pathname]);

  return (
    <Toaster
      className="app-sonner"
      style={brandVars}
      theme="light"
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "app-sonner-toast font-sans",
          title: "app-sonner-title font-semibold",
          description: "app-sonner-description text-sm",
          actionButton: "app-sonner-action",
          cancelButton: "app-sonner-cancel",
          closeButton: "app-sonner-close",
        },
      }}
    />
  );
}
