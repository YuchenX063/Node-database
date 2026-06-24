import {
  Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import * as d3 from 'd3';
import { ApiService } from '../../../services/api.service';
import { MapVisComponent } from '../../common/map-vis/map-vis.component';
import { PALETTE, OTHER_COLOR, LegendEntry } from '../../common/map-vis/map-grouping';
import { SpaceNamePipe, spaceName } from '../../../pipes/space-name.pipe';

interface YearStat { year: number; total: number; centroidLng: number; centroidLat: number; }
interface DioceseCat { key: string; total: number; }
interface GeoPoint { year: number; lat: number; lng: number; diocese: string; weight: number; }

@Component({
  selector: 'app-diocese-tracker-dashboard',
  imports: [
    CommonModule, FormsModule, MatFormFieldModule, MatSelectModule,
    MatIconModule, MatSliderModule, MapVisComponent, SpaceNamePipe
  ],
  templateUrl: './diocese-tracker.component.html',
  styleUrl: './diocese-tracker.component.scss'
})
export class DioceseTrackerDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('growth', { static: false }) growthRef!: ElementRef<HTMLDivElement>;

  loading = true;
  error: string | null = null;

  years: YearStat[] = [];
  yearIndex = 0;
  isPlaying = false;

  dioceses: DioceseCat[] = [];
  selected = ''; // '' = all dioceses
  readonly spaceName = spaceName;

  mapData: any[] = [];
  legend: LegendEntry[] = [];
  mapOptions = {
    zoom: 3.5,
    mode: 'point' as const,
    modeControl: true,
    center: { lat: 39, lng: -95 },
    size: { width: '100%', height: '560px' }
  };

  private pointsByYear = new Map<number, GeoPoint[]>();
  private dioceseColor: Record<string, string> = {};
  private fetchSubscription: Subscription | null = null;
  private timer: any = null;
  private resizeObserver?: ResizeObserver;
  private viewInitialized = false;

  constructor(private _api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.fetchData();
  }

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    if (this.growthRef) {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.growthRef.nativeElement.clientWidth > 0 && !this.loading && !this.error) {
          this.renderGrowth();
        }
      });
      this.resizeObserver.observe(this.growthRef.nativeElement);
    }
    if (!this.loading && !this.error) this.renderGrowth();
  }

  ngOnDestroy(): void {
    this.stop();
    this.fetchSubscription?.unsubscribe();
    this.resizeObserver?.disconnect();
  }

  fetchData(): void {
    this.loading = true;
    this.error = null;
    this.stop();
    this.fetchSubscription?.unsubscribe();
    this.fetchSubscription = this._api.getTypeRequest('stats/geo?by=diocese').subscribe({
      next: (res: any) => {
        this.years = res.years ?? [];
        this.dioceses = res.meta?.categories ?? [];
        // Assign palette colours biggest-diocese-first, so the most prominent
        // jurisdictions get the most distinct colours (and stay stable by year).
        this.dioceseColor = {};
        this.dioceses.forEach((d, i) => { this.dioceseColor[d.key] = PALETTE[i % PALETTE.length]; });
        this.pointsByYear = new Map();
        for (const p of (res.points ?? []) as GeoPoint[]) {
          const list = this.pointsByYear.get(p.year);
          if (list) list.push(p); else this.pointsByYear.set(p.year, [p]);
        }
        this.yearIndex = 0;
        this.loading = false;
        this.updateMap();
        if (this.viewInitialized) this.renderGrowthWhenReady();
      },
      error: (err: any) => {
        this.error = err?.error?.message || 'Could not load the diocesan data.';
        this.loading = false;
      }
    });
  }

  get currentStat(): YearStat | null {
    return this.years[this.yearIndex] ?? null;
  }

  private colorFor(diocese: string): string {
    return this.dioceseColor[diocese] || OTHER_COLOR;
  }

  private pointsThisYear(): GeoPoint[] {
    const stat = this.currentStat;
    const pts = stat ? (this.pointsByYear.get(stat.year) ?? []) : [];
    return this.selected ? pts.filter(p => p.diocese === this.selected) : pts;
  }

  /** Institution-years recorded for the current scope (all, or one diocese) this year. */
  get visibleTotal(): number {
    return this.pointsThisYear().reduce((sum, p) => sum + p.weight, 0);
  }

  /** Number of distinct dioceses with at least one institution this year. */
  get activeDioceseCount(): number {
    const stat = this.currentStat;
    const pts = stat ? (this.pointsByYear.get(stat.year) ?? []) : [];
    return new Set(pts.map(p => p.diocese)).size;
  }

  /** First and last almanac year the selected diocese appears. */
  get selectedSpan(): { first: number; last: number } | null {
    if (!this.selected) return null;
    const ys = this.years
      .filter(y => (this.pointsByYear.get(y.year) ?? []).some(p => p.diocese === this.selected))
      .map(y => y.year);
    if (!ys.length) return null;
    return { first: Math.min(...ys), last: Math.max(...ys) };
  }

  /** Rebuild map points + legend for the active year and diocese filter. */
  updateMap(): void {
    const pts = this.pointsThisYear();
    this.mapData = pts.map(p => ({
      latitude: p.lat,
      longitude: p.lng,
      title: spaceName(p.diocese),
      options: {
        color: this.colorFor(p.diocese),
        value: p.weight,
        radius: Math.min(4 + Math.sqrt(p.weight) * 2, 14)
      }
    }));
    if (this.selected) {
      this.legend = [{ label: spaceName(this.selected), color: this.colorFor(this.selected) }];
    } else {
      // Top dioceses by overall size, so the legend stays readable.
      this.legend = this.dioceses.slice(0, 12)
        .map(d => ({ label: spaceName(d.key), color: this.colorFor(d.key) }));
    }
    this.cdr.markForCheck();
  }

  onSelectChange(): void {
    this.updateMap();
    this.renderGrowth();
  }

  onScrub(): void {
    this.stop();
    this.updateMap();
    this.renderGrowth();
  }

  formatYear = (index: number): string => `${this.years[index]?.year ?? ''}`;

  togglePlay(): void {
    this.isPlaying ? this.stop() : this.play();
  }

  private play(): void {
    if (!this.years.length) return;
    if (this.yearIndex >= this.years.length - 1) this.yearIndex = 0;
    this.isPlaying = true;
    this.timer = setInterval(() => {
      if (this.yearIndex >= this.years.length - 1) { this.stop(); return; }
      this.yearIndex++;
      this.updateMap();
      this.renderGrowth();
    }, 1100);
  }

  private stop(): void {
    this.isPlaying = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  private renderGrowthWhenReady(attempts = 0): void {
    if (!this.growthRef) return;
    if (this.growthRef.nativeElement.clientWidth > 0) {
      this.renderGrowth();
    } else if (attempts < 15) {
      requestAnimationFrame(() => this.renderGrowthWhenReady(attempts + 1));
    }
  }

  /** Series the growth chart plots: a diocese's count by year, or the number of
   * distinct dioceses by year (jurisdictional spread) when viewing all. */
  private growthSeries(): { year: number; value: number }[] {
    return this.years.map(y => {
      const pts = this.pointsByYear.get(y.year) ?? [];
      if (this.selected) {
        return { year: y.year, value: pts.filter(p => p.diocese === this.selected).reduce((s, p) => s + p.weight, 0) };
      }
      return { year: y.year, value: new Set(pts.map(p => p.diocese)).size };
    });
  }

  get growthTitle(): string {
    return this.selected
      ? `${spaceName(this.selected)} — institutions recorded, by year`
      : 'Dioceses represented, by year';
  }

  private renderGrowth(): void {
    if (!this.growthRef) return;
    const host = this.growthRef.nativeElement;
    if (host.clientWidth === 0 || !this.years.length) return;
    d3.select(host).selectAll('*').remove();

    const data = this.growthSeries();
    const margin = { top: 14, right: 16, bottom: 28, left: 40 };
    const width = Math.max(host.clientWidth, 280);
    const height = 170;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(host).append('svg').attr('width', width).attr('height', height);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const yearExtent = d3.extent(this.years, d => d.year) as [number, number];
    const x = d3.scaleLinear().domain([yearExtent[0] - 1, yearExtent[1] + 1]).range([0, innerW]);
    const y = d3.scaleLinear().domain([0, (d3.max(data, d => d.value) ?? 1) * 1.1]).nice().range([innerH, 0]);

    // Shade coverage-gap years (none published)
    for (let i = 1; i < this.years.length; i++) {
      const prev = this.years[i - 1].year, cur = this.years[i].year;
      if (cur - prev > 3) {
        const x0 = x(prev + 0.5), x1 = x(cur - 0.5);
        g.append('rect').attr('x', x0).attr('y', 0).attr('width', x1 - x0).attr('height', innerH)
          .attr('fill', '#000').attr('opacity', 0.04);
      }
    }

    g.append('g').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickValues(this.years.map(d => d.year)).tickFormat(d3.format('d')))
      .selectAll('text').attr('transform', 'rotate(-45)').style('text-anchor', 'end').style('font-size', '9px');
    g.append('g').call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('~s'))).selectAll('text').style('font-size', '9px');

    const accent = this.selected ? this.colorFor(this.selected) : '#2d3a4a';
    const line = d3.line<{ year: number; value: number }>().x(d => x(d.year)).y(d => y(d.value));

    // Draw per contiguous island so the gap isn't bridged.
    let segment: { year: number; value: number }[] = [];
    const flush = () => {
      if (segment.length) {
        g.append('path').datum(segment).attr('fill', 'none').attr('stroke', accent).attr('stroke-width', 2).attr('d', line);
        segment = [];
      }
    };
    for (let i = 0; i < data.length; i++) {
      if (i > 0 && data[i].year - data[i - 1].year > 3) flush();
      segment.push(data[i]);
    }
    flush();

    g.selectAll('circle').data(data).enter().append('circle')
      .attr('cx', d => x(d.year)).attr('cy', d => y(d.value))
      .attr('r', (_d, i) => i === this.yearIndex ? 5 : 2.5)
      .attr('fill', (_d, i) => i === this.yearIndex ? '#d81b60' : accent);
  }
}
