"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type TenantLayoutProps = {
  children: React.ReactNode;
};

type PublicAccessResolution = {
  kind: "institucion" | "centro";
  institucion_slug: string;
  centro_slug?: string;
  target_path: string;
};

const configuredApiUrl = (process.env.NEXT_PUBLIC_API_URL || "").trim();

const API_BASE = (
  configuredApiUrl ||
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:8080")
).replace(/\/$/, "");

export default function TenantLayout({ children }: TenantLayoutProps) {
  const params = useParams<{ institucionSlug: string }>();
  const institucionSlug = String(params?.institucionSlug || "").trim();
  const [status, setStatus] = useState<"loading" | "ready" | "not_found">("loading");

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      if (!institucionSlug) {
        if (!cancelled) setStatus("not_found");
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE}/api/access/resolve?slug=${encodeURIComponent(institucionSlug)}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        if (!response.ok) {
          if (!cancelled) setStatus("not_found");
          return;
        }

        const resolution = (await response.json()) as PublicAccessResolution;
        if (cancelled) return;

        if (
          (resolution.kind === "institucion" && resolution.institucion_slug === institucionSlug) ||
          (resolution.kind === "centro" && resolution.centro_slug === institucionSlug)
        ) {
          setStatus("ready");
          return;
        }

        setStatus("not_found");
      } catch {
        if (!cancelled) setStatus("not_found");
      }
    }

    void resolve();

    return () => {
      cancelled = true;
    };
  }, [institucionSlug]);

  if (status === "loading") {
    return null;
  }

  if (status === "not_found") {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#f7f4ef] px-6 text-slate-900">
        <div className="max-w-md text-center">
          <p className="text-5xl font-black text-[#7F017F]">404</p>
          <h1 className="mt-4 text-2xl font-black">Slug no encontrado</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            No encontramos una institucion o centro activo asociado a ese slug.
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex rounded-full bg-[#7F017F] px-5 py-3 text-sm font-semibold text-white"
            >
              Volver a la landing
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return children;
}
