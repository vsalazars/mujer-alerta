import { Activity, Calendar, Sparkles } from "lucide-react";

import { PURPLE, pctFrom5, semanticBadgeClass5, semanticLevel5 } from "@/components/centro/dashboard/helpers";
import type { CentroResumenResponse, YearOption } from "@/components/centro/dashboard/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DashboardHeroProps = {
  data: CentroResumenResponse;
  showSemantic: boolean;
  year: string;
  yearOptions: YearOption[];
  onYearChange: (value: string) => void;
  onOpenTrends: () => void;
};

export function DashboardHero({
  data,
  showSemantic,
  year,
  yearOptions,
  onYearChange,
  onOpenTrends,
}: DashboardHeroProps) {
  return (
    <div className="mx-auto max-w-[1400px] mb-10">
      <div className="relative overflow-hidden rounded-[2.25rem] border bg-white shadow-sm">
        <div
          className="pointer-events-none absolute -top-32 -right-32 h-[420px] w-[420px] rounded-full blur-3xl opacity-25"
          style={{ background: PURPLE }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_circle_at_0%_0%,rgba(127,1,127,0.10),transparent_55%)]" />
        <div className="relative p-8 md:p-10">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Badge
                  variant="secondary"
                  className="rounded-full px-3 py-1 font-black tracking-[0.18em] uppercase"
                  style={{ color: PURPLE, background: "rgba(127,1,127,0.08)" }}
                >
                  Analítica agregada
                </Badge>
                <Sparkles className="h-4 w-4 opacity-70" style={{ color: PURPLE }} />
              </div>

              <h1 className="text-4xl md:text-5xl font-light tracking-tight">
                Dashboard <span className="font-black">Mujer Alerta</span>
              </h1>

              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold text-slate-600">
                  Total de percepción de violencia contra la mujer
                </span>

                <Badge
                  className="rounded-full px-3 py-1 font-black text-sm"
                  style={{ background: "rgba(127,1,127,0.12)", color: PURPLE }}
                >
                  {pctFrom5(data.global.total)}%
                </Badge>

                {showSemantic ? (
                  <Badge
                    className={`rounded-full font-black ${semanticBadgeClass5(
                      semanticLevel5(data.global.total),
                      true
                    )}`}
                  >
                    {semanticLevel5(data.global.total)}
                  </Badge>
                ) : null}

                <Badge
                  variant="secondary"
                  className="rounded-full px-3 py-1 font-black tracking-wide"
                  style={{ background: "rgba(2,6,23,0.04)", color: "#0f172a" }}
                >
                  {year === "all" ? "Histórico: Todos" : `Año: ${year}`}
                </Badge>
              </div>
            </div>

            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 text-xs font-black text-slate-600">
                  <Calendar className="h-4 w-4" style={{ color: PURPLE }} />
                  Año
                </div>

                <Select value={year} onValueChange={onYearChange}>
                  <SelectTrigger className="h-10 w-[180px] rounded-2xl bg-white border-slate-200 hover:border-purple-300">
                    <SelectValue placeholder="Selecciona año" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {yearOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-2xl bg-white border-slate-200 hover:border-purple-300"
                  onClick={onOpenTrends}
                  title="Comparar promedios anuales"
                >
                  <Activity className="mr-2 h-4 w-4" style={{ color: PURPLE }} />
                  Tendencias
                </Button>
              </div>

              <div className="flex items-center gap-3" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
