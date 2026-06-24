// Shared colour-grouping + legend logic for the MapLibre maps. Given a set of
// data points and a field to "colour by", this produces a stable colour for
// each category and a legend describing them. Used by the browse maps and the
// map dashboards so colours/legends stay consistent across the app.

import { spaceName } from '../../../pipes/space-name.pipe';

export interface LegendEntry {
  label: string;
  color: string;
}

export interface Grouping {
  /** Colour for a given raw field value. */
  colorFor: (raw: string | null | undefined) => string;
  /** Legend entries for the categories actually present, ready to render. */
  legend: LegendEntry[];
}

// The five canonical institution functions get fixed, meaningful colours so the
// same function always reads the same on every map. Mirrors the server buckets.
export const FUNCTION_COLORS: Record<string, string> = {
  'religious institutions': '#377eb8',        // blue
  'educational institutions': '#984ea3',      // purple
  'consecrated life institutions': '#e41a1c', // red
  'charitable institutions': '#ff7f00',       // orange
  'healthcare institutions': '#4daf4a'        // green
};
export const OTHER_COLOR = '#9e9e9e';
const OTHER_LABEL = 'other / unspecified';

// A wide qualitative palette for open-ended categories (type, diocese, …).
export const PALETTE = [
  '#1976d2', '#388e3c', '#fbc02d', '#d32f2f', '#7b1fa2', '#0288d1', '#c2185b',
  '#ffa000', '#455a64', '#f57c00', '#0097a7', '#afb42b', '#5d4037', '#00897b',
  '#6d4c41', '#303f9f', '#7e57c2', '#43a047', '#d84315', '#8e24aa', '#cddc39',
  '#ffb300', '#e64a19', '#009688', '#607d8b', '#c0ca33', '#3949ab', '#00acc1'
];

/** Bucket a (possibly compound) instFunction string to its primary function. */
export function primaryFunction(raw: string | null | undefined): string {
  if (!raw) return OTHER_LABEL;
  const first = String(raw).split(/\s+and\s+/i)[0].trim().toLowerCase();
  return FUNCTION_COLORS[first] ? first : OTHER_LABEL;
}

/** Title-case a raw category for display in the legend. */
function titleCase(value: string): string {
  return value.replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Build a colour function + legend for a list of raw category values.
 *
 * @param rawValues every point's value for the active "colour by" field
 * @param mode      'function' uses the fixed function palette + bucketing;
 *                  'categorical' assigns palette colours to distinct values.
 */
export function buildGrouping(
  rawValues: (string | null | undefined)[],
  mode: 'function' | 'categorical'
): Grouping {
  if (mode === 'function') {
    const present = new Set(rawValues.map(primaryFunction));
    const legend: LegendEntry[] = [];
    for (const key of Object.keys(FUNCTION_COLORS)) {
      if (present.has(key)) legend.push({ label: titleCase(key), color: FUNCTION_COLORS[key] });
    }
    if (present.has(OTHER_LABEL)) legend.push({ label: OTHER_LABEL, color: OTHER_COLOR });
    return {
      colorFor: raw => {
        const bucket = primaryFunction(raw);
        return FUNCTION_COLORS[bucket] || OTHER_COLOR;
      },
      legend
    };
  }

  // Categorical: assign palette colours to distinct values, sorted for a stable
  // ordering, so the same category keeps its colour as the data changes.
  const distinct = Array.from(
    new Set(rawValues.map(v => (v == null || v === '' ? OTHER_LABEL : String(v))))
  ).sort((a, b) => a.localeCompare(b));
  const colorMap: Record<string, string> = {};
  distinct.forEach((value, i) => {
    colorMap[value] = value === OTHER_LABEL ? OTHER_COLOR : PALETTE[i % PALETTE.length];
  });
  const legend: LegendEntry[] = distinct.map(value => ({
    // spaceName splits run-together names (e.g. NewYorkCity -> New York City).
    label: value === OTHER_LABEL ? OTHER_LABEL : titleCase(spaceName(value)),
    color: colorMap[value]
  }));
  return {
    colorFor: raw => colorMap[raw == null || raw === '' ? OTHER_LABEL : String(raw)] || OTHER_COLOR,
    legend
  };
}
