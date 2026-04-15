import type { CSSProperties } from "react";
import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import {
  BRAND_SOFT,
  capitalizeWord,
  emotionLabelES,
  emotionTone,
  PURPLE,
  sentimentTone,
} from "@/components/centro/dashboard/helpers";
import type { ComentarioItem } from "@/components/centro/dashboard/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

type CommentsSectionProps = {
  year: string;
  comentarios: ComentarioItem[];
  comentariosCount: number;
  comentariosPageItems: ComentarioItem[];
  comentariosPageSafe: number;
  comentariosTotalPages: number;
  sentimientoFilter: string;
  sentimientoOptions: string[];
  onSentimientoChange: (value: string) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
};

const COMMENT_PREVIEW_LIMIT = 210;

export function CommentsSection({
  year,
  comentarios,
  comentariosCount,
  comentariosPageItems,
  comentariosPageSafe,
  comentariosTotalPages,
  sentimientoFilter,
  sentimientoOptions,
  onSentimientoChange,
  onPrevPage,
  onNextPage,
}: CommentsSectionProps) {
  const previousButtonStyle = {
    "--ring": "var(--brand-primary, #7F017F)",
    borderColor: "var(--brand-support, #EAD5F1)",
    background: "var(--brand-support-soft, rgba(234,213,241,0.55))",
    color: "var(--brand-primary, #7F017F)",
  } as CSSProperties;
  const nextButtonStyle = {
    "--ring": "var(--brand-primary, #7F017F)",
    borderColor: "transparent",
    background:
      "linear-gradient(135deg, var(--brand-primary, #7F017F), var(--brand-secondary, #C23C9A))",
    color: "#ffffff",
    boxShadow: "0 14px 32px var(--brand-glow, rgba(127,1,127,0.16))",
  } as CSSProperties;

  return (
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
              style={{ background: BRAND_SOFT, color: PURPLE }}
            >
              {comentariosCount.toLocaleString("es-MX")}
              {comentariosCount !== comentarios.length
                ? ` de ${comentarios.length.toLocaleString("es-MX")}`
                : ""}
              {" "}comentarios
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
          <>
            <div className="mb-6">
              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Filtrar por sentimiento
                </p>
                <div className="flex flex-wrap gap-2">
                  <FilterPill
                    active={sentimientoFilter === "all"}
                    label="Todos"
                    onClick={() => onSentimientoChange("all")}
                  />
                  {sentimientoOptions.map((sentimiento) => (
                    <FilterPill
                      key={sentimiento}
                      active={sentimientoFilter === sentimiento}
                      label={capitalizeWord(sentimiento)}
                      onClick={() => onSentimientoChange(sentimiento)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {comentariosPageItems.map((comentario, index) => (
                <CommentCard key={`${comentario.encuesta_id}-${index}`} comentario={comentario} />
              ))}
            </div>

            {comentariosTotalPages > 1 ? (
              <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Página {comentariosPageSafe} de {comentariosTotalPages}
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    style={previousButtonStyle}
                    disabled={comentariosPageSafe <= 1}
                    onClick={onPrevPage}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Anterior
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full border-0"
                    style={nextButtonStyle}
                    disabled={comentariosPageSafe >= comentariosTotalPages}
                    onClick={onNextPage}
                  >
                    Siguiente
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FilterPill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border px-4 py-2 text-sm font-semibold transition-all",
        active
          ? "border-[var(--brand-border,rgba(127,1,127,0.18))] bg-[var(--brand-soft,rgba(127,1,127,0.10))] text-[var(--brand-primary,#7F017F)] shadow-[0_10px_30px_var(--brand-soft,rgba(127,1,127,0.10))]"
          : "border-slate-200 bg-white text-slate-600 hover:border-[var(--brand-border,rgba(127,1,127,0.18))] hover:text-[var(--brand-primary,#7F017F)]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function CommentCard({ comentario }: { comentario: ComentarioItem }) {
  const preview = buildPreview(comentario.texto, COMMENT_PREVIEW_LIMIT);
  const showModal = preview.truncated;

  return (
    <div className="group relative h-full min-h-[220px] overflow-hidden rounded-[1.45rem] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-all duration-300 hover:shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(360px circle at 100% 0%, var(--brand-soft, rgba(127,1,127,0.08)), transparent 52%)",
        }}
      />

      <div className="relative flex h-full flex-col">
        <div className="mb-4 overflow-hidden">
          <div className="flex flex-nowrap items-center gap-1.5 overflow-hidden whitespace-nowrap">
            {comentario.genero ? (
              <MetaPill
                label={comentario.genero}
                className="border-[var(--brand-border,rgba(127,1,127,0.18))] bg-[var(--brand-soft,rgba(127,1,127,0.10))] text-[var(--brand-primary,#7F017F)]"
              />
            ) : null}

            {Number.isFinite(comentario.edad) && comentario.edad > 0 ? (
              <MetaPill
                label={`${comentario.edad} años`}
                className="border-slate-200 bg-slate-50 text-slate-700"
              />
            ) : null}

            {comentario.sentimiento_label ? (
              <MetaPill
                label={capitalizeWord(comentario.sentimiento_label)}
                className="border-[rgba(239,68,68,0.12)]"
                style={sentimentTone(comentario.sentimiento_label)}
              />
            ) : null}

            {comentario.emocion_label ? (
              <MetaPill
                label={emotionLabelES(comentario.emocion_label)}
                className="border-transparent"
                style={emotionTone(comentario.emocion_label)}
              />
            ) : null}
          </div>
        </div>

        <p className="text-[13px] leading-7 text-slate-700 font-semibold whitespace-pre-wrap">
          {preview.text}
        </p>

        <div className="mt-auto pt-4">
          {showModal ? (
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary,#7F017F)] transition-opacity hover:opacity-80"
                >
                  Ver más
                </button>
              </DialogTrigger>

              <DialogContent className="max-w-2xl rounded-[1.75rem]">
                <DialogHeader>
                  <DialogTitle className="text-sm font-black tracking-wide">
                    Comentario completo
                  </DialogTitle>
                </DialogHeader>

                <div className="mb-4 overflow-hidden">
                  <div className="flex flex-nowrap items-center gap-1.5 overflow-hidden whitespace-nowrap">
                    {comentario.genero ? (
                      <MetaPill
                        label={comentario.genero}
                        className="border-[var(--brand-border,rgba(127,1,127,0.18))] bg-[var(--brand-soft,rgba(127,1,127,0.10))] text-[var(--brand-primary,#7F017F)]"
                      />
                    ) : null}

                    {Number.isFinite(comentario.edad) && comentario.edad > 0 ? (
                      <MetaPill
                        label={`${comentario.edad} años`}
                        className="border-slate-200 bg-slate-50 text-slate-700"
                      />
                    ) : null}

                    {comentario.sentimiento_label ? (
                      <MetaPill
                        label={capitalizeWord(comentario.sentimiento_label)}
                        className="border-[rgba(239,68,68,0.12)]"
                        style={sentimentTone(comentario.sentimiento_label)}
                      />
                    ) : null}

                    {comentario.emocion_label ? (
                      <MetaPill
                        label={emotionLabelES(comentario.emocion_label)}
                        className="border-transparent"
                        style={emotionTone(comentario.emocion_label)}
                      />
                    ) : null}
                  </div>
                </div>

                <p className="text-[15px] leading-8 text-slate-700 font-semibold whitespace-pre-wrap">
                  {comentario.texto}
                </p>
              </DialogContent>
            </Dialog>
          ) : (
            <div className="h-4" />
          )}
        </div>
      </div>
    </div>
  );
}

function MetaPill({
  label,
  className,
  style,
}: {
  label: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center rounded-full border px-2 py-0 text-[8px] font-black uppercase tracking-[0.08em] leading-none ${className || ""}`}
      style={style}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}

function buildPreview(text: string, limit: number) {
  const clean = (text || "").trim();
  if (clean.length <= limit) {
    return { text: clean, truncated: false };
  }

  return {
    text: clean.slice(0, limit).trimEnd() + "…",
    truncated: true,
  };
}
