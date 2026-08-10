import {
  Component, OnInit, OnDestroy, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { ApiService } from '../../../services/api.service';
import { MapVisComponent } from '../../common/map-vis/map-vis.component';

// Sequential 5-step colour ramp (light -> dark), shared by the grid and the map.
const RAMP = ['#bdd7e7', '#6baed6', '#3182bd', '#08519c', '#08306b'];
const EMPTY_COLOR = 'rgba(127,127,127,0.10)';

type CellState = 'data' | 'empty' | 'absent';
interface CovCell { year: number; n: number; level: number; state: CellState; nameThatYear?: string; error?: string; gapBefore: boolean; civilWarBefore: boolean; }
interface CovRow { key: string; name: string; total: number; span: string; cells: CovCell[]; }
interface HeaderYear { year: number; gapBefore: boolean; civilWarBefore: boolean; }

// "Coverage — the shape of the data": a GitHub-contribution-style diocese x year
// grid (how thoroughly each see was recorded, year by year) beside a binned
// heatmap of where records concentrate (rendered by map-vis' reusable grid mode).
// Colour is on a sqrt scale so dense cities don't flatten the rest.
@Component({
  selector: 'app-coverage',
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatSelectModule, MatTooltipModule, MapVisComponent],
  templateUrl: './coverage.component.html',
  styleUrl: './coverage.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoverageComponent implements OnInit, OnDestroy {
  @ViewChild(MapVisComponent) private mapVis?: MapVisComponent;

  loading = true;
  error: string | null = null;
  note = '';

  headerYears: HeaderYear[] = [];
  rows: CovRow[] = [];
  ramp = RAMP;
  emptyColor = EMPTY_COLOR;

  // 1862-63: the Catholic Almanac was not published during the Civil War, so
  // those years are absent from the data entirely. They aren't columns — a pink
  // band marks the break between 1861 and 1864, with this note as its tooltip.
  readonly civilWarNote =
    'The Catholic Almanac was not published in 1862–1863, during the Civil War, ' +
    'so records for these years are absent or highly disrupted.';

  years: number[] = [];
  selectedYear: number | 'all' = 'all';
  selectedDiocese: string | null = null;
  private dioceseKeys: string[] = [];
  private dioceseNames = new Map<string, string>();

  mapData: any[] = [];
  mapOptions = {
    zoom: 3.4,
    mode: 'bins' as const,
    modeControl: false,
    center: { lat: 39, lng: -95 },
    modeOptions: { bins: { size: 0.5, ramp: RAMP, opacity: 0.85 } },
    size: { width: '100%', height: '560px' }
  };

  // [lat, lng, year, n, dioceseIndex]
  private allPoints: [number, number, number, number, number][] = [];
  private sub: Subscription | null = null;

  constructor(private _api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.sub = this._api.getTypeRequest('stats/coverage').subscribe({
      next: (res: any) => this.applyData(res),
      error: (err: any) => {
        this.error = err?.error?.message || 'Could not load coverage data.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private applyData(res: any): void {
    const years: number[] = res.years ?? [];
    this.years = years;
    const gapAt = (i: number) => i > 0 && years[i] - years[i - 1] > 3;
    // The 1862-63 Civil War break: the columns straddling those missing years.
    const civilWarAt = (i: number) => i > 0 && years[i - 1] < 1862 && years[i] > 1863;
    const maxCell = res.maxCell || 1;

    this.headerYears = years.map((y, i) => ({ year: y, gapBefore: gapAt(i), civilWarBefore: civilWarAt(i) }));
    this.rows = (res.dioceses ?? []).map((d: any) => {
      const exists = new Set<number>(d.existYears ?? years);   // missing timeline => all years
      return {
        key: d.key,
        name: d.name || d.key,
        total: d.total,
        span: d.firstYear == null ? '—' : (d.firstYear === d.lastYear ? `${d.firstYear}` : `${d.firstYear}–${d.lastYear}`),
        cells: years.map((y, i) => {
          const n = d.years?.[y] || 0;
          const state: CellState = !exists.has(y) ? 'absent' : (n > 0 ? 'data' : 'empty');
          return {
            year: y, n, state,
            level: state === 'data' ? this.level(n, maxCell) : 0,
            nameThatYear: d.namesByYear?.[y],
            error: d.errorYears?.[y],
            gapBefore: gapAt(i),
            civilWarBefore: civilWarAt(i)
          };
        })
      };
    });
    this.dioceseKeys = this.rows.map(r => r.key);
    this.dioceseNames = new Map(this.rows.map(r => [r.key, r.name]));

    this.allPoints = res.points ?? [];
    this.buildMapData();

    this.note = res.note ?? '';
    this.loading = false;
    this.cdr.markForCheck();
  }

  // Feed map-vis the points for the current year + diocese selection; it bins
  // them into the zoomable grid. point = [lat, lng, year, n, dioceseIndex].
  private buildMapData(): void {
    const di = this.selectedDiocese ? this.dioceseKeys.indexOf(this.selectedDiocese) : -1;
    let pts = this.allPoints;
    if (this.selectedYear !== 'all') pts = pts.filter(p => p[2] === this.selectedYear);
    if (di >= 0) pts = pts.filter(p => p[4] === di);
    this.mapData = pts.map(p => ({ latitude: p[0], longitude: p[1], options: { value: p[3] } }));
  }

  onYearChange(): void {
    this.buildMapData();
    this.cdr.markForCheck();
  }

  // --- Gantt cells drive the map ---

  /** Click a year column → set the map to that year (toggle off to all). */
  pickYear(year: number): void {
    this.selectedYear = this.selectedYear === year ? 'all' : year;
    this.buildMapData();
    this.cdr.markForCheck();
  }

  /** Click a diocese row → limit the map to that diocese (toggle off). */
  pickDiocese(key: string): void {
    this.selectedDiocese = this.selectedDiocese === key ? null : key;
    this.buildMapData();
    this.cdr.markForCheck();
    this.focusMap();
  }

  /** Click a cell → focus that diocese in that year. */
  pickCell(key: string, year: number): void {
    const same = this.selectedDiocese === key && this.selectedYear === year;
    this.selectedDiocese = same ? null : key;
    this.selectedYear = same ? 'all' : year;
    this.buildMapData();
    this.cdr.markForCheck();
    this.focusMap();
  }

  // Zoom the map to the current selection's points — or back to the continental
  // US when no diocese is selected. Computed here so it doesn't depend on the
  // map's @Input having propagated yet.
  private focusMap(): void {
    if (!this.selectedDiocese) {
      this.mapVis?.fitToBounds([-125, 24, -66, 50]);   // continental US
      return;
    }
    let w = Infinity, e = -Infinity, s = Infinity, n = -Infinity;
    for (const m of this.mapData) {
      const lat = m.latitude, lng = m.longitude;
      if (!lat || !lng || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;  // skip null-island
      if (lng < w) w = lng; if (lng > e) e = lng;
      if (lat < s) s = lat; if (lat > n) n = lat;
    }
    if (w !== Infinity) this.mapVis?.fitToBounds([w, s, e, n]);
  }

  isYearSel(year: number): boolean { return this.selectedYear === year; }
  isDioceseSel(key: string): boolean { return this.selectedDiocese === key; }

  get selectedDioceseLabel(): string {
    return this.selectedDiocese ? (this.dioceseNames.get(this.selectedDiocese) || this.selectedDiocese) : '';
  }

  clearDiocese(): void {
    this.selectedDiocese = null;
    this.buildMapData();
    this.cdr.markForCheck();
    this.focusMap();
  }

  // sqrt scale -> level 0 (empty) or 1..N, so mid-range coverage stays visible.
  private level(n: number, max: number): number {
    if (!n) return 0;
    const r = Math.sqrt(n) / Math.sqrt(max);
    return Math.min(RAMP.length, Math.max(1, Math.ceil(r * RAMP.length)));
  }

  // Background for a cell; absent cells get no fill (a CSS hatch shows instead)
  // and error cells get none either (the .cov-error class paints them pink).
  cellColor(c: CovCell): string {
    if (c.state === 'absent' || c.error) return '';
    return c.state === 'data' ? RAMP[c.level - 1] : EMPTY_COLOR;
  }

  cellTitle(row: CovRow, c: CovCell): string {
    if (c.error) return `${row.name} · ${c.year} — ${c.error}`;
    if (c.state === 'absent') return `${row.name} · ${c.year} — did not exist`;
    const alias = c.nameThatYear && c.nameThatYear !== row.name ? ` (recorded as “${c.nameThatYear}”)` : '';
    return c.n
      ? `${row.name} · ${c.year} — ${c.n} institution${c.n === 1 ? '' : 's'}${alias}`
      : `${row.name} · ${c.year} — no records yet${alias}`;
  }
}
