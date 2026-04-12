import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  capitalizeWord,
  emotionTone,
  formatFechaES,
  fmtInt,
  PURPLE,
  safeArr,
  sentimentTone,
  truncate,
} from "@/components/centro/dashboard/helpers";
import type { ComentarioItem, NLPStats } from "@/components/centro/dashboard/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CommentsSectionProps = {
  year: string;
  comentarios: ComentarioItem[];
  comentariosCount: number;
  comentariosPageItems: ComentarioItem[];
  comentariosPageSafe: number;
  comentariosTotalPages: number;
  sentimientoFilter: string;
  emocionFilter: string;
  sentimientoOptions: string[];
  emocionOptions: string[];
  nlp: NLPStats;
  onSentimientoChange: (value: string) => void;
  onEmocionChange: (value: string) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
};

export function CommentsSection({
  year,
  comentarios,
  comentariosCount,
  comentariosPageItems,
  comentariosPageSafe,
  comentariosTotalPages,
  sentimientoFilter,
  emocionFilter,
  sentimientoOptions,
  emocionOptions,
  nlp,
  onSentimientoChange,
  onEmocionChange,
  onPrevPage,
  onNextPage,
}: CommentsSectionProps) {
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
              style={{ background: "rgba(127,1,127,0.10)", color: PURPLE }}
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
            <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Comentarios" value={fmtInt(nlp.total_comentarios)} />
              <StatCard label="Procesados" value={fmtInt(nlp.total_procesados)} color={PURPLE} />
              <StatCard label="Pendientes" value={fmtInt(nlp.total_pendientes)} color="#d97706" />
              <StatCard label="Error" value={fmtInt(nlp.total_error)} color="#dc2626" />
            </div>

            <div className="mb-5 grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Filtrar por sentimiento
                </p>
                <Select value={sentimientoFilter} onValueChange={onSentimientoChange}>
                  <SelectTrigger className="rounded-2xl bg-white">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {sentimientoOptions.map((sentimiento) => (
                      <SelectItem key={sentimiento} value={sentimiento}>
                        {capitalizeWord(sentimiento)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Filtrar por emocion
                </p>
                <Select value={emocionFilter} onValueChange={onEmocionChange}>
                  <SelectTrigger className="rounded-2xl bg-white">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {emocionOptions.map((emocion) => (
                      <SelectItem key={emocion} value={emocion}>
                        {capitalizeWord(emocion)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {safeArr(nlp.por_tema).length > 0 && (
              <div className="mb-5 flex flex-wrap gap-2">
                {safeArr(nlp.por_tema).slice(0, 6).map((tema) => (
                  <Badge
                    key={tema.clave}
                    variant="secondary"
                    className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest"
                    style={{ background: "rgba(15,23,42,0.05)", color: "#334155" }}
                  >
                    {tema.label}: {fmtInt(tema.total)}
                  </Badge>
                ))}
              </div>
            )}

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
                    disabled={comentariosPageSafe <= 1}
                    onClick={onPrevPage}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Anterior
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
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

function StatCard({
  label,
  value,
  color = "#0f172a",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function CommentCard({ comentario }: { comentario: ComentarioItem }) {
  return (
    <div className="group relative overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
      <div
        className="pointer-events-none absolute -top-24 -right-24 h-[220px] w-[220px] rounded-full blur-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-30"
        style={{ background: PURPLE }}
      />

      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          {comentario.genero ? (
            <Badge
              variant="secondary"
              className="rounded-full font-black text-[10px] uppercase tracking-widest"
              style={{ background: "rgba(127,1,127,0.10)", color: PURPLE }}
            >
              {comentario.genero}
            </Badge>
          ) : null}

          {comentario.sentimiento_label ? (
            <Badge
              variant="secondary"
              className="rounded-full font-black text-[10px] uppercase tracking-widest"
              style={sentimentTone(comentario.sentimiento_label)}
            >
              {capitalizeWord(comentario.sentimiento_label)}
            </Badge>
          ) : null}

          {comentario.emocion_label ? (
            <Badge
              variant="secondary"
              className="rounded-full font-black text-[10px] uppercase tracking-widest"
              style={emotionTone(comentario.emocion_label)}
            >
              {capitalizeWord(comentario.emocion_label)}
            </Badge>
          ) : null}

          {Number.isFinite(comentario.edad) && comentario.edad > 0 ? (
            <Badge
              variant="secondary"
              className="rounded-full font-black text-[10px] uppercase tracking-widest"
              style={{ background: "rgba(2,6,23,0.04)", color: "#0f172a" }}
            >
              {comentario.edad} años
            </Badge>
          ) : null}

          {comentario.fecha ? (
            <span className="ml-auto text-[11px] font-black text-slate-400">
              {formatFechaES(comentario.fecha)}
            </span>
          ) : null}
        </div>

        <p className="mt-3 text-sm leading-6 text-slate-700 font-semibold">
          {truncate(comentario.texto, 180)}
        </p>

        {comentario.resumen ? (
          <p className="mt-3 text-xs leading-5 text-slate-500 font-semibold">
            {truncate(comentario.resumen, 130)}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          {comentario.tema_etiqueta ? (
            <Badge
              variant="secondary"
              className="rounded-full text-[10px] font-black uppercase tracking-widest"
              style={{ background: "rgba(127,1,127,0.10)", color: PURPLE }}
            >
              {comentario.tema_etiqueta}
            </Badge>
          ) : null}

          {safeArr(comentario.keywords).slice(0, 3).map((keyword) => (
            <Badge
              key={`${comentario.analisis_id}-${keyword}`}
              variant="secondary"
              className="rounded-full text-[10px] font-bold"
              style={{ background: "rgba(15,23,42,0.05)", color: "#334155" }}
            >
              {keyword}
            </Badge>
          ))}
        </div>

        {comentario.texto.length > 180 ? <CommentDialog comentario={comentario} /> : null}
      </div>
    </div>
  );
}

function CommentDialog({ comentario }: { comentario: ComentarioItem }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="mt-3 text-xs font-black uppercase tracking-widest" style={{ color: PURPLE }}>
          Ver comentario completo
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-xl rounded-[1.75rem]">
        <DialogHeader>
          <DialogTitle className="text-sm font-black tracking-wide">
            Comentario completo
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          {comentario.genero ? (
            <Badge
              variant="secondary"
              className="rounded-full font-black text-[10px] uppercase tracking-widest"
              style={{ background: "rgba(127,1,127,0.10)", color: PURPLE }}
            >
              {comentario.genero}
            </Badge>
          ) : null}

          {comentario.sentimiento_label ? (
            <Badge
              variant="secondary"
              className="rounded-full font-black text-[10px] uppercase tracking-widest"
              style={sentimentTone(comentario.sentimiento_label)}
            >
              {capitalizeWord(comentario.sentimiento_label)}
            </Badge>
          ) : null}

          {comentario.emocion_label ? (
            <Badge
              variant="secondary"
              className="rounded-full font-black text-[10px] uppercase tracking-widest"
              style={emotionTone(comentario.emocion_label)}
            >
              {capitalizeWord(comentario.emocion_label)}
            </Badge>
          ) : null}

          {Number.isFinite(comentario.edad) && comentario.edad > 0 ? (
            <Badge
              variant="secondary"
              className="rounded-full font-black text-[10px] uppercase tracking-widest"
            >
              {comentario.edad} años
            </Badge>
          ) : null}

          {comentario.fecha ? (
            <span className="ml-auto text-[11px] font-black text-slate-400">
              {formatFechaES(comentario.fecha)}
            </span>
          ) : null}
        </div>

        <p className="text-sm leading-6 text-slate-700 font-semibold whitespace-pre-wrap">
          {comentario.texto}
        </p>

        {comentario.resumen ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
              Resumen PNL
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-700 font-semibold">
              {comentario.resumen}
            </p>
          </div>
        ) : null}

        {comentario.tema_etiqueta || safeArr(comentario.keywords).length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {comentario.tema_etiqueta ? (
              <Badge
                variant="secondary"
                className="rounded-full text-[10px] font-black uppercase tracking-widest"
                style={{ background: "rgba(127,1,127,0.10)", color: PURPLE }}
              >
                {comentario.tema_etiqueta}
              </Badge>
            ) : null}

            {safeArr(comentario.keywords).map((keyword) => (
              <Badge
                key={`modal-${comentario.analisis_id}-${keyword}`}
                variant="secondary"
                className="rounded-full text-[10px] font-bold"
              >
                {keyword}
              </Badge>
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
