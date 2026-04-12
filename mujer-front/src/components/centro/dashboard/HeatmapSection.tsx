import { Grid3X3 } from "lucide-react";

import { HeatmapChart } from "@/components/centro/dashboard/charts";
import { PURPLE } from "@/components/centro/dashboard/helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function HeatmapSection({
  heatmap,
}: {
  heatmap: { xCount: number; data: unknown[] } | null;
}) {
  return (
    <Card className="rounded-[2rem] border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-black tracking-wide">
            Mapa de Calor por tipo de violencia contra la mujer
          </CardTitle>
          <div className="flex items-center gap-2">
            <Grid3X3 className="h-4 w-4" style={{ color: PURPLE }} />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Separator className="mb-5" />

        <div className="mt-2 w-full overflow-x-auto">
          <div style={{ minWidth: Math.max(980, (heatmap?.xCount || 0) * 112) }}>
            <div className="h-[520px]">
              <HeatmapChart heatmap={heatmap} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
