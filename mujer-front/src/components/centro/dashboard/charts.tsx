  "use client";
  /* eslint-disable @typescript-eslint/no-explicit-any */
  import { useEffect, useMemo, useState } from "react";
  import dynamic from "next/dynamic";

  import { fmt2 } from "@/components/centro/dashboard/helpers";
  const Plot = dynamic(
    () => import("react-plotly.js"),
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
      const source =
        document.querySelector("main[style*='--brand-primary']") ||
        document.querySelector("main") ||
        document.documentElement;

      const observer = new MutationObserver(() => {
        syncColors();
      });
      observer.observe(source, {
        attributes: true,
        attributeFilter: ["style", "class"],
      });

      window.addEventListener("institucion-config-updated", syncColors);
      return () => {
        observer.disconnect();
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

  function mixColors(hexA: string, hexB: string, ratio: number) {
    const amount = Math.max(0, Math.min(1, ratio));
    const a = hexToRgbParts(hexA);
    const b = hexToRgbParts(hexB);
    return `rgb(${clampByte(a.r + (b.r - a.r) * amount)}, ${clampByte(a.g + (b.g - a.g) * amount)}, ${clampByte(a.b + (b.b - a.b) * amount)})`;
  }

  function heatmapTextColor(fill: string) {
    const { r, g, b } = hexToRgbParts(fill);
    const luminance = ((0.2126 * r) + (0.7152 * g) + (0.0722 * b)) / 255;
    return luminance < 0.5 ? "rgba(255,255,255,0.94)" : "rgba(17,24,39,0.82)";
  }

  function wrapHeatmapLabel(label: string, maxLen = 16) {
    const words = String(label || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "";
    const lines: string[] = [];
    let current = "";

    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (next.length <= maxLen || !current) {
        current = next;
        return;
      }
      lines.push(current);
      current = word;
    });

    if (current) lines.push(current);
    return lines.slice(0, 3).join("<br>");
  }

  function withAlphaFromHex(hex: string, alpha: number) {
    const { r, g, b } = hexToRgbParts(hex);
    const safe = Math.max(0, Math.min(1, alpha));
    return `rgba(${r}, ${g}, ${b}, ${safe})`;
  }

  function axisFont(color = "#334155", size = 12) {
    return {
      family: "Montserrat, sans-serif",
      color,
      size,
    };
  }

  export function RadarChart({ radar }: { radar: { keys: string[]; data: unknown[] } | null }) {
    const brand = useResolvedBrandColors();
    if (!radar) return null;

    const preferredOrder = ["Total", "Frecuencia", "Normalización", "Gravedad"];
    const points = (radar.data as Array<{ dimension?: string; Global?: number }>)
      .map((row) => ({
        dimension: String(row.dimension || ""),
        value: Number(row.Global || 0),
      }))
      .sort((a, b) => preferredOrder.indexOf(a.dimension) - preferredOrder.indexOf(b.dimension));
    const theta = [...points.map((point) => point.dimension), points[0]?.dimension || ""];
    const r = [...points.map((point) => point.value), points[0]?.value || 0];

    return (
      <Plot
        data={[
          {
            type: "scatterpolar",
            mode: "lines+markers",
            theta,
            r,
            fill: "toself",
            fillcolor: withAlphaFromHex(brand.primary, 0.16),
            line: {
              color: brand.primary,
              width: 4,
            },
            marker: {
              size: 10,
              color: brand.secondary,
              line: {
                color: "#FFFFFF",
                width: 2,
              },
            },
            hovertemplate: "<b>%{theta}</b><br>Valor: <b>%{r:.2f}</b><extra></extra>",
          } as any,
        ]}
        layout={{
          autosize: true,
          margin: { t: 12, r: 24, b: 12, l: 24 },
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          showlegend: false,
          polar: {
            bgcolor: "rgba(0,0,0,0)",
            radialaxis: {
              range: [0, 5],
              tickvals: [1, 2, 3, 4, 5],
              tickfont: axisFont(brand.primary, 14),
              gridcolor: withAlphaFromHex(brand.primary, 0.16),
              linecolor: withAlphaFromHex(brand.primary, 0.2),
              angle: 90,
              tickcolor: withAlphaFromHex(brand.primary, 0.55),
              ticklen: 8,
            },
            angularaxis: {
              showticklabels: false,
              rotation: 90,
              direction: "clockwise",
              gridcolor: withAlphaFromHex(brand.primary, 0.08),
              linecolor: withAlphaFromHex(brand.primary, 0.14),
            },
          },
          hoverlabel: {
            bgcolor: "rgba(17,24,39,0.94)",
            bordercolor: brand.primary,
            font: axisFont("#FFFFFF", 13),
          },
        }}
        config={{
          displayModeBar: false,
          responsive: true,
        }}
        style={{ width: "100%", height: "100%" }}
        useResizeHandler
      />
    );
  }

  export function HorizontalCountBarChart({ data }: { data: unknown[] }) {
    const brand = useResolvedBrandColors();
    const rows = (data as Array<{ label?: string; total?: number }>)
      .map((item) => ({
        label: String(item.label || ""),
        total: Number(item.total || 0),
      }))
      .filter((item) => item.label && item.total > 0);

    const chartKey = rows.map((row) => `${row.label}:${row.total}`).join("|") || "empty";

    return (
      <Plot
        key={chartKey}
        data={[
          {
            type: "bar",
            orientation: "h",
            x: rows.map((row) => row.total),
            y: rows.map((row) => row.label),
            marker: {
              color: rows.map((_, index) =>
                index % 2 === 0
                  ? brand.primary
                  : mixColors(brand.primary, brand.secondary, 0.54)
              ),
              line: {
                color: withAlphaFromHex("#FFFFFF", 0.95),
                width: 1.5,
              },
            },
            hovertemplate: "<b>%{y}</b><br>Total: <b>%{x}</b><extra></extra>",
          } as any,
        ]}
        layout={{
          autosize: true,
          margin: { t: 8, r: 42, b: 34, l: 180 },
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          bargap: 0.3,
          xaxis: {
            showgrid: true,
            gridcolor: withAlphaFromHex(brand.primary, 0.08),
            zeroline: false,
            fixedrange: true,
            tickfont: axisFont("#64748B", 12),
          },
          yaxis: {
            type: "category",
            autorange: "reversed",
            categoryorder: "array",
            categoryarray: rows.map((row) => row.label),
            showgrid: false,
            zeroline: false,
            fixedrange: true,
            tickfont: axisFont("#1F2937", 12),
          },
          hoverlabel: {
            bgcolor: "rgba(17,24,39,0.94)",
            bordercolor: brand.primary,
            font: axisFont("#FFFFFF", 13),
          },
          showlegend: false,
        }}
        config={{
          displayModeBar: false,
          responsive: true,
        }}
        style={{ width: "100%", height: "100%" }}
        useResizeHandler
      />
    );
  }

  export function HeatmapChart({
    heatmap,
  }: {
    heatmap: { xCount: number; data: unknown[] } | null;
  }) {
    const brand = useResolvedBrandColors();
    const processed = useMemo(() => {
      if (!heatmap) {
        return {
          xLabels: [] as string[],
          yLabels: [] as string[],
          zValues: [] as number[][],
          textValues: [] as string[][],
          hoverText: [] as string[][],
          minValue: 0,
          maxValue: 5,
        };
      }

      const sourceRows = heatmap.data as Array<{ id?: string; data?: Array<{ x?: string; y?: number | string }> }>;
      const xLabels = sourceRows[0]?.data?.map((cell) => String(cell.x || "")) || [];
      const xDisplayLabels = xLabels.map((label) => wrapHeatmapLabel(label));
      const yLabels = sourceRows.map((row) => String(row.id || ""));
      const zValues = sourceRows.map((row) =>
        (row.data || []).map((cell) => {
          const numeric = Number(cell?.y || 0);
          return Number.isFinite(numeric) ? numeric : 0;
        })
      );
      const flatValues = zValues.flat().filter((value) => Number.isFinite(value));
      const minValue = flatValues.length ? Math.min(...flatValues) : 0;
      const maxValue = flatValues.length ? Math.max(...flatValues) : 5;

      const textValues = zValues.map((row) => row.map((value) => fmt2(value)));
      const hoverText = sourceRows.map((row, rowIndex) =>
        (row.data || []).map((cell, columnIndex) => {
          const value = zValues[rowIndex]?.[columnIndex] ?? 0;
          return [
            `<b>${xLabels[columnIndex] || ""}</b>`,
            `${yLabels[rowIndex] || ""}: <b>${fmt2(value)}</b>`,
          ].join("<br>");
        })
      );

      return { xLabels, xDisplayLabels, yLabels, zValues, textValues, hoverText, minValue, maxValue };
    }, [heatmap]);

    if (!heatmap) return null;

    const colorscale = [
      [0, mixWithWhite(brand.support, 0.1)],
      [0.35, mixColors(brand.support, brand.secondary, 0.62)],
      [0.7, mixColors(brand.secondary, brand.primary, 0.7)],
      [1, brand.primary],
    ] as Array<[number, string]>;
    return (
      <Plot
        data={[
          {
            type: "heatmap",
            x: processed.xLabels,
            y: processed.yLabels,
            z: processed.zValues,
            text: processed.textValues,
            texttemplate: "%{text}",
            textfont: {
              size: 18,
              family: "Montserrat, sans-serif",
              color: heatmapTextColor(brand.primary),
            },
            hoverinfo: "text",
            hovertext: processed.hoverText,
            colorscale,
            zmin: processed.minValue,
            zmax: processed.maxValue,
            xgap: 16,
            ygap: 16,
            showscale: false,
            hoverongaps: false,
          } as any,
        ]}
        layout={{
          autosize: true,
          margin: { t: 28, r: 12, b: 18, l: 185 },
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          font: {
            family: "Montserrat, sans-serif",
            color: "#1F2937",
          },
          xaxis: {
            side: "top",
            tickmode: "array",
            tickvals: processed.xLabels,
            ticktext: processed.xDisplayLabels,
            tickfont: {
              size: 13,
              color: "#64748B",
              family: "Montserrat, sans-serif",
            },
            tickangle: 0,
            showgrid: false,
            zeroline: false,
            fixedrange: true,
            automargin: true,
          },
          yaxis: {
            autorange: "reversed",
            tickfont: {
              size: 16,
              color: "#1F2937",
              family: "Montserrat, sans-serif",
            },
            showgrid: false,
            zeroline: false,
            fixedrange: true,
            automargin: true,
          },
          hoverlabel: {
            bgcolor: "rgba(17,24,39,0.94)",
            bordercolor: brand.primary,
            font: {
              family: "Montserrat, sans-serif",
              size: 13,
              color: "#FFFFFF",
            },
          },
        }}
        config={{
          displayModeBar: false,
          responsive: true,
        }}
        style={{ width: "100%", height: "100%" }}
        useResizeHandler
      />
    );
  }

  export function GroupedGeneroBarChart({ data, wrapLabel }: { data: unknown[]; wrapLabel: (s: string, maxLen?: number, maxLines?: number) => string }) {
    const brand = useResolvedBrandColors();
    const rows = (data as Array<Record<string, unknown>>)
      .map((item) => ({
        label: String(item.label || ""),
        Frecuencia: Number(item.Frecuencia || 0),
        Normalización: Number(item.Normalización || 0),
        Gravedad: Number(item.Gravedad || 0),
      }))
      .filter((item) => item.label);

    return (
      <Plot
        data={[
          {
            type: "bar",
            name: "Frecuencia",
            orientation: "h",
            x: rows.map((row) => row.Frecuencia),
            y: rows.map((row) => wrapLabel(row.label, 22, 2)),
            marker: {
              color: brand.primary,
            },
            hovertemplate: "<b>%{y}</b><br>Frecuencia: <b>%{x:.2f}</b><extra></extra>",
          } as any,
          {
            type: "bar",
            name: "Normalización",
            orientation: "h",
            x: rows.map((row) => row.Normalización),
            y: rows.map((row) => wrapLabel(row.label, 22, 2)),
            marker: {
              color: brand.secondary,
            },
            hovertemplate: "<b>%{y}</b><br>Normalización: <b>%{x:.2f}</b><extra></extra>",
          } as any,
          {
            type: "bar",
            name: "Gravedad",
            orientation: "h",
            x: rows.map((row) => row.Gravedad),
            y: rows.map((row) => wrapLabel(row.label, 22, 2)),
            marker: {
              color: mixColors(brand.support, brand.primary, 0.42),
            },
            hovertemplate: "<b>%{y}</b><br>Gravedad: <b>%{x:.2f}</b><extra></extra>",
          } as any,
        ]}
        layout={{
          autosize: true,
          barmode: "group",
          bargap: 0.26,
          bargroupgap: 0.14,
          margin: { t: 36, r: 80, b: 44, l: 230 },
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          xaxis: {
            range: [0, 5.25],
            tickvals: [0, 1, 2, 3, 4, 5],
            showgrid: true,
            gridcolor: withAlphaFromHex(brand.primary, 0.08),
            zeroline: false,
            fixedrange: true,
            title: {
              text: "Promedio (1-5)",
              font: axisFont("#64748B", 12),
            },
          },
          yaxis: {
            autorange: "reversed",
            showgrid: false,
            zeroline: false,
            fixedrange: true,
            tickfont: axisFont("#1F2937", 12),
          },
          legend: {
            orientation: "h",
            x: 0,
            y: 1.12,
            font: axisFont("#334155", 11),
          },
          hoverlabel: {
            bgcolor: "rgba(17,24,39,0.94)",
            bordercolor: brand.primary,
            font: axisFont("#FFFFFF", 13),
          },
        }}
        config={{
          displayModeBar: false,
          responsive: true,
        }}
        style={{ width: "100%", height: "100%" }}
        useResizeHandler
      />
    );
  }
