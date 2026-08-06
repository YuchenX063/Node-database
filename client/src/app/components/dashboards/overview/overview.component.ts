import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, of, EMPTY } from 'rxjs';
import { debounceTime, switchMap, tap, catchError } from 'rxjs/operators';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../../services/api.service';
import { MapVisComponent } from '../../common/map-vis/map-vis.component';
import { LegendEntry } from '../../common/map-vis/map-grouping';
import { spaceName } from '../../../pipes/space-name.pipe';
import {
  FilterState, Dim, Entity, emptyFilter, totalActive,
  FUNCTION_ORDER, FUNCTION_LABELS, functionColor
} from './overview-aggregate';

interface Bar {
  key: string;
  label: string;
  value: number;
  pct: number;       // 0-100, relative to the biggest bar in its panel
  color: string;
  selected: boolean;
}
interface YearBar {
  year: number;
  value: number;
  pct: number;
  selected: boolean;
  gapBefore: boolean;
}
interface Chip { dim: Dim; key: string; label: string; }

// "The Almanac at a Glance" — a coordinated-views ("god view") dashboard. Every
// panel both displays a breakdown and acts as a filter; clicking anything
// narrows every other panel. All aggregation runs SERVER-SIDE: the browser only
// posts the current filter state to /api/stats/overview and renders the small
// panel payload it gets back (no big corpus download).
@Component({
  selector: 'app-overview-dashboard',
  imports: [CommonModule, FormsModule, MatButtonToggleModule, MatIconModule, MapVisComponent],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewDashboardComponent implements OnInit, OnDestroy {
  loading = true;       // first load (full-panel placeholder)
  fetching = false;     // subsequent refreshes (subtle dim)
  error: string | null = null;
  note = '';

  entity: Entity = 'institutions';
  private filter: FilterState = emptyFilter();

  chips: Chip[] = [];
  functionBars: Bar[] = [];
  typeBars: Bar[] = [];
  dioceseBars: Bar[] = [];
  private dioceseNames: Record<string, string> = {};
  yearBars: YearBar[] = [];
  kpis = {
    institutions: 0, people: 0, dioceses: 0, states: 0,
    yearSpan: '—', topFunction: '—'
  };

  mapData: any[] = [];
  legend: LegendEntry[] = [];
  // Default to the (viewport-adaptive) heatmap for the density view; points stay
  // available via the in-map Display control. Click-to-filter works in any mode.
  mapOptions = {
    zoom: 3.5,
    mode: 'heatmap' as const,
    modeControl: true,
    center: { lat: 39, lng: -95 },
    size: { width: '100%', height: '520px' }
  };

  private refresh$ = new Subject<void>();
  private sub: Subscription | null = null;
  // Cache responses by request body so toggling a filter back is instant.
  private cache = new Map<string, any>();

  constructor(private _api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.sub = this.refresh$.pipe(
      debounceTime(90),                 // coalesce rapid clicks
      switchMap(() => {                 // cancel any in-flight request
        const body = this.requestBody();
        const ck = JSON.stringify(body);
        const hit = this.cache.get(ck);
        if (hit) return of(hit);
        this.fetching = true;
        this.cdr.markForCheck();
        return this._api.postTypeRequest('stats/overview', body).pipe(
          tap(r => this.cache.set(ck, r)),
          catchError(err => {
            this.error = err?.error?.message || 'Could not load the overview.';
            this.loading = false;
            this.fetching = false;
            this.cdr.markForCheck();
            return EMPTY;
          })
        );
      })
    ).subscribe(res => this.applyResponse(res));

    this.refresh$.next();   // initial load
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get activeCount(): number { return totalActive(this.filter); }
  get fnActive(): boolean { return this.filter.functions.size > 0; }
  get yearActive(): boolean { return this.filter.years.size > 0; }

  // --- Filter mutations: update state, reflect selection instantly, refetch ---

  toggleFunction(key: string): void { this.toggleStr('functions', key); }
  toggleType(key: string): void { this.toggleStr('types', key); }
  toggleDiocese(key: string): void { this.toggleStr('dioceses', key); }
  toggleYear(year: number): void {
    const set = this.filter.years;
    set.has(year) ? set.delete(year) : set.add(year);
    this.afterFilterChange();
  }
  onMapSelect(payload: { select?: string | null }): void {
    if (payload?.select) this.toggleDiocese(payload.select);
  }

  private toggleStr(dim: Exclude<Dim, 'years'>, key: string): void {
    const set = this.filter[dim];
    set.has(key) ? set.delete(key) : set.add(key);
    this.afterFilterChange();
  }

  removeChip(chip: Chip): void {
    if (chip.dim === 'years') this.filter.years.delete(Number(chip.key));
    else (this.filter[chip.dim] as Set<string>).delete(chip.key);
    this.afterFilterChange();
  }

  clearAll(): void {
    this.filter = emptyFilter();
    this.afterFilterChange();
  }

  onEntityChange(): void {
    this.afterFilterChange();
  }

  // Reflect selection/chips immediately (client-side), then ask the server for
  // refreshed counts. Gives instant feedback even while the request is in flight.
  private afterFilterChange(): void {
    this.markSelectionUI();
    this.refresh$.next();
  }

  private markSelectionUI(): void {
    const mark = (bars: Bar[], set: Set<string>) => bars.forEach(b => b.selected = set.has(b.key));
    mark(this.functionBars, this.filter.functions);
    mark(this.typeBars, this.filter.types);
    mark(this.dioceseBars, this.filter.dioceses);
    this.yearBars.forEach(b => b.selected = this.filter.years.has(b.year));
    this.buildChips();
    this.cdr.markForCheck();
  }

  // --- Request / response ---

  private requestBody(): any {
    return {
      entity: this.entity,
      years: Array.from(this.filter.years),
      functions: Array.from(this.filter.functions),
      types: Array.from(this.filter.types),
      dioceses: Array.from(this.filter.dioceses)
    };
  }

  private applyResponse(res: any): void {
    if (!res) return;
    this.loading = false;
    this.fetching = false;
    this.error = null;
    this.note = res.meta?.note ?? this.note;
    if (res.meta?.dioceseNames) this.dioceseNames = res.meta.dioceseNames;

    this.functionBars = this.toBars(res.functions, this.filter.functions, k => FUNCTION_LABELS[k] ?? k, k => functionColor(k));
    this.typeBars = this.toBars(res.types, this.filter.types, k => this.titleCase(k), () => '#5c6bc0');
    this.dioceseBars = this.toBars(res.dioceses, this.filter.dioceses, k => this.dioceseName(k), () => '#26a69a');

    const ys = (res.years ?? []) as { year: number; value: number }[];
    const ymax = Math.max(1, ...ys.map(y => y.value));
    this.yearBars = ys.map((y, idx) => ({
      year: y.year,
      value: y.value,
      pct: (y.value / ymax) * 100,
      selected: this.filter.years.has(y.year),
      gapBefore: idx > 0 && y.year - ys[idx - 1].year > 3
    }));

    const k = res.kpis ?? {};
    this.kpis = {
      institutions: k.institutions ?? 0,
      people: k.people ?? 0,
      dioceses: k.dioceses ?? 0,
      states: k.states ?? 0,
      yearSpan: k.yearMin == null ? '—' : (k.yearMin === k.yearMax ? `${k.yearMin}` : `${k.yearMin}–${k.yearMax}`),
      topFunction: k.topFunction ? (FUNCTION_LABELS[k.topFunction] ?? k.topFunction) : '—'
    };

    const present = new Set<string>();
    this.mapData = (res.map ?? []).map((c: any) => {
      present.add(c.f);
      return {
        latitude: c.lat,
        longitude: c.lng,
        title: this.dioceseName(c.d),
        select: c.d,                 // click filters to this location's diocese (canonical id)
        options: {
          color: functionColor(c.f),
          value: c.v,
          radius: Math.min(4 + Math.sqrt(c.v) * 2, 16)
        }
      };
    });
    this.legend = FUNCTION_ORDER
      .filter(x => present.has(x))
      .map(x => ({ label: FUNCTION_LABELS[x] ?? x, color: functionColor(x) }));

    this.buildChips();
    this.cdr.markForCheck();
  }

  // Map a server [{key,value}] panel into rendered bars (label/colour/pct/selected).
  private toBars(
    rows: { key: string; value: number }[] = [],
    selected: Set<string>,
    labelOf: (k: string) => string,
    colorOf: (k: string) => string
  ): Bar[] {
    const max = Math.max(1, ...rows.map(r => r.value));
    return rows.map(r => ({
      key: r.key,
      label: labelOf(r.key),
      value: r.value,
      pct: (r.value / max) * 100,
      color: colorOf(r.key),
      selected: selected.has(r.key)
    }));
  }

  private buildChips(): void {
    const chips: Chip[] = [];
    for (const f of this.filter.functions) chips.push({ dim: 'functions', key: f, label: FUNCTION_LABELS[f] ?? f });
    for (const t of this.filter.types) chips.push({ dim: 'types', key: t, label: this.titleCase(t) });
    for (const d of this.filter.dioceses) chips.push({ dim: 'dioceses', key: d, label: this.dioceseName(d) });
    for (const y of Array.from(this.filter.years).sort((a, b) => a - b)) {
      chips.push({ dim: 'years', key: String(y), label: String(y) });
    }
    this.chips = chips;
  }

  private titleCase(value: string): string {
    return spaceName(value).replace(/\b\w/g, c => c.toUpperCase());
  }

  // Canonical diocese id -> display name (from the server), with a graceful fallback.
  private dioceseName(key: string): string {
    return this.dioceseNames[key] || spaceName(key);
  }
}
