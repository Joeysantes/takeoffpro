export interface ScalePreset {
  label: string;
  description: string;
  feetPerInch?: number;  // real feet per 1 drawing inch (imperial/civil)
  ratio?: number;        // metric 1:N ratio
  custom?: boolean;
  none?: boolean;
}

export const SCALE_PRESETS: ScalePreset[] = [
  { label: 'No Scale', description: 'No scale applied', none: true },
  // ── Civil / Large Site ────────────────────────────────────────────
  { label: "1\" = 100'",       description: 'Civil — vicinity maps & large property lines',       feetPerInch: 100 },
  { label: "1\" = 60'",        description: 'Civil — large commercial campus master layouts',      feetPerInch: 60  },
  { label: "1\" = 50'",        description: 'Civil — master grading & general site layouts',       feetPerInch: 50  },
  { label: "1\" = 40'",        description: 'Civil — large retail centers & industrial sites',     feetPerInch: 40  },
  { label: "1\" = 30'",        description: 'Civil — medium retail strips & office parks',         feetPerInch: 30  },
  { label: "1\" = 20'",        description: 'Civil — primary commercial site plans & grading',     feetPerInch: 20  },
  // ── Metric ────────────────────────────────────────────────────────
  { label: '1:200',             description: 'Metric — massive master site plans & building contexts', ratio: 200 },
  // ── Imperial — Small ──────────────────────────────────────────────
  { label: "1/32\" = 1'-0\"",  description: 'Imperial — massive footprint key plans & sector maps', feetPerInch: 32 },
  { label: "1\" = 10'",        description: 'Civil — dense utility ties & tight urban property',   feetPerInch: 10  },
  // ── Metric ────────────────────────────────────────────────────────
  { label: '1:100',             description: 'Metric — standard commercial floor plans & elevations', ratio: 100 },
  // ── Imperial ──────────────────────────────────────────────────────
  { label: "1/16\" = 1'-0\"",  description: 'Imperial — overall building footprints & life safety maps', feetPerInch: 16 },
  // ── Metric ────────────────────────────────────────────────────────
  { label: '1:50',              description: 'Metric — enlarged room layouts & main building sections', ratio: 50 },
  // ── Imperial ──────────────────────────────────────────────────────
  { label: "1/8\" = 1'-0\"",   description: 'Imperial — standard commercial floor, finish & roof plans', feetPerInch: 8  },
  { label: "1/4\" = 1'-0\"",   description: 'Imperial — small tenant floor plans, sections & elevations', feetPerInch: 4  },
  { label: "3/8\" = 1'-0\"",   description: 'Imperial — tight structural-architectural sections',   feetPerInch: 8/3 },
  { label: "1/2\" = 1'-0\"",   description: 'Imperial — wall sections, egress stairs & restrooms',  feetPerInch: 2  },
  // ── Metric ────────────────────────────────────────────────────────
  { label: '1:20',              description: 'Metric — highly detailed sections & interior assemblies', ratio: 20 },
  // ── Imperial ──────────────────────────────────────────────────────
  { label: "3/4\" = 1'-0\"",   description: 'Imperial — exterior wall sections & millwork elevations', feetPerInch: 4/3 },
  { label: "1\" = 1'-0\"",     description: 'Imperial — enlarged plan details & column assemblies', feetPerInch: 1  },
  // ── Metric ────────────────────────────────────────────────────────
  { label: '1:10',              description: 'Metric — component detailing & structural connections', ratio: 10 },
  // ── Imperial ──────────────────────────────────────────────────────
  { label: "1-1/2\" = 1'-0\"", description: 'Imperial — door/window jambs, heads, sills & storefront', feetPerInch: 2/3 },
  { label: "3\" = 1'-0\"",     description: 'Imperial — waterproofing, roof edge flashing & expansion joints', feetPerInch: 1/3 },
  // ── Metric ────────────────────────────────────────────────────────
  { label: '1:2',               description: 'Metric — extreme detail, nearly half-size of object',  ratio: 2  },
  { label: '1:1',               description: 'Metric — full scale for exact manufacturing profiles',  ratio: 1  },
  // ── Full Scale ────────────────────────────────────────────────────
  { label: "Full Scale (1\" = 1\")", description: 'Imperial — custom millwork profiles & trim shapes', feetPerInch: 1/12 },
  // ── Custom ────────────────────────────────────────────────────────
  { label: 'Custom',            description: 'Enter your own scale manually', custom: true },
];

/**
 * Compute real feet per drawing inch for a given preset.
 * Used for Quick Apply (pixelsPerFoot = renderDPI / feetPerInch).
 */
export function getFeetPerInch(preset: ScalePreset): number | null {
  if (preset.none || preset.custom) return null;
  if (preset.feetPerInch !== undefined) return preset.feetPerInch;
  if (preset.ratio !== undefined) {
    // 1:N ratio — 1mm paper = N mm real
    // 1 inch = 25.4mm → at scale 1:N, 1 inch on paper = N * 25.4mm real = N * 25.4 / 304.8 feet
    return (preset.ratio * 25.4) / 304.8;
  }
  return null;
}

/** Pre-fill display value for ScaleModal distance input */
export function getPresetDisplayDistance(preset: ScalePreset): { distance: string; unit: 'feet' | 'inches' | 'meters' } | null {
  if (preset.none || preset.custom) return null;
  if (preset.feetPerInch !== undefined) {
    return { distance: String(preset.feetPerInch), unit: 'feet' };
  }
  if (preset.ratio !== undefined) {
    return { distance: String(preset.ratio / 1000), unit: 'meters' };
  }
  return null;
}
