import { BarChart3 } from "lucide-react";

import { GroupedGeneroBarChart, HorizontalCountBarChart } from "@/components/centro/dashboard/charts";
import { PURPLE, wrapLabel } from "@/components/centro/dashboard/helpers";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type DistributionSectionProps = {
  generoBars: unknown[];
  edadBars: unknown[];
  generoStack: unknown[];
};

export function DistributionSection({
  generoBars,
  edadBars,
  generoStack,
}: DistributionSectionProps) {
  return (
    <>
      <section className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-6 rounded-[2rem] border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-black tracking-wide">
                Participantes por género
              </CardTitle>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" style={{ color: PURPLE }} />
                <Badge
                  variant="secondary"
                  className="rounded-full font-black text-[10px] uppercase tracking-widest"
                >
                  Género
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Separator className="mb-5" />
            <div className="h-[380px]">
              <HorizontalCountBarChart data={generoBars} />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-6 rounded-[2rem] border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-black tracking-wide">
                Participantes por edad
              </CardTitle>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" style={{ color: PURPLE }} />
                <Badge
                  variant="secondary"
                  className="rounded-full font-black text-[10px] uppercase tracking-widest"
                >
                  Edad
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Separator className="mb-5" />
            <div className="h-[380px]">
              <HorizontalCountBarChart data={edadBars} />
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-[2rem] border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-black tracking-wide">
              Frecuencia / Normalización / Gravedad por género
            </CardTitle>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" style={{ color: PURPLE }} />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Separator className="mb-5" />

          {generoStack.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              <span className="font-black" style={{ color: PURPLE }}>
                Sin datos por género
              </span>{" "}
              para frecuencia/normalización/gravedad.
            </div>
          ) : (
            <div className="h-[520px]">
              <GroupedGeneroBarChart data={generoStack} wrapLabel={wrapLabel} />
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
