"use client";

import type { CSSProperties } from "react";
import { Pipette } from "lucide-react";

import { normalizeBrandColor } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type BrandColorFieldProps = {
  id: string;
  label: string;
  value: string;
  resolvedColor: string;
  placeholder?: string;
  hint?: string;
  onChange: (value: string) => void;
};

const QUICK_SWATCHES = [
  "#0C396A",
  "#33C8C2",
  "#E2E8F0",
  "#7F017F",
  "#C23C9A",
  "#1F2937",
];

export function BrandColorField({
  id,
  label,
  value,
  resolvedColor,
  placeholder,
  hint,
  onChange,
}: BrandColorFieldProps) {
  const fieldStyle = {
    "--ring": resolvedColor,
    "--input": resolvedColor,
  } as CSSProperties;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-3">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-12 w-14 shrink-0 rounded-xl border-neutral-300 bg-white p-1"
              aria-label={`Seleccionar ${label.toLowerCase()}`}
            >
              <span
                className="block h-full w-full rounded-lg border border-neutral-300"
                style={{ backgroundColor: resolvedColor }}
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 rounded-2xl border-neutral-200 p-4">
            <div className="grid gap-4">
              <div>
                <p className="text-sm font-semibold text-neutral-900">{label}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Selecciona un color visualmente o escribe el valor hexadecimal.
                </p>
              </div>

              <div className="grid gap-3">
                <input
                  type="color"
                  value={resolvedColor}
                  className="h-28 w-full cursor-pointer rounded-2xl border border-neutral-200 bg-white p-2"
                  onChange={(e) => onChange(normalizeBrandColor(e.target.value))}
                />

                <div className="grid gap-2">
                  <Label htmlFor={`${id}-hex`} className="text-xs text-neutral-600">
                    Valor HEX
                  </Label>
                  <div className="flex items-center gap-2">
                    <div
                      className="grid h-10 w-10 place-items-center rounded-xl border border-neutral-200"
                      style={{ backgroundColor: resolvedColor }}
                    >
                      <Pipette className="h-4 w-4 text-white/90" />
                    </div>
                    <Input
                      id={`${id}-hex`}
                      style={fieldStyle}
                      value={value}
                      onChange={(e) => onChange(e.target.value.toUpperCase())}
                      placeholder={placeholder}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <p className="text-xs font-medium text-neutral-600">Sugerencias rápidas</p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_SWATCHES.map((swatch) => (
                      <button
                        key={`${id}-${swatch}`}
                        type="button"
                        className="h-8 w-8 rounded-full border border-white shadow-sm ring-1 ring-neutral-200 transition hover:scale-105"
                        style={{ backgroundColor: swatch }}
                        onClick={() => onChange(swatch)}
                        aria-label={`Usar color ${swatch}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Input
          id={id}
          style={fieldStyle}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder={placeholder}
        />
      </div>

      {hint ? <p className="text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}
