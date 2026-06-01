export interface ScalePreset {
  label: string;
  description: string;
  feetPerInch?: number;  // real feet represented by 1 drawing inch
  ratio?: number;        // metric 1:N
  custom?: boolean;
  none?: boolean;
}

export const SCALE_PRESETS: ScalePreset[] = [
  { label: 'No Scale', description: 'No scale applied', none: true },
  // ── Architectural (large detail → small) ─────────────────────────
  { label: "3\" = 1'-0\"",      description: 'Complex waterproofing, roof edge flashing & expansion joints', feetPerInch: 1/3   },
  { label: "1½\" = 1'-0\"",     description: 'Door/window jambs, heads, sills & storefront framing',         feetPerInch: 2/3   },
  { label: "1\" = 1'-0\"",      description: 'Enlarged plan details, column wraps & corner assemblies',       feetPerInch: 1     },
  { label: "¾\" = 1'-0\"",      description: 'Multi-material exterior wall sections & millwork elevations',   feetPerInch: 4/3   },
  { label: "½\" = 1'-0\"",      description: 'Full wall sections, egress stairs & restroom layouts',          feetPerInch: 2     },
  { label: "⅜\" = 1'-0\"",      description: 'Common for tight structural-architectural building sections',   feetPerInch: 8/3   },
  { label: "¼\" = 1'-0\"",      description: 'Standard for small tenant floor plans, sections & elevations',  feetPerInch: 4     },
  { label: "3⁄16\" = 1'-0\"",   description: 'Used for overall building footprints & site plans',             feetPerInch: 16/3  },
  { label: "⅛\" = 1'-0\"",      description: 'Baseline standard for main commercial floor, finish & roof',    feetPerInch: 8     },
  { label: "3⁄32\" = 1'-0\"",   description: 'Imperial scale for massive footprint key plans & sector maps',  feetPerInch: 32/3  },
  { label: "1⁄16\" = 1'-0\"",   description: 'Overall building footprints, site plans & life safety maps',    feetPerInch: 16    },
  { label: "1⁄32\" = 1'-0\"",   description: 'Massive footprint key plans & sector maps',                     feetPerInch: 32    },
  // ── Civil / Engineering ──────────────────────────────────────────
  { label: "1\" = 10'",         description: 'Complex, dense utility ties or tight urban property layouts',   feetPerInch: 10    },
  { label: "1\" = 20'",         description: 'Standard for primary commercial site plans and grading',        feetPerInch: 20    },
  { label: "1\" = 30'",         description: 'Medium-sized retail strips or office parks',                    feetPerInch: 30    },
  { label: "1\" = 40'",         description: 'Large retail centers or industrial warehouse sites',            feetPerInch: 40    },
  { label: "1\" = 50'",         description: 'Master grading plans and general site layouts',                 feetPerInch: 50    },
  // ── Metric ───────────────────────────────────────────────────────
  { label: '1:25',               description: 'Metric — detailed sections and interior assemblies',            ratio: 25          },
  { label: '1:50',               description: 'Metric — enlarged room layouts & main building sections',       ratio: 50          },
  { label: '1:100',              description: 'Metric — standard commercial floor layouts & elevations',       ratio: 100         },
  // ── Custom ───────────────────────────────────────────────────────
  { label: 'Custom',             description: 'Enter your own scale manually',                                 custom: true       },
];

/** Real feet per 1 drawing inch for the given preset (for Quick Apply). */
export function getFeetPerInch(preset: ScalePreset): number | null {
  if (preset.none || preset.custom) return null;
  if (preset.feetPerInch !== undefined) return preset.feetPerInch;
  if (preset.ratio !== undefined) {
    // 1:N — 1mm paper = N mm real → 1 inch paper = N*25.4mm real = N*25.4/304.8 ft
    return (preset.ratio * 25.4) / 304.8;
  }
  return null;
}

/** Pre-fill distance/unit for ScaleModal when a preset is selected. */
export function getPresetDisplayDistance(preset: ScalePreset): { distance: string; unit: 'feet' | 'inches' | 'meters' } | null {
  if (preset.none || preset.custom) return null;
  if (preset.feetPerInch !== undefined) {
    return { distance: String(+(preset.feetPerInch).toFixed(6)), unit: 'feet' };
  }
  if (preset.ratio !== undefined) {
    // express as "1 mm = N mm" → N mm in meters = N/1000
    return { distance: String(preset.ratio / 1000), unit: 'meters' };
  }
  return null;
}
