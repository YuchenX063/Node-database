import {
  Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import * as d3 from 'd3';
import { ApiService } from '../../../services/api.service';
import { MapVisComponent } from '../../common/map-vis/map-vis.component';
import { FUNCTION_COLORS, OTHER_COLOR, LegendEntry } from '../../common/map-vis/map-grouping';

interface YearStat {
  year: number;
  total: number;
  centroidLng: number;
  centroidLat: number;
}
interface GeoPoint {
  year: number;
  lat: number;
  lng: number;
  fn: string;
  weight: number;
}

// The six function buckets the server tags points with, in legend order.
const FUNCTIONS: { key: string; label: string; color: string }[] = [
  { key: 'religious institutions', label: 'Religious', color: FUNCTION_COLORS['religious institutions'] },
  { key: 'educational institutions', label: 'Educational', color: FUNCTION_COLORS['educational institutions'] },
  { key: 'consecrated life institutions', label: 'Consecrated life', color: FUNCTION_COLORS['consecrated life institutions'] },
  { key: 'charitable institutions', label: 'Charitable', color: FUNCTION_COLORS['charitable institutions'] },
  { key: 'healthcare institutions', label: 'Healthcare', color: FUNCTION_COLORS['healthcare institutions'] },
  { key: 'other', label: 'Other', color: OTHER_COLOR }
];

@Component({
  selector: 'app-spread-dashboard',
  imports: [CommonModule, FormsModule, MatButtonToggleModule, MatIconModule, MatSliderModule, MapVisComponent],
  templateUrl: './spread.component.html',
  styleUrl: './spread.component.scss'
})
export class SpreadDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('drift', { static: false }) driftRef!: ElementRef<HTMLDivElement>;

  loading = true;
  error: string | null = null;
  note = '';
  entity: 'institutions' | 'people' = 'institutions';

  years: YearStat[] = [];
  yearIndex = 0;
  isPlaying = false;

  functions = FUNCTIONS;
  enabled = new Set<string>(FUNCTIONS.map(f => f.key));

  mapData: any[] = [];
  legend: LegendEntry[] = [];
  mapOptions = {
    zoom: 3.4,
    mode: 'heatmap' as const,
    modeControl: true,
    center: { lat: 39, lng: -95 },
    size: { width: '100%', height: '560px' }
  };

  private pointsByYear = new Map<number, GeoPoint[]>();
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
    if (this.driftRef) {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.driftRef.nativeElement.clientWidth > 0 && !this.loading && !this.error) {
          this.renderDrift();
        }
      });
      this.resizeObserver.observe(this.driftRef.nativeElement);
    }
    if (!this.loading && !this.error) this.renderDrift();
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
    this.fetchSubscription = this._api.getTypeRequest('stats/geo?entity=' + this.entity).subscribe({
      next: (res: any) => {
        this.years = res.years ?? [];
        this.note = res.meta?.note ?? '';
        this.pointsByYear = new Map();
        for (const p of (res.points ?? []) as GeoPoint[]) {
          const list = this.pointsByYear.get(p.year);
          if (list) list.push(p); else this.pointsByYear.set(p.year, [p]);
        }
        this.yearIndex = 0;
        this.loading = false;
        this.updateMap();
        if (this.viewInitialized) this.renderDriftWhenReady();
      },
      error: (err: any) => {
        this.error = err?.error?.message || 'Could not load the geographic data.';
        this.loading = false;
      }
    });
  }

  get currentStat(): YearStat | null {
    return this.years[this.yearIndex] ?? null;
  }

  /** Total recorded in the active year, after the function filter. */
  get visibleTotal(): number {
    const stat = this.currentStat;
    if (!stat) return 0;
    return (this.pointsByYear.get(stat.year) ?? [])
      .filter(p => this.enabled.has(this.bucket(p.fn)))
      .reduce((sum, p) => sum + p.weight, 0);
  }

  /** Degrees of longitude the centre of gravity has shifted since the first year. */
  get westwardDriftDeg(): number {
    if (this.years.length < 2 || !this.currentStat) return 0;
    return this.years[0].centroidLng - this.currentStat.centroidLng;
  }

  /** Rough miles-west of that drift at this latitude. */
  get westwardDriftMiles(): number {
    const stat = this.currentStat;
    if (!stat) return 0;
    const milesPerDegLng = 69.17 * Math.cos((stat.centroidLat * Math.PI) / 180);
    return Math.round(this.westwardDriftDeg * milesPerDegLng);
  }

  private bucket(fn: string): string {
    return FUNCTIONS.some(f => f.key === fn) ? fn : 'other';
  }

  private colorFor(fn: string): string {
    return FUNCTION_COLORS[fn] ?? OTHER_COLOR;
  }

  /** Rebuild the map points + legend for the active year and function filter. */
  updateMap(): void {
    const stat = this.currentStat;
    const pts = stat ? (this.pointsByYear.get(stat.year) ?? []) : [];
    const shown = pts.filter(p => this.enabled.has(this.bucket(p.fn)));
    this.mapData = shown.map(p => ({
      latitude: p.lat,
      longitude: p.lng,
      title: '',
      options: {
        color: this.colorFor(this.bucket(p.fn)),
        value: p.weight,
        radius: Math.min(4 + Math.sqrt(p.weight) * 2, 14)
      }
    }));
    this.legend = this.functions
      .filter(f => this.enabled.has(f.key))
      .map(f => ({ label: f.label, color: f.color }));
    this.cdr.markForCheck();
  }

  onScrub(): void {
    this.stop();
    this.updateMap();
    this.renderDrift();
  }

  /** Slider thumb label: map the index back to its year. */
  formatYear = (index: number): string => `${this.years[index]?.year ?? ''}`;

  centroidLabel(stat: YearStat): string {
    const lngDir = stat.centroidLng < 0 ? 'W' : 'E';
    const latDir = stat.centroidLat < 0 ? 'S' : 'N';
    return `${Math.abs(stat.centroidLng).toFixed(1)}°${lngDir}, ${Math.abs(stat.centroidLat).toFixed(1)}°${latDir}`;
  }

  onEntityChange(): void {
    this.fetchData();
  }

  toggleFunction(key: string): void {
    if (this.enabled.has(key)) {
      if (this.enabled.size > 1) this.enabled.delete(key);
    } else {
      this.enabled.add(key);
    }
    this.updateMap();
  }

  togglePlay(): void {
    this.isPlaying ? this.stop() : this.play();
  }

  private play(): void {
    if (!this.years.length) return;
    // Restart from the beginning if we're already at the end.
    if (this.yearIndex >= this.years.length - 1) this.yearIndex = 0;
    this.isPlaying = true;
    this.timer = setInterval(() => {
      if (this.yearIndex >= this.years.length - 1) {
        this.stop();
        return;
      }
      this.yearIndex++;
      this.updateMap();
      this.renderDrift();
    }, 1100);
  }

  private stop(): void {
    this.isPlaying = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  // The drift panel is briefly hidden behind the loading state, so a single
  // render can hit a 0-width element and no-op; retry across a few frames until
  // it's laid out (mirrors the chart dashboards).
  private renderDriftWhenReady(attempts = 0): void {
    if (!this.driftRef) return;
    if (this.driftRef.nativeElement.clientWidth > 0) {
      this.renderDrift();
    } else if (attempts < 15) {
      requestAnimationFrame(() => this.renderDriftWhenReady(attempts + 1));
    }
  }

  // --- "Westward drift" timeline: centre-of-gravity longitude over the years ---
  private renderDrift(): void {
    if (!this.driftRef) return;
    const host = this.driftRef.nativeElement;
    if (host.clientWidth === 0 || !this.years.length) return;
    d3.select(host).selectAll('*').remove();

    const margin = { top: 14, right: 16, bottom: 28, left: 44 };
    const width = Math.max(host.clientWidth, 280);
    const height = 170;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(host).append('svg').attr('width', width).attr('height', height);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const yearExtent = d3.extent(this.years, d => d.year) as [number, number];
    const x = d3.scaleLinear().domain([yearExtent[0] - 1, yearExtent[1] + 1]).range([0, innerW]);
    // West is more negative longitude; invert so "further west" reads as "up".
    const lngExtent = d3.extent(this.years, d => d.centroidLng) as [number, number];
    const pad = 0.4;
    const y = d3.scaleLinear()
      .domain([lngExtent[0] - pad, lngExtent[1] + pad])
      .range([0, innerH]);

    // Coverage-gap band (years not published)
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
    g.append('g').call(d3.axisLeft(y).ticks(4).tickFormat(d => `${Math.abs(+d).toFixed(0)}°W`))
      .selectAll('text').style('font-size', '9px');

    // Draw a separate line segment per contiguous island so the gap isn't bridged.
    const line = d3.line<YearStat>().x(d => x(d.year)).y(d => y(d.centroidLng));
    let segment: YearStat[] = [];
    const flush = () => {
      if (segment.length) {
        g.append('path').datum(segment).attr('fill', 'none')
          .attr('stroke', '#7b1fa2').attr('stroke-width', 2).attr('d', line);
        segment = [];
      }
    };
    for (let i = 0; i < this.years.length; i++) {
      if (i > 0 && this.years[i].year - this.years[i - 1].year > 3) flush();
      segment.push(this.years[i]);
    }
    flush();

    // Dots, with the active year highlighted.
    g.selectAll('circle').data(this.years).enter().append('circle')
      .attr('cx', d => x(d.year)).attr('cy', d => y(d.centroidLng))
      .attr('r', (_d, i) => i === this.yearIndex ? 5 : 2.5)
      .attr('fill', (_d, i) => i === this.yearIndex ? '#d81b60' : '#7b1fa2');
  }
}
