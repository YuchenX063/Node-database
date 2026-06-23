import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SpaceNamePipe, spaceName } from '../../../pipes/space-name.pipe';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import * as d3 from 'd3';
import { ApiService } from '../../../services/api.service';

interface CompositionRow {
  year: number;
  group: string;
  count: number;
  total: number;
  share: number;
}

@Component({
  selector: 'app-people-composition-dashboard',
  imports: [
    SpaceNamePipe,
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonToggleModule
  ],
  templateUrl: './people-composition.component.html',
  styleUrl: './people-composition.component.scss'
})
export class PeopleCompositionDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chart', { static: false }) chartRef!: ElementRef<HTMLDivElement>;

  loading = true;
  error: string | null = null;
  note = '';
  mode: 'share' | 'count' = 'share';

  // Filters
  diocese = '';
  state = '';
  dioceseOptions: string[] = [];
  usStates = US_STATES;

  years: number[] = [];
  private rows: CompositionRow[] = [];
  private buckets: string[] = [];
  private viewInitialized = false;
  private fetchSubscription: Subscription | null = null;
  private resizeObserver?: ResizeObserver;
  private lastRenderWidth = 0;

  // People-framed labels for the institution-function each person served
  private readonly labels: Record<string, string> = {
    'religious institutions': 'Parishes & missions',
    'educational institutions': 'Educational',
    'consecrated life institutions': 'Consecrated life',
    'charitable institutions': 'Charitable',
    'healthcare institutions': 'Healthcare',
    'other': 'Other / unclassified'
  };
  private readonly colors: Record<string, string> = {
    'religious institutions': '#3c6e9e',
    'educational institutions': '#e0a83b',
    'consecrated life institutions': '#7b5aa6',
    'charitable institutions': '#3f9e7a',
    'healthcare institutions': '#c0504d',
    'other': '#9aa0a6'
  };

  constructor(private _api: ApiService, private _http: HttpClient) {}

  ngOnInit(): void {
    this._http.get('diocese.csv', { responseType: 'text' }).subscribe({
      next: data => this.dioceseOptions = data.split('\n')
        .map(l => l.replace(/﻿/g, '').trim()).filter(l => l.length > 0),
      error: () => this.dioceseOptions = []
    });
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

  fetchData(): void {
    this.loading = true;
    this.error = null;
    const params: string[] = ['entity=people'];
    if (this.diocese) params.push('diocese=' + encodeURIComponent(this.diocese));
    if (this.state) params.push('state=' + encodeURIComponent(this.state));
    const url = 'stats/composition?' + params.join('&');

    this.fetchSubscription?.unsubscribe();
    this.fetchSubscription = this._api.getTypeRequest(url).subscribe({
      next: (res: any) => {
        this.rows = res.rows ?? [];
        this.buckets = res.meta?.buckets ?? [];
        this.years = res.meta?.years ?? [];
        this.note = res.meta?.note ?? '';
        this.loading = false;
        if (this.viewInitialized) this.renderWhenReady();
      },
      error: (err: any) => {
        this.error = err?.error?.message || 'Could not load people data.';
        this.loading = false;
      }
    });
  }

  // Renders once the chart actually has width. After a refetch the chart is
  // briefly hidden (loading), so a single render() can hit a 0-width element and
  // no-op; retry across a few frames until the element is laid out again.
  private renderWhenReady(attempts = 0): void {
    if (!this.chartRef) return;
    if (this.chartRef.nativeElement.clientWidth > 0) {
      this.render();
    } else if (attempts < 10) {
      requestAnimationFrame(() => this.renderWhenReady(attempts + 1));
    }
  }

  onScopeChange(): void {
    this.fetchData();
  }

  onModeChange(): void {
    if (this.viewInitialized && !this.loading) this.render();
  }

  get legend(): { group: string; label: string; color: string }[] {
    return this.buckets.map(b => ({
      group: b,
      label: this.labels[b] ?? b,
      color: this.colors[b] ?? '#999'
    }));
  }

  get scopeLabel(): string {
    if (this.diocese) return `Diocese of ${spaceName(this.diocese)}`;
    if (this.state) return `State of ${this.state}`;
    return 'National';
  }

  private render(): void {
    if (!this.chartRef) return;
    const host = this.chartRef.nativeElement;
    // Container not laid out yet (0 width) — skip rather than draw a narrow
    // fallback; the ResizeObserver re-fires render() once it has real width.
    if (host.clientWidth === 0) return;
    d3.select(host).selectAll('*').remove();
    if (!this.rows.length) return;

    const margin = { top: 16, right: 16, bottom: 64, left: 56 };
    const width = Math.max(host.clientWidth, 360);
    this.lastRenderWidth = width;
    const height = 460;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(host).append('svg')
      .attr('width', width)
      .attr('height', height);
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Time-positioned x-axis so coverage gaps show as real empty space,
    // never interpolated across. Bars sit at their actual year.
    const yearExtent = d3.extent(this.years) as [number, number];
    const x = d3.scaleLinear()
      .domain([yearExtent[0] - 1, yearExtent[1] + 1])
      .range([0, innerW]);
    const barW = Math.min(34, (innerW / (yearExtent[1] - yearExtent[0])) * 0.9);

    const isShare = this.mode === 'share';
    const y = d3.scaleLinear()
      .domain([0, isShare ? 1 : (d3.max(this.years, yr => this.totalFor(yr)) ?? 1)])
      .nice()
      .range([innerH, 0]);

    this.drawGapBand(g, x, innerH);

    // Axes
    const xAxis = d3.axisBottom(x).tickValues(this.years).tickFormat(d3.format('d'));
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis)
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')
      .style('font-size', '11px');

    const yAxis = isShare
      ? d3.axisLeft(y).ticks(5).tickFormat(d3.format('.0%'))
      : d3.axisLeft(y).ticks(5).tickFormat(d3.format('~s'));
    g.append('g').call(yAxis);

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerH / 2).attr('y', -42)
      .attr('text-anchor', 'middle').style('font-size', '12px').style('fill', '#555')
      .text(isShare ? 'Share of people recorded' : 'People recorded');

    // Stacked columns, one per year
    const tooltip = d3.select(host).append('div').attr('class', 'chart-tooltip');

    for (const year of this.years) {
      const total = this.totalFor(year);
      let cumulative = 0;
      const cx = x(year) - barW / 2;
      for (const bucket of this.buckets) {
        const row = this.rows.find(r => r.year === year && r.group === bucket);
        const value = row ? (isShare ? row.share : row.count) : 0;
        if (value <= 0) continue;
        const segTop = isShare ? cumulative + value : cumulative + row!.count;
        g.append('rect')
          .attr('x', cx)
          .attr('width', barW)
          .attr('y', y(segTop))
          .attr('height', Math.max(0, y(cumulative) - y(segTop)))
          .attr('fill', this.colors[bucket] ?? '#999')
          .style('cursor', 'pointer')
          .on('mousemove', (event: MouseEvent) => {
            const [mx, my] = d3.pointer(event, host);
            tooltip.style('opacity', '1')
              .style('left', `${mx + 12}px`).style('top', `${my + 12}px`)
              .html(`<strong>${year} &middot; ${this.labels[bucket] ?? bucket}</strong><br>` +
                `${row!.count} ${row!.count === 1 ? 'person' : 'people'} &middot; ${(row!.share * 100).toFixed(1)}% of ${total}`);
          })
          .on('mouseleave', () => tooltip.style('opacity', '0'));
        cumulative = segTop;
      }
    }
  }

  private totalFor(year: number): number {
    const row = this.rows.find(r => r.year === year);
    return row ? row.total : 0;
  }

  // Shades any span longer than 3 years between consecutive present years
  private drawGapBand(g: any, x: d3.ScaleLinear<number, number>, innerH: number): void {
    for (let i = 1; i < this.years.length; i++) {
      const prev = this.years[i - 1];
      const cur = this.years[i];
      if (cur - prev > 3) {
        const x0 = x(prev + 0.5);
        const x1 = x(cur - 0.5);
        g.append('rect')
          .attr('x', x0).attr('y', 0)
          .attr('width', x1 - x0).attr('height', innerH)
          .attr('fill', '#000').attr('opacity', 0.04);
        g.append('text')
          .attr('x', (x0 + x1) / 2).attr('y', innerH / 2)
          .attr('text-anchor', 'middle').attr('transform', `rotate(-90 ${(x0 + x1) / 2} ${innerH / 2})`)
          .style('font-size', '11px').style('fill', '#999')
          .text(`not published ${prev + 1}–${cur - 1}`);
      }
    }
  }
}

const US_STATES: { abbr: string; name: string }[] = [
  { abbr: '', name: 'All States' },
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
