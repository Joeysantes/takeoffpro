export interface ScalePreset {
  label: string;
  // feetPerInch: how many real feet per drawing inch (architectural / engineering)
  feetPerInch?: number;
  // ratio: 1:N metric ratio
  ratio?: number;
  // custom: user enters own value
  custom?: boolean;
  // null means no scale
  none?: boolean;
}

export const SCALE_PRESETS: ScalePreset[] = [
  { label: 'No Scale', none: true },
  // ── Architectural ──────────────────────────────
  { label: "3/32\" = 1'",  feetPerInch: 128 },
  { label: "1/8\" = 1'",   feetPerInch: 96  },
  { label: "3/16\" = 1'",  feetPerInch: 64  },
  { label: "1/4\" = 1'",   feetPerInch: 48  },
  { label: "3/8\" = 1'",   feetPerInch: 32  },
  { label: "1/2\" = 1'",   feetPerInch: 24  },
  { label: "3/4\" = 1'",   feetPerInch: 16  },
  { label: "1\" = 1'",     feetPerInch: 12  },
  { label: "1-1/2\" = 1'", feetPerInch: 8   },
  { label: "3\" = 1'",     feetPerInch: 4   },
  // ── Engineering ───────────────────────────────
  { label: "1\" = 10'",    feetPerInch: 10  },
  { label: "1\" = 20'",    feetPerInch: 20  },
  { label: "1\" = 30'",    feetPerInch: 30  },
  { label: "1\" = 40'",    feetPerInch: 40  },
  { label: "1\" = 50'",    feetPerInch: 50  },
  { label: "1\" = 60'",    feetPerInch: 60  },
  { label: "1\" = 100'",   feetPerInch: 100 },
  // ── Metric ────────────────────────────────────
  { label: '1:20',  ratio: 20  },
  { label: '1:25',  ratio: 25  },
  { label: '1:50',  ratio: 50  },
  { label: '1:75',  ratio: 75  },
  { label: '1:100', ratio: 100 },
  { label: '1:125', ratio: 125 },
  { label: '1:200', ratio: 200 },
  { label: '1:500', ratio: 500 },
  // ── Other ─────────────────────────────────────
  { label: 'Custom', custom: true },
];

/**
 * Given a preset and a pixel distance, compute pixelsPerFoot.
 * Returns null if the preset is No Scale or Custom (needs user input).
 * For calibration-based flow, pass pixelDist = measured pixel span.
 * For preset-only (no calibration), we can't compute pixelsPerFoot without a reference.
 * This helper returns the nominal feet that 1 drawing-inch represents.
 */
export function presetToFeetPerDrawingInch(preset: ScalePreset): number | null {
  if (preset.none || preset.custom) return null;
  if (preset.feetPerInch !== undefined) return preset.feetPerInch;
  if (preset.ratio !== undefined) {
    // 1:N ratio — 1 mm on paper = N mm real → in feet: N mm / 304.8 mm/ft
    return preset.ratio / 304.8;
  }
  return null;
}
