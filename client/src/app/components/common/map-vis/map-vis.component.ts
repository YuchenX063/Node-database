import {
  Component, Input, Output, EventEmitter, OnInit, AfterViewInit, ViewChild, ElementRef,
  OnChanges, SimpleChanges, HostListener, ChangeDetectorRef
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Router } from '@angular/router';
import { Settings } from '../../../app.settings';
import { LegendEntry } from './map-grouping';
import maplibregl from 'maplibre-gl';

@Component({
  selector: 'app-map-vis',
    imports: [
    CommonModule, MatCardModule, MatIconModule,
    MatFormFieldModule, MatSelectModule, MatInputModule, FormsModule
  ],
  templateUrl: './map-vis.component.html',
  styleUrl: './map-vis.component.scss'
})
export class MapVisComponent {
@ViewChild('map', { static: false }) private mapRef!: ElementRef<HTMLDivElement>;
  @ViewChild('headerRef', { static: false }) headerRef?: ElementRef<HTMLElement>;
  @ViewChild('resizeBarRef', { static: false }) resizeBarRef?: ElementRef<HTMLElement>;
  @ViewChild('dropdownRef', { static: false }) dropdownRef?: ElementRef<HTMLElement>;
  @Input() label: string = '';
  @Input() data: any[] = [];
  @Input() isOpen: boolean = false;
  @Input() simple: boolean = false;
  /** When true (non-simple only), the map grows to fill the viewport height. */
  @Input() fillScreen: boolean = false;
  /** Legend entries (label + colour) overlaid on the map; empty = hidden. */
  @Input() legend: LegendEntry[] = [];
  /**
   * Opt-in: turn the map into a cross-filter control. When true, clicking near
   * any data point emits that point's payload via (featureClick) — works in
   * every display mode (heatmap included) by hit-testing the data directly, not
   * a specific layer. Off by default so existing maps are unaffected.
   */
  @Input() clickToSelect: boolean = false;
  @Output() featureClick = new EventEmitter<any>();
  /** Display modes to hide from the in-map control, e.g. ['cluster']. */
  @Input() excludeModes: string[] = [];
  /** When false, the map does NOT recenter on data updates (the host controls
   *  the view, e.g. via fitToBounds). Initial centering still applies. */
  @Input() autoCenter: boolean = true;
  /** Emphasised marker(s) drawn on top of the data layer (e.g. a centroid). */
  @Input() overlayMarkers: { lat: number; lng: number; color?: string; title?: string }[] = [];
  /** A polyline [lng,lat][] drawn under the markers (e.g. a centroid's path). */
  @Input() overlayTrack: [number, number][] = [];
  @Input() options: {
    zoom?: number;
    mode?: 'normal' | 'heatmap' | 'cluster' | 'point' | 'bins';
    modeControl?: boolean;
    modeOptions?: any;
    center?: { lat: number; lng: number };
    size: { width: string; height: string };
  } = {
    zoom: 2,
    mode: 'normal',
    modeOptions: {},
    modeControl: false,
    size: { width: '100%', height: '400px' }
  };

  map: any = null;
  markers: any[] = [];
  multipleStyles: boolean = Array.isArray(Settings.mapTilesUrl);
  currentStyle: string = Array.isArray(Settings.mapTilesUrl) ? Settings.mapTilesUrl[0].url : Settings.mapTilesUrl;
  settings = Settings;
  currentMode: string = 'normal';
  // Once the user picks a display mode from the control, remember it so a data
  // update (e.g. the parent changing the year) doesn't revert to options.mode.
  private userMode: string | null = null;
  possibleModes = [
    { value: 'normal', label: 'Normal' },
    { value: 'heatmap', label: 'Heatmap' },
    { value: 'cluster', label: 'Cluster' },
    { value: 'point', label: 'Points' },
    { value: 'bins', label: 'Grid' }
  ];
  private binsPopup?: any;
  private binsConfig: any = null;
  private binsViewHandler?: any;
  private heatConfig: any = null;
  private heatViewHandler?: any;

  /** Modes shown in the Display control, minus any the host excluded. */
  get displayModes() {
    return this.possibleModes.filter(m => !this.excludeModes.includes(m.value));
  }
  loading: boolean = true;

  private isResizing = false;
  private startY = 0;
  private startHeight = 0;
  private resizeObserver?: ResizeObserver;

  constructor(private router: Router, private cdr: ChangeDetectorRef) {}

  /**
   * On component initialization, sets the current map mode and loading state.
   */
  ngOnInit(): void {
    this.currentMode = this.options.mode || 'normal';
    this.loading = false;
  }

  /**
   * After the view initializes, sets the current map style and initializes the map.
   */
  ngAfterViewInit(): void {
    if (Array.isArray(Settings.mapTilesUrl)) {
      this.currentStyle = Settings.mapTilesUrl[0].url;
    } else {
      this.currentStyle = Settings.mapTilesUrl;
    }
    this.initializeMap();
    setTimeout(() => {
      if (!this.simple && this.fillScreen) {
        this.setMapHeightToFillScreen();
      }
      this.updateMapCenter();
      // The container may have been sized (or revealed) after the map was
      // created, which leaves MapLibre stuck at its 400x300 fallback canvas.
      // Sync the canvas to the real container size now and on any later change.
      this.resizeWhenReady();
      this.observeContainerResize();
      this.cdr.detectChanges();
    });
  }

  /**
   * Watches the map container for size changes and resizes the MapLibre canvas
   * to match, so the map stays full-size when layout settles or the viewport
   * changes (e.g. an initial 0-width measurement, or mobile <-> desktop).
   */
  private observeContainerResize(): void {
    if (this.resizeObserver || !this.mapRef?.nativeElement || typeof ResizeObserver === 'undefined') {
      return;
    }
    this.resizeObserver = new ResizeObserver(() => this.map?.resize());
    this.resizeObserver.observe(this.mapRef.nativeElement);
  }

  /**
   * Resize the MapLibre canvas to match its container once the container
   * actually has width. The container can be 0-wide at init (hidden behind a
   * loading state, or measured before layout settles); retry across a few
   * frames until it has width, then sync. Stops as soon as width is real.
   */
  private resizeWhenReady(attempts = 0): void {
    if (!this.map || !this.mapRef?.nativeElement) return;
    const w = this.mapRef.nativeElement.clientWidth;
    if (w > 0) {
      const canvasW = this.map.getCanvas ? this.map.getCanvas().clientWidth : 0;
      if (Math.abs(w - canvasW) > 2) this.map.resize();
      return;
    }
    if (attempts < 20) {
      requestAnimationFrame(() => this.resizeWhenReady(attempts + 1));
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  /**
   * On changes to input properties, updates map center and re-renders features.
   * @param changes Changes to input properties
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (!this.map) return;
    if (changes['data'] && Array.isArray(this.data) && this.data.length > 0 && this.autoCenter) {
      this.updateMapCenter();
    }
    // Honour a user-selected mode over options.mode so it survives data updates.
    this.currentMode = this.userMode ?? (this.options.mode || 'normal');
    this.renderMapFeatures();
    // Data often arrives just as the map becomes visible (e.g. a dashboard
    // revealing it after a fetch). The ResizeObserver can miss that hidden->
    // visible transition, leaving the canvas at MapLibre's 400x300 fallback, so
    // re-sync to the real container size once it has width.
    if (changes['data']) {
      this.resizeWhenReady();
    }
  }

  /**
   * Changes the current map style (backend tile set) and re-renders the map features.
   * @param styleUrl The URL of the new map style to apply.
   */
  changeMapStyle(styleUrl: string): void {
    this.currentStyle = styleUrl;
    if (this.map) {
      this.map.setStyle(this.currentStyle);
      this.map.once('styledata', () => {
        this.renderMapFeatures();
      });
    }
  }

  /**
   * Changes the current map mode and re-renders the map features.
   * @param mode The mode to set for the map (e.g., 'normal', 'heatmap', 'cluster').
   */
  changeMapMode(mode: string): void {
    this.currentMode = mode;
    this.userMode = mode;
    this.renderMapFeatures();
  }

  /**
   * Resets the map by removing all markers and re-rendering the map features.
   */
  resetMap(): void {
    this.removeAllMarkers();
    this.renderMapFeatures();
  }

  /**
   * Toggles the visibility of the map panel. If opened, initializes the map.
   */
  togglePanel(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      if (this.mapRef?.nativeElement) {
        this.mapRef.nativeElement.style.width = this.options.size.width;
        this.mapRef.nativeElement.style.height = this.options.size.height;
      }
      this.initializeMap();
      setTimeout(() => {
        this.map?.resize();
      }, 0);
    }
  }

  /**
   * Initializes the map with the specified options and controls,
   * if the map container is available, then renders the map features.
   */
  private initializeMap(): void {
    if (!this.mapRef?.nativeElement) {
      console.warn('container not found — skipping initializeMap');
      return;
    }
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.map = new maplibregl.Map({
      container: this.mapRef.nativeElement,
      style: this.currentStyle,
      center: this.options.center,
      zoom: this.options.zoom || 1,
      minZoom: 1,
      maxZoom: Settings.mapTilesMaxZoom || 8,
      renderWorldCopies: false,
      attributionControl: false,
    })
      .addControl(new maplibregl.NavigationControl())
      .addControl(new maplibregl.FullscreenControl())
      .addControl(new maplibregl.ScaleControl({ maxWidth: 80, unit: 'metric' }))
      .addControl(new maplibregl.AttributionControl({ customAttribution: Settings.mapTilesAttribution }))
      .addControl(new maplibregl.GlobeControl());
    this.map.on('load', () => {
      this.renderMapFeatures();
    });

    // Cross-filter mode: a single map-level click/hover hit-test against the
    // data, so selection works regardless of the active display mode.
    if (this.clickToSelect) {
      this.map.on('click', (e: any) => {
        const hit = this.nearestPoint(e.point);
        if (hit) this.featureClick.emit(hit);
      });
      this.map.on('mousemove', (e: any) => {
        this.map.getCanvas().style.cursor = this.nearestPoint(e.point) ? 'pointer' : '';
      });
    }
  }

  /**
   * Returns the data point whose projected position is within ~22px of the given
   * screen point, or null. Used by clickToSelect mode to hit-test in any display
   * mode (the heatmap has no clickable features of its own).
   */
  private nearestPoint(screenPoint: { x: number; y: number }): any {
    if (!this.map || !Array.isArray(this.data)) return null;
    let best: any = null;
    let bestDist = Infinity;
    for (const d of this.data) {
      const lat = Number(d.latitude), lng = Number(d.longitude);
      // Skip missing or out-of-range coords — project() throws on those.
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
      let p;
      try { p = this.map.project([lng, lat]); } catch { continue; }
      const dx = p.x - screenPoint.x;
      const dy = p.y - screenPoint.y;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) { bestDist = dist; best = d; }
    }
    return best && Math.sqrt(bestDist) <= 22 ? best : null;
  }

  /**
   * Sets the map height to fill the screen minus header and resize bar heights.
   */
  setMapHeightToFillScreen() {
    const headerHeight = this.headerRef?.nativeElement.offsetHeight || 0;
    const resizeBarHeight = this.resizeBarRef?.nativeElement.offsetHeight || 0;
    const dropdownHeight = this.dropdownRef?.nativeElement.offsetHeight || 0;
    const paddingHeight = 30;
    const totalOffset = headerHeight + resizeBarHeight + dropdownHeight + paddingHeight;
    this.options.size.height = `calc(100vh - ${totalOffset + 212}px)`;
    if (this.mapRef?.nativeElement) {
      this.mapRef.nativeElement.style.height = this.options.size.height;
    }
    if (this.map) {
      this.map.resize();
    }
  }

  /**
   * Updates the map center based on the data points.
   * If no center is specified in options, calculates the center from data.
   * Also adjusts zoom level if not set or too low.
   */
  private updateMapCenter(): void {
    const center = this.options.center ? this.options.center : this.getCenterFromData();
    const zoom = this.options.zoom ? this.options.zoom : this.getAutoZoomLevel();
    if (center) {
      this.options.center = center;
      this.map.setCenter([center.lng, center.lat]);
      if (zoom) {
        this.map.setZoom(zoom);
      }
    }
  }

  /**
   * Renders map features based on the current mode (normal, heatmap, cluster).
   * Removes existing layers and markers before calling the appropriate rendering method
   * for the selected mode.
   */
  private renderMapFeatures(): void {
    if (!this.map) return;
    // addSource/addLayer throw if the style isn't loaded yet (e.g. data arrives
    // before the initial 'load', or during a base-map style swap). Defer to the
    // next idle, by which point the style is ready and this.data is current.
    if (!this.map.isStyleLoaded()) {
      this.map.once('idle', () => this.renderMapFeatures());
      return;
    }
    this.removeMapLayersAndSources();
    this.removeAllMarkers();
    const features = this.data
      .filter(item => item.latitude && item.longitude)
      .map(item => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [item.longitude, item.latitude] },
        properties: {
          value: item.options?.value || 1,
          title: item.title || '',
          color: item.options?.color || this.options.modeOptions?.color || '#0000ff',
          radius: item.options?.radius || this.options.modeOptions?.radius || 8,
          internalLink: item.internalLink || null
        }
      }));
    const geojson = { type: 'FeatureCollection', features };

    if (this.currentMode === 'heatmap') {
      this.addHeatmapLayer(geojson);
    } else if (this.currentMode === 'cluster') {
      this.addClusterLayer(geojson);
    } else if (this.currentMode === 'point') {
      this.addPointLayer(geojson);
    } else if (this.currentMode === 'bins') {
      this.addBinsLayer();
    } else {
      this.addMarkerLayer();
    }
    this.renderOverlay();   // emphasised markers + track, always on top
  }

  /**
   * Draws the optional `track` polyline and emphasised `markers` on top of the
   * data layer — e.g. a centroid and the path it has travelled. Re-rendered
   * after every data/mode change so it stays above the data.
   */
  private renderOverlay(): void {
    if (!this.map) return;
    if (!this.map.isStyleLoaded()) { this.map.once('idle', () => this.renderOverlay()); return; }
    this.removeOverlay();

    if (Array.isArray(this.overlayTrack) && this.overlayTrack.length > 1) {
      const coords = this.overlayTrack.filter(c => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]));
      if (coords.length > 1) {
        this.map.addSource('overlay-track-src', {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} }
        });
        this.map.addLayer({
          id: 'overlay-track', type: 'line', source: 'overlay-track-src',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#3e2723', 'line-width': 2, 'line-opacity': 0.65, 'line-dasharray': [1.5, 1.2] }
        });
      }
    }

    const pts = (this.overlayMarkers || []).filter(m => m && Number.isFinite(m.lat) && Number.isFinite(m.lng));
    if (pts.length) {
      this.map.addSource('overlay-markers-src', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: pts.map(m => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [m.lng, m.lat] },
            properties: { color: m.color || '#ffc107', title: m.title || '' }
          }))
        }
      });
      this.map.addLayer({
        id: 'overlay-markers-halo', type: 'circle', source: 'overlay-markers-src',
        paint: { 'circle-radius': 16, 'circle-color': ['get', 'color'], 'circle-opacity': 0.22 }
      });
      this.map.addLayer({
        id: 'overlay-markers', type: 'circle', source: 'overlay-markers-src',
        paint: {
          'circle-radius': 8, 'circle-color': ['get', 'color'],
          'circle-stroke-width': 2.5, 'circle-stroke-color': '#ffffff'
        }
      });
    }
  }

  private removeOverlay(): void {
    if (!this.map) return;
    ['overlay-markers', 'overlay-markers-halo', 'overlay-track'].forEach(id => {
      if (this.map.getLayer(id)) this.map.removeLayer(id);
    });
    ['overlay-markers-src', 'overlay-track-src'].forEach(id => {
      if (this.map.getSource(id)) this.map.removeSource(id);
    });
  }

  /**
   * Builds a point layer with interactivity.
   * Expects this.options.modeOptions to looks like...
   * {
   *   point: {
   *     paint: { ... }
   *   }
   * }
   * @param geojson geojson with datapoints to be added to the heatmap
   */
  private addPointLayer(geojson: any): void {
    let pointPaint = this.options.modeOptions?.point?.paint || {
      'circle-radius': ['coalesce', ['get', 'radius'], 8],
      'circle-color': ['coalesce', ['get', 'color'], '#0000ff'],
      'circle-stroke-width': 1,
      'circle-stroke-color': '#fff',
      'circle-opacity': 0.8
    };
    this.map.addSource('data-point-src', { type: 'geojson', data: geojson });
    this.map.addLayer({
      id: 'data-point-layer',
      type: 'circle',
      source: 'data-point-src',
      paint: pointPaint
    });
    this.map.on('click', 'data-point-layer', (e: any) => {
      const feature = e.features[0];
      if (feature.properties.internalLink) {
        this.router.navigate([feature.properties.internalLink]);
      }
    });
  }

  /**
   * Grid-binning mode: aggregate the data points into a lat/lng grid and render
   * each occupied cell as a filled square shaded (discrete sqrt levels) by its
   * total — a lightweight gridded choropleth. Reusable for any density/coverage
   * view.
   *
   * Each point contributes its `options.value` (default 1) to the cell it falls
   * in. By default the grid REFINES as you zoom in (cells halve each zoom level)
   * so detail emerges on zoom. Configurable via options.modeOptions.bins:
   *   { size?: degrees at base zoom (default 0.5), ramp?: string[] light->dark,
   *     opacity?: number, adaptive?: boolean (default true), minSize?: degrees }
   */
  private addBinsLayer(): void {
    const cfg = this.options.modeOptions?.bins || {};
    const ramp: string[] = cfg.ramp || ['#bdd7e7', '#6baed6', '#3182bd', '#08519c', '#08306b'];
    this.binsConfig = {
      baseSize: cfg.size || 0.5,
      ramp,
      opacity: cfg.opacity ?? 0.82,
      adaptive: cfg.adaptive !== false,
      // Scale the colour ramp to the darkest cell currently IN VIEW (not the
      // global max), so local variation stays visible when you zoom past
      // outliers. Recomputed on every pan/zoom.
      viewportScale: cfg.viewportScale !== false,
      baseZoom: this.options.zoom || 3,
      minSize: cfg.minSize || (cfg.size || 0.5) / 16
    };

    // Discrete colour per level (1..N) — reads variation better than a gradient.
    const matchExpr: any[] = ['match', ['get', 'level']];
    ramp.forEach((col, i) => matchExpr.push(i + 1, col));
    matchExpr.push(ramp[ramp.length - 1]);

    this.map.addSource('data-bins-src', { type: 'geojson', data: this.binsGeojson() });
    this.map.addLayer({
      id: 'data-bins-fill',
      type: 'fill',
      source: 'data-bins-src',
      paint: {
        'fill-color': matchExpr,
        'fill-opacity': this.binsConfig.opacity,
        'fill-outline-color': 'rgba(255,255,255,0.25)'
      }
    });

    // Hover shows the cell's total.
    this.binsPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 4 });
    this.map.on('mousemove', 'data-bins-fill', (e: any) => {
      const f = e.features?.[0];
      if (!f) return;
      this.map.getCanvas().style.cursor = 'pointer';
      this.binsPopup.setLngLat(e.lngLat).setHTML(`<strong>${f.properties.value}</strong>`).addTo(this.map);
    });
    this.map.on('mouseleave', 'data-bins-fill', () => {
      this.map.getCanvas().style.cursor = '';
      this.binsPopup?.remove();
    });

    // Recompute on pan/zoom: re-bin at the zoom-appropriate size and re-scale
    // the colour ramp to the cells now in view.
    if (this.binsConfig.adaptive || this.binsConfig.viewportScale) {
      this.binsViewHandler = () => {
        const src = this.map?.getSource('data-bins-src');
        if (src) src.setData(this.binsGeojson());
      };
      this.map.on('moveend', this.binsViewHandler);
    }
  }

  /** Cell size for the current zoom (halves each level in beyond base zoom). */
  private currentBinSize(): number {
    const c = this.binsConfig;
    if (!c.adaptive || !this.map) return c.baseSize;
    const steps = Math.max(0, Math.round(this.map.getZoom() - c.baseZoom));
    return Math.max(c.minSize, c.baseSize / Math.pow(2, steps));
  }

  /** Aggregate this.data into square cells of the current size; one feature each. */
  private binsGeojson(): any {
    const size = this.currentBinSize();
    const cells = new Map<string, { lat: number; lng: number; value: number }>();
    for (const item of this.data) {
      const lat = Number(item.latitude), lng = Number(item.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
      const blat = Math.floor(lat / size) * size;
      const blng = Math.floor(lng / size) * size;
      const key = blat.toFixed(4) + '|' + blng.toFixed(4);
      let c = cells.get(key);
      if (!c) { c = { lat: blat, lng: blng, value: 0 }; cells.set(key, c); }
      c.value += (item.options?.value ?? 1);
    }

    // Scale the ramp to the darkest cell IN VIEW (so local variation survives
    // big outliers like New York), falling back to the global max if the
    // viewport is empty.
    let bounds: any = null;
    if (this.binsConfig.viewportScale && this.map) { try { bounds = this.map.getBounds(); } catch { /* not ready */ } }
    let max = 0;
    for (const c of cells.values()) {
      if (bounds) {
        const clat = c.lat + size / 2, clng = c.lng + size / 2;
        if (clat < bounds.getSouth() || clat > bounds.getNorth() || clng < bounds.getWest() || clng > bounds.getEast()) continue;
      }
      if (c.value > max) max = c.value;
    }
    if (!max) for (const c of cells.values()) if (c.value > max) max = c.value;
    max = max || 1;

    const n = this.binsConfig.ramp.length;
    const sm = Math.sqrt(max);
    const features = Array.from(cells.values()).map(c => ({
      type: 'Feature',
      properties: { value: c.value, level: Math.min(n, Math.max(1, Math.ceil((Math.sqrt(c.value) / sm) * n))) },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [c.lng, c.lat], [c.lng + size, c.lat], [c.lng + size, c.lat + size], [c.lng, c.lat + size], [c.lng, c.lat]
        ]]
      }
    }));
    return { type: 'FeatureCollection', features };
  }

  /** Fit the map to the current data points (used to focus a selection). */
  fitToData(padding = 48): void {
    const b = this.boundsOfPoints(this.data);
    if (b) this.fitToBounds(b, padding);
  }

  /** Fit the map to an explicit [west, south, east, north] box. */
  fitToBounds(b: [number, number, number, number], padding = 48): void {
    if (!this.map) return;
    this.map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding, maxZoom: 9, duration: 0 });
  }

  private boundsOfPoints(pts: any[]): [number, number, number, number] | null {
    if (!Array.isArray(pts) || !pts.length) return null;
    let w = Infinity, e = -Infinity, s = Infinity, n = -Infinity;
    for (const d of pts) {
      const lat = Number(d.latitude), lng = Number(d.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
      if (lng < w) w = lng; if (lng > e) e = lng;
      if (lat < s) s = lat; if (lat > n) n = lat;
    }
    return w === Infinity ? null : [w, s, e, n];
  }

  /**
   * Builds a heatmap layer with interactivity.
   * Expects this.options.modeOptions to looks like...
   * {
   *   heat: {
   *    maxZoom: 10,
   *    paint: { ... },
   *   },
   *   point: {
   *     minZoom: 10,
   *     paint: { ... }
   *   }
   * }
   * @param geojson geojson with datapoints to be added to the heatmap
   */
  private addHeatmapLayer(geojson: any): void {
    let heatZoom = this.options.modeOptions?.heat?.maxZoom || 10;
    const customPaint = this.options.modeOptions?.heat?.paint;
    let heatPaint = customPaint || {
      // Heavier cells weigh more, capped so a single outlier doesn't dominate.
      'heatmap-weight': ['interpolate', ['linear'], ['get', 'value'], 0, 0, 10, 1],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 10, 3],
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(33,102,172,0)',
        0.2, 'rgb(103,169,207)',
        0.4, 'rgb(209,229,240)',
        0.6, 'rgb(253,219,199)',
        0.8, 'rgb(239,138,98)',
        1, 'rgb(178,24,43)'
      ],
      // Roughly-constant pixel radius so points separate (merge less) as you
      // zoom in, and blend together when zoomed out.
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 4, 5, 16, 10, 16],
      'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 1, 10, 0]
    };
    let pointZoom = this.options.modeOptions?.point?.minZoom || 10;
    let pointPaint = this.options.modeOptions?.point?.paint || {
      'circle-radius': 6,
      'circle-color': ['get', 'color'],
      'circle-stroke-width': 1,
      'circle-stroke-color': '#fff',
      'circle-opacity': 0.8
    };
    this.map.addSource('data-heatmap-src', { type: 'geojson', data: geojson });
    this.map.addLayer({
      id: 'data-heatmap',
      type: 'heatmap',
      source: 'data-heatmap-src',
      maxzoom: heatZoom,
      paint: heatPaint
    });
    // Heatmap is a density view, not a click-through one — no navigation here
    // (the discrete Points / Normal modes handle click-to-detail).
    this.map.addLayer({
      id: 'data-heatmap-points',
      type: 'circle',
      source: 'data-heatmap-src',
      minzoom: pointZoom,
      paint: pointPaint
    });

    // Auto-exposure: rescale the heatmap's colour to the points currently in
    // view, recomputed on pan/zoom (unless the host supplied custom paint).
    this.heatConfig = { viewportScale: !customPaint && this.options.modeOptions?.heat?.viewportScale !== false };
    if (this.heatConfig.viewportScale) {
      this.tuneHeatmap();
      this.heatViewHandler = () => this.tuneHeatmap();
      this.map.on('moveend', this.heatViewHandler);
    }
  }

  /**
   * Auto-expose the heatmap to the points in view: estimate the densest visible
   * cluster (a coarse viewport grid of capped per-cell weight) and set intensity
   * inversely — sparse views get brighter, dense views dimmer — so local
   * variation stays readable on pan/zoom. Only intensity is touched, so the
   * heatmap never washes out to nothing.
   */
  private tuneHeatmap(): void {
    if (!this.map || !this.map.getLayer('data-heatmap')) return;
    let bounds: any = null;
    try { bounds = this.map.getBounds(); } catch { /* not ready */ }
    const W = bounds ? bounds.getWest() : -180, E = bounds ? bounds.getEast() : 180;
    const S = bounds ? bounds.getSouth() : -90, N = bounds ? bounds.getNorth() : 90;

    const GRID = 28;
    const cells = new Map<string, number>();
    let peak = 0, any = false;
    for (const item of this.data) {
      const lat = Number(item.latitude), lng = Number(item.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (lat < S || lat > N || lng < W || lng > E) continue;
      any = true;
      const w = Math.min(1, (item.options?.value ?? 1) / 10);   // matches the weight cap
      const gx = Math.min(GRID - 1, Math.floor(((lng - W) / ((E - W) || 1)) * GRID));
      const gy = Math.min(GRID - 1, Math.floor(((lat - S) / ((N - S) || 1)) * GRID));
      const k = gx + '_' + gy;
      const nv = (cells.get(k) || 0) + w;
      cells.set(k, nv);
      if (nv > peak) peak = nv;
    }
    if (!any) peak = 1;
    peak = peak || 1;

    // Densest visible cell should land near the top of the colour ramp.
    const base = Math.max(0.8, Math.min(6, 7 / peak));
    this.map.setPaintProperty('data-heatmap', 'heatmap-intensity',
      ['interpolate', ['linear'], ['zoom'], 0, base, 10, base * 2.6]);
  }

  /**
   * Builds a cluster map layer with interactivity.
   * Expects this.options.modeOptions to looks like...
   * {
   *   cluster: {
   *    maxZoom: 10,
   *    radius: 50,
   *    paint: { ... },
   *   },
   *   point: {
   *     paint: { ... }
   *   }
   * }
   * @param geojson geojson with the datapoints for the cluster map
   */
  private addClusterLayer(geojson: any): void {
    let clusterMaxZoom = this.options.modeOptions?.cluster?.maxZoom || 14;
    let clusterRadius = this.options.modeOptions?.cluster?.radius || 50;
    let clusterPaint = this.options.modeOptions?.cluster?.paint || {
      'circle-color': [
        'step', ['get', 'point_count'],
        '#51bbd6', 10,
        '#f1f075', 30,
        '#f28cb1'
      ],
      'circle-radius': [
        'step', ['get', 'point_count'],
        15, 10, 20, 30, 25
      ]
    };
    let pointPaint = this.options.modeOptions?.point?.paint || {
      'circle-color': ['get', 'color'],
      'circle-radius': 8,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#fff'
    };
    this.map.addSource('data-cluster-src', {
      type: 'geojson',
      data: geojson,
      cluster: true,
      clusterMaxZoom: clusterMaxZoom,
      clusterRadius: clusterRadius
    });
    this.map.addLayer({
      id: 'data-cluster',
      type: 'circle',
      source: 'data-cluster-src',
      filter: ['has', 'point_count'],
      paint: clusterPaint
    });
    this.map.addLayer({
      id: 'data-cluster-count',
      type: 'symbol',
      source: 'data-cluster-src',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': 12
      }
    });
    this.map.addLayer({
      id: 'data-unclustered-point',
      type: 'circle',
      source: 'data-cluster-src',
      filter: ['!', ['has', 'point_count']],
      paint: pointPaint
    });
    this.map.on('click', 'data-cluster', (e: any) => {
      const features = this.map.queryRenderedFeatures(e.point, { layers: ['data-cluster'] });
      const clusterId = features[0].properties.cluster_id;
      (this.map.getSource('data-cluster-src') as any).getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
        if (err) return;
        this.map.easeTo({ center: features[0].geometry.coordinates, zoom });
      });
    });
    this.map.on('click', 'data-unclustered-point', (e: any) => {
      const feature = e.features[0];
      if (feature.properties.internalLink) {
        this.router.navigate([feature.properties.internalLink]);
      }
    });
    this.map.on('mouseenter', 'data-cluster', () => {
      this.map.getCanvas().style.cursor = 'pointer';
    });
    this.map.on('mouseleave', 'data-cluster', () => {
      this.map.getCanvas().style.cursor = '';
    });
  }

  /**
   * Adds individual markers to the map for each data point in normal mode.
   */
  private addMarkerLayer(): void {
    this.data.forEach(item => {
      if (item.latitude && item.longitude) {
        const marker = new maplibregl.Marker({
          color: item.options?.color || '#0000ff',
          opacity: item.options?.opacity || 1,
          scale: item.options?.scale || 1
        })
          .setLngLat([item.longitude, item.latitude])
          .setPopup(new maplibregl.Popup({ offset: 25 }).setText(item.title || 'No label'))
          .addTo(this.map);
        marker.getElement().addEventListener('click', () => {
          const link = item.internalLink;
          if (link) this.router.navigate(Array.isArray(link) ? link : [link]);
        });
        this.markers.push(marker);
      }
    });
  }

  /**
   * Removes all map layers and sources related to heatmap and cluster modes.
   */
  private removeMapLayersAndSources(): void {
    [
      'data-heatmap', 'data-heatmap-points',
      'data-cluster', 'data-cluster-count', 'data-unclustered-point',
      'data-point-layer', 'data-bins-fill'
    ].forEach(layerId => {
      if (this.map && this.map.getLayer(layerId)) {
        this.map.removeLayer(layerId);
      }
    });
    ['data-heatmap-src', 'data-cluster-src', 'data-point-src', 'data-bins-src'].forEach(srcId => {
      if (this.map && this.map.getSource(srcId)) {
        this.map.removeSource(srcId);
      }
    });
    if (this.map) {
      this.map.off('click', 'data-heatmap-points');
      this.map.off('click', 'data-cluster');
      this.map.off('click', 'data-unclustered-point');
      this.map.off('mouseenter', 'data-cluster');
      this.map.off('mouseleave', 'data-cluster');
      this.map.off('click', 'data-point-layer');
      this.map.off('mousemove', 'data-bins-fill');
      this.map.off('mouseleave', 'data-bins-fill');
      if (this.binsViewHandler) { this.map.off('moveend', this.binsViewHandler); this.binsViewHandler = undefined; }
      if (this.heatViewHandler) { this.map.off('moveend', this.heatViewHandler); this.heatViewHandler = undefined; }
      this.binsPopup?.remove();
    }
  }

  /**
   * Removes all markers from the map, when markers are used instead of layers.
   */
  private removeAllMarkers(): void {
    this.markers.forEach(marker => marker.remove());
    this.markers = [];
  }

  /**
   * Calculates the average latitude and longitude from the data points to center the map.
   * @returns {{ lat: number; lng: number } | null} Calculated lat/lng of the map center
   */
  private getCenterFromData(): { lat: number; lng: number } | null {
    if (this.data.length === 0) return null;
    if (this.data.length === 1) {
      const item = this.data[0];
      return { lat: item.latitude, lng: item.longitude };
    }
    let sumLat = 0, sumLng = 0, count = 0;
    this.data.forEach(item => {
      if (item.latitude && item.longitude) {
        sumLat += item.latitude;
        sumLng += item.longitude;
        count++;
      }
    });
    if (count === 0) return null;
    return { lat: sumLat / count, lng: sumLng / count };
  }

  /**
   * Calculates the optimal zoom level to fit all data points on the map, without being
   * too zoomed in or out.
   * @returns {integer} Optimal zoom level to display all data
   */
  private getAutoZoomLevel(): number {
    if (!Array.isArray(this.data) || this.data.length === 0) return this.options.zoom || 2;
    if (this.data.length === 1) return 12;
    // Get bounds & calculate max distance
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    this.data.forEach(item => {
      if (item.latitude && item.longitude) {
        minLat = Math.min(minLat, item.latitude);
        maxLat = Math.max(maxLat, item.latitude);
        minLng = Math.min(minLng, item.longitude);
        maxLng = Math.max(maxLng, item.longitude);
      }
    });
    const latDiff = maxLat - minLat;
    const lngDiff = maxLng - minLng;
    const maxDiff = Math.max(latDiff, lngDiff);

    // Sliding scale for zoom levels
    if (maxDiff < 0.01) return 14;
    if (maxDiff < 0.05) return 12;
    if (maxDiff < 0.2) return 10;
    if (maxDiff < 1) return 8;
    if (maxDiff < 5) return 6;
    return 2;
  }

  /**
   * Returns available map style options if multiple styles are configured.
   * @returns {Array<{ name: string; url: string }>|null} Array of map style options or null
   */
  get mapStyleOptions(): { name: string; url: string }[] | null {
    return this.multipleStyles ? Settings.mapTilesUrl : null;
  }

  /**
   * Called to trigger the start of a map resize operation.
   * @param event Mouse event
   */
  startResize(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isResizing = true;
    this.startY = event.clientY;
    this.startHeight = this.mapRef.nativeElement.offsetHeight;
  }

  /**
   * Recalculates and applies the new map height during a resize operation.
   * @param event Mouse event
   */
@HostListener('document:mousemove', ['$event'])
onMouseMove(event: MouseEvent): void {
  if (!this.isResizing) return;
  const deltaY = event.clientY - this.startY;
  const newHeight = Math.max(200, this.startHeight + deltaY);
  this.options.size.height = `${newHeight}px`;
  if (this.mapRef?.nativeElement) {
    this.mapRef.nativeElement.style.height = `${newHeight}px`;
  }
  if (this.map) {
    this.map.resize();
  }
}

  /**
   * Ends the map resize operation.
   */
  @HostListener('document:mouseup')
  onMouseUp(): void {
    this.isResizing = false;
  }
}
