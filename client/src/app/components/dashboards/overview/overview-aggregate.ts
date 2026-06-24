// Shared types + display metadata for the Overview dashboard. The heavy
// aggregation now runs server-side (POST /api/stats/overview); the client only
// holds the filter state and maps the returned keys to labels/colours.

import { FUNCTION_COLORS, OTHER_COLOR } from '../../common/map-vis/map-grouping';

// Count distinct institutions, or distinct people serving them.
export type Entity = 'institutions' | 'people';

// The four cross-filter dimensions. Every dimension is a Set so the model is
// uniform: empty set = "no constraint on this dimension".
export type Dim = 'years' | 'functions' | 'types' | 'dioceses';

export interface FilterState {
  years: Set<number>;
  functions: Set<string>;
  types: Set<string>;
  dioceses: Set<string>;
}

export function emptyFilter(): FilterState {
  return { years: new Set(), functions: new Set(), types: new Set(), dioceses: new Set() };
}

export function totalActive(s: FilterState): number {
  return s.years.size + s.functions.size + s.types.size + s.dioceses.size;
}

// --- Function display metadata (long server keys -> short readable labels) ---

export const FUNCTION_ORDER = [
  'religious institutions',
  'educational institutions',
  'consecrated life institutions',
  'charitable institutions',
  'healthcare institutions',
  'other'
];

export const FUNCTION_LABELS: Record<string, string> = {
  'religious institutions': 'Religious',
  'educational institutions': 'Educational',
  'consecrated life institutions': 'Consecrated life',
  'charitable institutions': 'Charitable',
  'healthcare institutions': 'Healthcare',
  'other': 'Other / unspecified'
};

export function functionColor(key: string): string {
  return FUNCTION_COLORS[key] || OTHER_COLOR;
}
