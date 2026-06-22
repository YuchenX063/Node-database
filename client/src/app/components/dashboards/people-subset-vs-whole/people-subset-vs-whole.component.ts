import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import * as d3 from 'd3';
import { ApiService } from '../../../services/api.service';

interface SeriesPoint { year: number; count: number; }

@Component({
  selector: 'app-people-subset-vs-whole-dashboard',
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonToggleModule
  ],
  templateUrl: './people-subset-vs-whole.component.html',
  styleUrl: './people-subset-vs-whole.component.scss'
})
export class PeopleSubsetVsWholeDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chart', { static: false }) chartRef!: ElementRef<HTMLDivElement>;

  loading = true;
  error: string | null = null;
  mode: 'indexed' | 'count' = 'indexed';

  // Selections
  categoryKind: 'type' | 'function' = 'function';
  category = 'educational institutions';
  subsetKind: 'order' | 'diocese' | 'state' = 'state';
  subsetValue = 'NY';
  baseYear: number | null = null;

  // Option lists
  readonly typeOptions = ['church', 'chapel', 'mission', 'cathedral', 'school', 'academy', 'college', 'seminary', 'convent', 'hospital', 'asylum'];
  readonly functionOptions = ['religious institutions', 'educational institutions', 'consecrated life institutions', 'charitable institutions', 'healthcare institutions'];
  orderOptions: string[] = [];
  dioceseOptions: string[] = [];
  usStates = US_STATES;

  years: number[] = [];
  private whole: SeriesPoint[] = [];
  private subset: SeriesPoint[] = [];
  private viewInitialized = false;
  private fetchSubscription: Subscription | null = null;
  private resizeObserver?: ResizeObserver;
  private lastRenderWidth = 0;

  private readonly wholeColor = '#9aa0a6';
  private readonly subsetColor = '#2f6f9f';

  constructor(private _api: ApiService, private _http: HttpClient) {}

  ngOnInit(): void {
    this.loadCsv('order.csv', o => this.orderOptions = o);
    this.loadCsv('diocese.csv', o => this.dioceseOptions = o);
    this.fetchData();
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
    this.fetchSubscription?.unsubscribe();
    this.resizeObserver?.disconnect();
  }

  private loadCsv(file: string, assign: (o: string[]) => void): void {
    this._http.get(file, { responseType: 'text' }).subscribe({
      next: data => assign(data.split('\n').map(l => l.replace(/﻿/g, '').trim()).filter(l => l.length > 0)),
      error: () => assign([])
    });
  }

  get categoryOptions(): string[] {
    return this.categoryKind === 'type' ? this.typeOptions : this.functionOptions;
  }

  get subsetLabel(): string {
    if (this.subsetKind === 'state') return this.usStates.find(s => s.abbr === this.subsetValue)?.name ?? this.subsetValue;
    return this.subsetValue;
  }

  // Function values are already plural phrases ("educational institutions");
  // type values are singular nouns ("school"), so pluralize those for prose.
  get categoryDisplay(): string {
    if (this.categoryKind === 'function') return this.category;
    const c = this.category;
    if (/[^aeiou]y$/.test(c)) return c.slice(0, -1) + 'ies';     // academy -> academies
    if (/(ch|sh|s|x)$/.test(c)) return c + 'es';                  // church -> churches
    return c + 's';                                              // school -> schools
  }

  onCategoryKindChange(): void {
    this.category = this.categoryOptions[0];
    this.fetchData();
  }

  onSubsetKindChange(): void {
    this.subsetValue = this.subsetKind === 'state' ? 'NY'
      : this.subsetKind === 'diocese' ? (this.dioceseOptions[0] ?? '')
      : (this.orderOptions[0] ?? '');
    this.fetchData();
  }

  onSelectionChange(): void {
    this.fetchData();
  }

  onViewChange(): void {
    if (this.viewInitialized) this.render();
  }

  fetchData(): void {
    if (!this.category || !this.subsetValue) return;
    this.loading = true;
    this.error = null;
    const url = 'stats/subset-vs-whole'
      + `?entity=people`
      + `&categoryKind=${encodeURIComponent(this.categoryKind)}`
      + `&category=${encodeURIComponent(this.category)}`
      + `&subsetKind=${encodeURIComponent(this.subsetKind)}`
      + `&subsetValue=${encodeURIComponent(this.subsetValue)}`;

    this.fetchSubscription?.unsubscribe();
    this.fetchSubscription = this._api.getTypeRequest(url).subscribe({
      next: (res: any) => {
        this.whole = res.whole ?? [];
        this.subset = res.subset ?? [];
        this.years = res.meta?.years ?? [];
        // Default the index base to the start of the most recent unbroken run
        // of years, so growth isn't distorted by a long coverage gap. This is
        // computed from the data — as middle years fill in, it moves earlier on
        // its own (with fully continuous data it becomes the first year).
        if (this.baseYear == null || !this.years.includes(this.baseYear)) {
          this.baseYear = this.defaultBaseYear(this.years);
        }
        this.loading = false;
        if (this.viewInitialized) setTimeout(() => this.render());
      },
      error: (err: any) => {
        this.error = err?.error?.message || 'Could not load comparison data.';
        this.loading = false;
      }
    });
  }

  // Start of the most recent contiguous run of years. A run breaks only on a
  // gap of more than 2 years, so a single missing year is tolerated but a real
  // coverage gap (e.g. 1861 -> 1864) is not. Computed from the data, so it
  // moves earlier on its own as middle years fill in.
  private defaultBaseYear(years: number[]): number | null {
    if (!years.length) return null;
    let base = years[years.length - 1];
    for (let i = years.length - 1; i > 0; i--) {
      if (years[i] - years[i - 1] <= 2) base = years[i - 1]; else break;
    }
    return base;
  }

  // Actual year span where the chosen subset has any people — drives the order
  // caveat so it stays accurate as more years are tagged
  get subsetSpan(): { first: number; last: number } | null {
    const nz = this.subset.filter(p => p.count > 0).map(p => p.year);
    if (!nz.length) return null;
    return { first: Math.min(...nz), last: Math.max(...nz) };
  }

  private countAt(series: SeriesPoint[], year: number): number {
    const p = series.find(s => s.year === year);
    return p ? p.count : 0;
  }

  // Years available as an index base = those where the whole has data
  get baseYearOptions(): number[] {
    return this.years;
  }

  // The growth headline: % change of each series from base year to last shown year
  get headline(): { base: number; last: number; wholePct: number | null; subsetPct: number | null; wholeBase: number; subsetBase: number; wholeLast: number; subsetLast: number } | null {
    if (this.baseYear == null || !this.years.length) return null;
    const shown = this.years.filter(y => y >= this.baseYear!);
    if (shown.length < 2) return null;
    const base = shown[0];
    const last = shown[shown.length - 1];
    const wb = this.countAt(this.whole, base), wl = this.countAt(this.whole, last);
    const sb = this.countAt(this.subset, base), sl = this.countAt(this.subset, last);
    return {
      base, last,
      wholePct: wb > 0 ? Math.round((wl / wb - 1) * 100) : null,
      subsetPct: sb > 0 ? Math.round((sl / sb - 1) * 100) : null,
      wholeBase: wb, subsetBase: sb, wholeLast: wl, subsetLast: sl
    };
  }

  // Smallest subset count across shown years — drives the small-sample warning
  get minSubsetCount(): number {
    const shown = this.mode === 'indexed' && this.baseYear != null
      ? this.years.filter(y => y >= this.baseYear!) : this.years;
    if (!shown.length) return 0;
    return Math.min(...shown.map(y => this.countAt(this.subset, y)));
  }

  private render(): void {
    if (!this.chartRef) return;
    const host = this.chartRef.nativeElement;
    // Container not laid out yet (0 width) — skip rather than draw a narrow
    // fallback; the ResizeObserver re-fires render() once it has real width.
    if (host.clientWidth === 0) return;
    d3.select(host).selectAll('*').remove();
    if (!this.years.length) return;

    const indexed = this.mode === 'indexed';
    const shownYears = indexed && this.baseYear != null
      ? this.years.filter(y => y >= this.baseYear!) : this.years;
    if (shownYears.length < 1) return;

    // For indexed mode, both series are rebased to 100 at baseYear
    const wholeBase = indexed ? this.countAt(this.whole, this.baseYear!) : 1;
    const subsetBase = indexed ? this.countAt(this.subset, this.baseYear!) : 1;
    const value = (series: SeriesPoint[], base: number, year: number): number | null => {
      const c = this.countAt(series, year);
      if (!indexed) return c;
      return base > 0 ? (c / base) * 100 : null;
    };

    const margin = { top: 20, right: 20, bottom: 44, left: 52 };
    const width = Math.max(host.clientWidth, 360);
    this.lastRenderWidth = width;
    const height = 420;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(host).append('svg').attr('width', width).attr('height', height);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
      .domain(d3.extent(shownYears) as [number, number])
      .range([0, innerW]);

    const allVals: number[] = [];
    for (const y of shownYears) {
      const w = value(this.whole, wholeBase, y); if (w != null) allVals.push(w);
      const s = value(this.subset, subsetBase, y); if (s != null) allVals.push(s);
    }
    const y = d3.scaleLinear().domain([0, (d3.max(allVals) ?? 1) * 1.05]).nice().range([innerH, 0]);

    // Axes
    g.append('g').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickValues(shownYears).tickFormat(d3.format('d')))
      .selectAll('text').style('font-size', '11px');
    g.append('g').call(
      indexed ? d3.axisLeft(y).ticks(6) : d3.axisLeft(y).ticks(6).tickFormat(d3.format('~s'))
    );
    g.append('text').attr('transform', 'rotate(-90)')
      .attr('x', -innerH / 2).attr('y', -40).attr('text-anchor', 'middle')
      .style('font-size', '12px').style('fill', '#555')
      .text(indexed ? `Indexed to ${this.baseYear} = 100` : 'People recorded');

    // Reference line at 100 for indexed mode
    if (indexed) {
      g.append('line').attr('x1', 0).attr('x2', innerW).attr('y1', y(100)).attr('y2', y(100))
        .attr('stroke', '#bbb').attr('stroke-dasharray', '3,3');
    }

    // Draw a series as gap-broken line segments + markers
    const drawSeries = (series: SeriesPoint[], base: number, color: string) => {
      const pts = shownYears
        .map(yr => ({ year: yr, v: value(series, base, yr) }))
        .filter(p => p.v != null) as { year: number; v: number }[];

      // Split into segments where consecutive shown years jump >3 (the gap)
      const segments: { year: number; v: number }[][] = [];
      let seg: { year: number; v: number }[] = [];
      for (let i = 0; i < pts.length; i++) {
        if (i > 0 && pts[i].year - pts[i - 1].year > 3) { segments.push(seg); seg = []; }
        seg.push(pts[i]);
      }
      if (seg.length) segments.push(seg);

      const line = d3.line<{ year: number; v: number }>().x(p => x(p.year)).y(p => y(p.v));
      for (const s of segments) {
        g.append('path').datum(s).attr('fill', 'none').attr('stroke', color)
          .attr('stroke-width', 2.5).attr('d', line);
      }
      g.selectAll(null).data(pts).enter().append('circle')
        .attr('cx', p => x(p.year)).attr('cy', p => y(p.v)).attr('r', 3.5).attr('fill', color);
    };

    drawSeries(this.whole, wholeBase, this.wholeColor);
    drawSeries(this.subset, subsetBase, this.subsetColor);

    // Tooltip hit-targets: one vertical band per year
    const tooltip = d3.select(host).append('div').attr('class', 'chart-tooltip');
    for (const yr of shownYears) {
      const wc = this.countAt(this.whole, yr), sc = this.countAt(this.subset, yr);
      g.append('rect')
        .attr('x', x(yr) - 12).attr('y', 0).attr('width', 24).attr('height', innerH)
        .attr('fill', 'transparent')
        .on('mousemove', (event: MouseEvent) => {
          const [mx, my] = d3.pointer(event, host);
          const share = wc > 0 ? ((sc / wc) * 100).toFixed(1) : '0.0';
          tooltip.style('opacity', '1').style('left', `${mx + 12}px`).style('top', `${my + 12}px`)
            .html(`<strong>${yr}</strong><br>Whole: ${wc}<br>Subset: ${sc} (${share}% of whole)`);
        })
        .on('mouseleave', () => tooltip.style('opacity', '0'));
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
