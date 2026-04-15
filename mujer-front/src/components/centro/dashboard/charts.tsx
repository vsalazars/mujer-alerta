  "use client";
  /* eslint-disable @typescript-eslint/no-explicit-any */
  import { useEffect, useState } from "react";
  import dynamic from "next/dynamic";

  import { BRAND_BORDER, BRAND_GLOW, BRAND_SECONDARY, BRAND_SOFT, PURPLE, fmt2 } from "@/components/centro/dashboard/helpers";

  const ResponsiveHeatMap = dynamic(
    () => import("@nivo/heatmap").then((m) => m.ResponsiveHeatMap),
    { ssr: false }
  );
  const ResponsiveRadar = dynamic(
    () => import("@nivo/radar").then((m) => m.ResponsiveRadar),
    { ssr: false }
  );
  const ResponsiveBar = dynamic(
    () => import("@nivo/bar").then((m) => m.ResponsiveBar),
    { ssr: false }
  );

  function readBrandColor(variableName: string, fallback: string) {
    if (typeof window === "undefined") return fallback;
    const root =
      document.querySelector("main") ||
      document.documentElement;
    const value = getComputedStyle(root).getPropertyValue(variableName).trim();
    return value || fallback;
  }

  function useResolvedBrandColors() {
    const [colors, setColors] = useState(() => ({
      primary: "#7F017F",
      secondary: "#C23C9A",
      support: "#EAD5F1",
    }));

    useEffect(() => {
      const syncColors = () => {
        setColors({
          primary: readBrandColor("--brand-primary", "#7F017F"),
          secondary: readBrandColor("--brand-secondary", "#C23C9A"),
          support: readBrandColor("--brand-support", "#EAD5F1"),
        });
      };

      syncColors();
      window.addEventListener("institucion-config-updated", syncColors);
      return () => {
        window.removeEventListener("institucion-config-updated", syncColors);
      };
    }, []);

    return colors;
  }

  function clampByte(value: number) {
    return Math.max(0, Math.min(255, Math.round(value)));
  }

  function hexToRgbParts(hex: string) {
    const clean = hex.replace("#", "").trim();
    const normalized =
      clean.length === 3
        ? clean
            .split("")
            .map((char) => char + char)
            .join("")
        : clean;
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
      return { r: 127, g: 1, b: 127 };
    }
    const num = Number.parseInt(normalized, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  }

  function mixWithWhite(hex: string, ratio: number) {
    const amount = Math.max(0, Math.min(1, ratio));
    const { r, g, b } = hexToRgbParts(hex);
    const mixed = {
      r: clampByte(r + (255 - r) * amount),
      g: clampByte(g + (255 - g) * amount),
      b: clampByte(b + (255 - b) * amount),
    };
    return `rgb(${mixed.r}, ${mixed.g}, ${mixed.b})`;
  }

  export function BarValueChipLayer({ bars }: any) {
    return (
      <>
        {bars.map((bar: any) => {
          const value = Math.round(bar.data.value);
          if (!value) return null;

          return (
            <g
              key={bar.key}
              transform={`translate(${bar.x + bar.width + 8}, ${bar.y + bar.height / 2})`}
            >
              <foreignObject width={56} height={28} x={0} y={-14} style={{ overflow: "visible" }}>
                <div
                  style={{
                    background: BRAND_SOFT,
                    color: PURPLE,
                    border: `1px solid ${BRAND_BORDER}`,
                    borderRadius: 999,
                    padding: "2px 10px",
                    fontSize: 12,
                    fontWeight: 900,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    whiteSpace: "nowrap",
                    boxShadow: `0 6px 18px ${BRAND_GLOW}`,
                  }}
                >
                  {value}
                </div>
              </foreignObject>
            </g>
          );
        })}
      </>
    );
  }

  export function GroupedBarValuePillLayer({ bars }: any) {
    return (
      <>
        {bars.map((bar: any) => {
          const raw = Number(bar.data.value);
          if (!Number.isFinite(raw)) return null;

          return (
            <g
              key={bar.key}
              transform={`translate(${bar.x + bar.width + 8}, ${bar.y + bar.height / 2})`}
            >
              <foreignObject width={62} height={24} x={0} y={-12} style={{ overflow: "visible" }}>
                <div
                  style={{
                    background: BRAND_SOFT,
                    color: PURPLE,
                    border: `1px solid ${BRAND_BORDER}`,
                    borderRadius: 999,
                    padding: "1px 8px",
                    fontSize: 9,
                    fontWeight: 900,
                    letterSpacing: "0.01em",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    whiteSpace: "nowrap",
                    boxShadow: `0 6px 18px ${BRAND_GLOW}`,
                  }}
                >
                  {fmt2(raw)}
                </div>
              </foreignObject>
            </g>
          );
        })}
      </>
    );
  }

  export function RadarChart({ radar }: { radar: { keys: string[]; data: unknown[] } | null }) {
    const brand = useResolvedBrandColors();
    if (!radar) return null;

    return (
      <ResponsiveRadar
        data={radar.data as any}
        keys={radar.keys as any}
        indexBy="dimension"
        maxValue={5}
        valueFormat={(v: any) => fmt2(Number(v))}
        margin={{ top: 70, right: 80, bottom: 40, left: 80 }}
        gridLabelOffset={36}
        curve="catmullRomClosed"
        dotSize={10}
        dotColor={{ theme: "background" }}
        dotBorderWidth={2}
        colors={[brand.primary]}
        fillOpacity={0.14}
        borderWidth={3}
        blendMode="multiply"
        enableDotLabel={false}
        legends={[]}
        theme={{
          text: { fontSize: 12, fontWeight: 900, fill: "#111827" },
          grid: {
            line: { stroke: "rgba(2,6,23,0.10)", strokeWidth: 1 },
          },
          tooltip: {
            container: {
              background: "rgba(17,24,39,0.92)",
              color: "#fff",
              borderRadius: 12,
              boxShadow: "0 14px 40px rgba(0,0,0,0.22)",
              fontWeight: 900,
            },
          },
        }}
      />
    );
  }

  export function HorizontalCountBarChart({ data }: { data: unknown[] }) {
    return (
      <ResponsiveBar
        data={data as any}
        keys={["total"]}
        indexBy="label"
        layout="horizontal"
        margin={{ top: 10, right: 96, bottom: 36, left: 190 }}
        padding={0.32}
        colors={[PURPLE]}
        borderRadius={10}
        enableGridY={false}
        axisTop={null}
        axisRight={null}
        axisBottom={{
          tickSize: 0,
          tickPadding: 8,
          format: (v) => String(Math.round(Number(v))),
        }}
        axisLeft={{ tickSize: 0, tickPadding: 10 }}
        enableLabel={false}
        layers={["grid", "axes", "bars", "markers", "legends", BarValueChipLayer]}
      />
    );
  }

  export function HeatmapChart({
    heatmap,
  }: {
    heatmap: { xCount: number; data: unknown[] } | null;
  }) {
    const brand = useResolvedBrandColors();
    if (!heatmap) return null;
    const values = (heatmap.data as Array<Record<string, unknown>>)
      .flatMap((row) =>
        Object.entries(row)
          .filter(([key]) => key !== "id")
          .map(([, value]) => Number(value))
      )
      .filter((value) => Number.isFinite(value));
    const minValue = values.length ? Math.min(...values) : 0;
    const maxValue = values.length ? Math.max(...values) : 5;
    const spread = Math.max(maxValue - minValue, 0.001);

    return (
      <ResponsiveHeatMap
        data={heatmap.data as any}
        margin={{ top: 30, right: 180, bottom: 84, left: 160 }}
        valueFormat=">-.2f"
        axisTop={null}
        axisRight={null}
        axisLeft={{ tickSize: 0, tickPadding: 10 }}
        axisBottom={{
          tickSize: 0,
          tickPadding: 16,
          tickRotation: -22,
          format: () => "",
        }}
        colors={({ value }: { value: number | string }) => {
          const numeric = Number(value || 0);
          const normalized = Math.max(0, Math.min(1, (numeric - minValue) / spread));
          const whiteMix = 0.88 - normalized * 0.74;
          return mixWithWhite(brand.primary, whiteMix);
        }}
        emptyColor="#F1F5F9"
        borderWidth={1}
        borderColor="rgba(2,6,23,0.06)"
        enableLabels={true}
        labelTextColor={{ from: "color", modifiers: [["darker", 2.1]] }}
        legends={[]}
        theme={{
          text: {
            fontFamily: "Montserrat",
            fontSize: 14,
            fontWeight: 900,
            fill: "#111827",
          },
          axis: { ticks: { text: { fill: "#111827", fontWeight: 900 } } },
          tooltip: {
            container: {
              background: "rgba(17,24,39,0.92)",
              color: "#fff",
              borderRadius: 12,
              boxShadow: "0 14px 40px rgba(0,0,0,0.22)",
              fontWeight: 900,
            },
          },
        }}
      />
    );
  }

  export function GroupedGeneroBarChart({ data, wrapLabel }: { data: unknown[]; wrapLabel: (s: string, maxLen?: number, maxLines?: number) => string }) {
    return (
      <ResponsiveBar
        data={data as any}
        keys={["Frecuencia", "Normalización", "Gravedad"]}
        indexBy="label"
        groupMode="grouped"
        layout="horizontal"
        valueScale={{ type: "linear", min: 0, max: 5 }}
        indexScale={{ type: "band", round: true }}
        margin={{ top: 44, right: 110, bottom: 52, left: 210 }}
        padding={0.32}
        innerPadding={10}
        borderRadius={10}
        colors={({ id }) => {
          const k = String(id);
          if (k === "Frecuencia") return PURPLE;
          if (k === "Normalización") return BRAND_SECONDARY;
          return "color-mix(in srgb, var(--brand-support, #EAD5F1) 78%, white)";
        }}
        enableGridX={true}
        enableGridY={false}
        axisTop={null}
        axisRight={null}
        axisBottom={{
          tickSize: 0,
          tickPadding: 10,
          tickValues: [0, 1, 2, 3, 4, 5],
          format: (v) => String(v),
          legend: "Promedio (1–5)",
          legendPosition: "middle",
          legendOffset: 38,
        }}
        axisLeft={{
          tickSize: 0,
          tickPadding: 12,
          format: (v) => wrapLabel(String(v), 22, 2),
        }}
        enableLabel={false}
        layers={["grid", "axes", "bars", "markers", "legends", GroupedBarValuePillLayer]}
        valueFormat={(v: any) => fmt2(Number(v))}
        legends={[
          {
            dataFrom: "keys",
            anchor: "top",
            direction: "row",
            justify: false,
            translateY: -28,
            itemsSpacing: 18,
            itemWidth: 90,
            itemHeight: 18,
            symbolSize: 10,
            symbolShape: "circle",
          },
        ]}
        theme={{
          text: {
            fontFamily: "Montserrat",
            fontSize: 12,
            fontWeight: 900,
            fill: "#111827",
          },
          axis: { ticks: { text: { fill: "#111827", fontWeight: 900 } } },
          grid: { line: { stroke: "rgba(2,6,23,0.08)", strokeWidth: 1 } },
        }}
      />
    );
  }
