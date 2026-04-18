import { Grid3X3 } from "lucide-react";

import { HeatmapChart } from "@/components/centro/dashboard/charts";
import { BRAND_BORDER, PURPLE } from "@/components/centro/dashboard/helpers";
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
            <div className="h-[430px]">
              <HeatmapChart heatmap={heatmap} />
            </div>
            <div className="mt-6 flex flex-col items-center gap-2 pb-1">
              <div className="flex w-full max-w-[420px] items-center justify-between text-xs font-bold text-slate-500">
                <span>Bajo</span>
                <span>Muy alto</span>
              </div>
              <div
                className="h-4 w-full max-w-[420px] rounded-full border"
                style={{
                  borderColor: BRAND_BORDER,
                  background:
                    "linear-gradient(90deg, color-mix(in srgb, var(--brand-support, #EAD5F1) 88%, white) 0%, color-mix(in srgb, var(--brand-support, #EAD5F1) 30%, var(--brand-secondary, #C23C9A)) 34%, color-mix(in srgb, var(--brand-secondary, #C23C9A) 82%, var(--brand-primary, #7F017F)) 68%, var(--brand-primary, #7F017F) 100%)",
                }}
              />
              <div className="flex w-full max-w-[420px] items-center justify-start text-[11px] font-black tracking-[0.18em] text-slate-500 uppercase">
                <span style={{ color: PURPLE }}>Intensidad</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
