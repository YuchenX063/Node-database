import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SpaceNamePipe, spaceName } from '../../../pipes/space-name.pipe';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subscription } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import * as d3 from 'd3';
import { ApiService } from '../../../services/api.service';

interface CompositionRow {
  year: number;
  group: string;
  count: number;
  total: number;
  share: number;
}
interface CompositionData {
  rows: CompositionRow[];
  years: number[];
}
interface Scope {
  kind: 'national' | 'diocese' | 'state';
  place: string;   // diocese name or state abbr; ignored for national
  year: number;
  color: string;
}

@Component({
  selector: 'app-people-comparison-dashboard',
  imports: [
    SpaceNamePipe,
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule
  ],
  templateUrl: './people-comparison.component.html',
  styleUrl: './people-comparison.component.scss'
})
export class PeopleComparisonDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chart', { static: false }) chartRef!: ElementRef<HTMLDivElement>;

  loading = true;
  error: string | null = null;
  mode: 'count' | 'share' = 'count';

  years: number[] = [];
  dioceseOptions: string[] = [];
  usStates = US_STATES;
  readonly maxScopes = 4;

  scopes: Scope[] = [];

  private readonly scopeColors = ['#2f6f9f', '#d98a2b', '#3f9e7a', '#9b4f9e'];
  private cache = new Map<string, CompositionData>();
  private viewInitialized = false;
  private subs: Subscription[] = [];
  private resizeObserver?: ResizeObserver;
  private lastRenderWidth = 0;

  private readonly buckets = [
    'religious institutions', 'educational institutions', 'consecrated life institutions',
    'charitable institutions', 'healthcare institutions', 'other'
  ];
  // People-framed labels for the function of the institution each person served
  private readonly labels: Record<string, string> = {
    'religious institutions': 'Parishes & missions',
    'educational institutions': 'Educational',
    'consecrated life institutions': 'Consecrated life',
    'charitable institutions': 'Charitable',
    'healthcare institutions': 'Healthcare',
    'other': 'Other'
  };

  constructor(private _api: ApiService, private _http: HttpClient) {}

  ngOnInit(): void {
    this._http.get('diocese.csv', { responseType: 'text' }).subscribe({
      next: data => this.dioceseOptions = data.split('\n')
        .map(l => l.replace(/﻿/g, '').trim()).filter(l => l.length > 0),
      error: () => this.dioceseOptions = []
    });

    // Fetch national once to learn the available years, then seed a default
    // "established vs. frontier, same year" comparison that tells the story.
    this.subs.push(this._api.getTypeRequest('stats/composition?entity=people').subscribe({
      next: (res: any) => {
        this.cache.set('national', { rows: res.rows ?? [], years: res.meta?.years ?? [] });
        this.years = res.meta?.years ?? [];
        this.scopes = [
          { kind: 'diocese', place: 'NewYorkCity', year: 1864, color: this.scopeColors[0] },
          { kind: 'diocese', place: 'Dubuque', year: 1864, color: this.scopeColors[1] }
        ];
        this.loading = false;
        this.ensureDataThenRender();
      },
      error: (err: any) => {
        this.error = err?.error?.message || 'Could not load comparison data.';
        this.loading = false;
      }
    }));
  }

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    // Re-render whenever the chart element's width actually settles or changes.
    // The first measurement on a fresh navigation can be too small (layout not
    // yet settled); this catches the corrected width and also makes it responsive.
    if (this.chartRef) {
      this.resizeObserver = new ResizeObserver(() => {
        const w = this.chartRef.nativeElement.clientWidth;
        if (w > 0 && w !== this.lastRenderWidth && !this.loading && !this.error) {
          this.render();
        }
      });
      this.resizeObserver.observe(this.chartRef.nativeElement);
    }
    if (!this.loading && !this.error) this.render();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.resizeObserver?.disconnect();
  }

  addScope(): void {
    if (this.scopes.length >= this.maxScopes) return;
    const color = this.scopeColors[this.scopes.length % this.scopeColors.length];
    const defaultYear = this.years[this.years.length - 1] ?? 1870;
    this.scopes.push({ kind: 'national', place: '', year: defaultYear, color });
    this.recolor();
    this.ensureDataThenRender();
  }

  removeScope(index: number): void {
    this.scopes.splice(index, 1);
    this.recolor();
    this.render();
  }

  onScopeChange(): void {
    this.ensureDataThenRender();
  }

  onModeChange(): void {
    if (this.viewInitialized) this.render();
  }

  // Keep colors stable by position so the legend always matches the bars
  private recolor(): void {
    this.scopes.forEach((s, i) => s.color = this.scopeColors[i % this.scopeColors.length]);
  }

  private placeKey(scope: Scope): string {
    if (scope.kind === 'national') return 'national';
    return `${scope.kind}:${scope.place}`;
  }

  private queryFor(scope: Scope): string {
    const base = 'stats/composition?entity=people';
    if (scope.kind === 'diocese') return base + '&diocese=' + encodeURIComponent(scope.place);
    if (scope.kind === 'state') return base + '&state=' + encodeURIComponent(scope.place);
    return base;
  }

  // Fetches any place not yet cached, then renders
  private ensureDataThenRender(): void {
    const missing = this.scopes
      .filter(s => s.kind === 'national' || s.place)
      .filter(s => !this.cache.has(this.placeKey(s)));
    const uniqueMissing = Array.from(new Map(missing.map(s => [this.placeKey(s), s])).values());

    if (uniqueMissing.length === 0) {
      this.render();
      return;
    }

    const requests = uniqueMissing.map(s => this._api.getTypeRequest(this.queryFor(s)));
    this.subs.push(forkJoin(requests).subscribe({
      next: (results: any[]) => {
        results.forEach((res, i) => {
          this.cache.set(this.placeKey(uniqueMissing[i]), { rows: res.rows ?? [], years: res.meta?.years ?? [] });
        });
        this.render();
      },
      error: () => this.render()
    }));
  }

  scopeLabel(scope: Scope): string {
    const place = scope.kind === 'national' ? 'National'
      : scope.kind === 'diocese' ? spaceName(scope.place)
      : (this.usStates.find(s => s.abbr === scope.place)?.name ?? scope.place);
    return `${place} ${scope.year}`;
  }

  scopeTotal(scope: Scope): number | null {
    const data = this.cache.get(this.placeKey(scope));
    if (!data) return null;
    const row = data.rows.find(r => r.year === scope.year);
    return row ? row.total : 0;
  }

  isReady(scope: Scope): boolean {
    return scope.kind === 'national' || !!scope.place;
  }

  private valueFor(scope: Scope, bucket: string): { count: number; share: number } {
    const data = this.cache.get(this.placeKey(scope));
    if (!data) return { count: 0, share: 0 };
    const row = data.rows.find(r => r.year === scope.year && r.group === bucket);
    return row ? { count: row.count, share: row.share } : { count: 0, share: 0 };
  }

  private render(): void {
    if (!this.chartRef) return;
    const host = this.chartRef.nativeElement;
    // Container not laid out yet (0 width) — skip rather than draw a narrow
    // fallback; the ResizeObserver re-fires render() once it has real width.
    if (host.clientWidth === 0) return;
    d3.select(host).selectAll('*').remove();

    const activeScopes = this.scopes.filter(s => this.isReady(s));
    if (!activeScopes.length) return;

    // Only show function categories that have a value in at least one scope
    const isShare = this.mode === 'share';
    const categories = this.buckets.filter(b =>
      activeScopes.some(s => this.valueFor(s, b).count > 0));
    if (!categories.length) return;

    const margin = { top: 16, right: 16, bottom: 56, left: 56 };
    const width = Math.max(host.clientWidth, 360);
    this.lastRenderWidth = width;
    const height = 440;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(host).append('svg').attr('width', width).attr('height', height);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x0 = d3.scaleBand<string>().domain(categories).range([0, innerW]).paddingInner(0.25);
    const x1 = d3.scaleBand<number>().domain(activeScopes.map((_, i) => i))
      .range([0, x0.bandwidth()]).padding(0.06);

    const maxVal = d3.max(activeScopes, s =>
      d3.max(categories, b => isShare ? this.valueFor(s, b).share : this.valueFor(s, b).count)) ?? 1;
    const y = d3.scaleLinear().domain([0, maxVal || 1]).nice().range([innerH, 0]);

    // Axes
    g.append('g').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x0).tickFormat(d => this.labels[d] ?? d))
      .selectAll('text').style('font-size', '11px');
    g.append('g')
      .call(isShare ? d3.axisLeft(y).ticks(5).tickFormat(d3.format('.0%'))
                    : d3.axisLeft(y).ticks(5).tickFormat(d3.format('~s')));
    g.append('text').attr('transform', 'rotate(-90)')
      .attr('x', -innerH / 2).attr('y', -42)
      .attr('text-anchor', 'middle').style('font-size', '12px').style('fill', '#555')
      .text(isShare ? 'Share of the scope’s people' : 'People recorded');

    const tooltip = d3.select(host).append('div').attr('class', 'chart-tooltip');

    for (const bucket of categories) {
      const groupG = g.append('g').attr('transform', `translate(${x0(bucket)},0)`);
      activeScopes.forEach((scope, i) => {
        const v = this.valueFor(scope, bucket);
        const val = isShare ? v.share : v.count;
        groupG.append('rect')
          .attr('x', x1(i)!).attr('width', x1.bandwidth())
          .attr('y', y(val)).attr('height', Math.max(0, innerH - y(val)))
          .attr('fill', scope.color)
          .style('cursor', 'pointer')
          .on('mousemove', (event: MouseEvent) => {
            const [mx, my] = d3.pointer(event, host);
            tooltip.style('opacity', '1')
              .style('left', `${mx + 12}px`).style('top', `${my + 12}px`)
              .html(`<strong>${this.scopeLabel(scope)}</strong><br>` +
                `${this.labels[bucket]}: ${v.count} ${v.count === 1 ? 'person' : 'people'} (${(v.share * 100).toFixed(1)}%)`);
          })
          .on('mouseleave', () => tooltip.style('opacity', '0'));
      });
    }
  }
}

const US_STATES: { abbr: string; name: string }[] = [
  { abbr: 'CA', name: 'California' }, { abbr: 'CT', name: 'Connecticut' },
  { abbr: 'IL', name: 'Illinois' }, { abbr: 'IN', name: 'Indiana' },
  { abbr: 'IA', name: 'Iowa' }, { abbr: 'KY', name: 'Kentucky' },
  { abbr: 'LA', name: 'Louisiana' }, { abbr: 'MD', name: 'Maryland' },
  { abbr: 'MA', name: 'Massachusetts' }, { abbr: 'MI', name: 'Michigan' },
  { abbr: 'MN', name: 'Minnesota' }, { abbr: 'MO', name: 'Missouri' },
  { abbr: 'NJ', name: 'New Jersey' }, { abbr: 'NY', name: 'New York' },
  { abbr: 'OH', name: 'Ohio' }, { abbr: 'PA', name: 'Pennsylvania' },
  { abbr: 'WI', name: 'Wisconsin' }
];
