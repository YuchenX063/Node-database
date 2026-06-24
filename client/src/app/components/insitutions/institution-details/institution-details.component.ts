import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterLink } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { SelectYearComponent } from '../../common/select-year/select-year.component';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GoogleMapsModule } from '@angular/google-maps';
import { Location } from '@angular/common';
import { MatIcon, MatIconModule } from '@angular/material/icon';
import { DialogComponent } from '../../common/dialog/dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MapVisComponent } from '../../common/map-vis/map-vis.component';
import { NetworkGraphComponent } from '../../common/network-graph/network-graph.component';
import { TreeGraphComponent, DendrogramNode } from '../../common/tree-graph/tree-graph.component';

import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-institution-details',
  imports: [CommonModule, MatCardModule, MatListModule, MatTableModule, MatButtonModule,
            RouterLink, SelectYearComponent, MatTooltipModule, GoogleMapsModule, MatIcon,
            MatIconModule, MatProgressSpinnerModule, MapVisComponent,
            NetworkGraphComponent, TreeGraphComponent
  ],
  templateUrl: './institution-details.component.html',
  styleUrl: './institution-details.component.scss'
})
export class InstitutionDetailsComponent implements OnInit {
  loading = true;
  itemId: any;
  data: any = {};
  mapData: any[] = [];
  dioceseInfo: any = [];
  instIDInYear: any = {};
  network: any = { nodes: [], edges: [] };
  networkTimeWindowLoading = false;
  networkStartYear: number | null = null;
  networkEndYear: number | null = null;
  dendrogramData: any = null;
  mapOptionsWide: google.maps.MapOptions = {
    center: { lat: 39.8283, lng: -98.5795 },
    zoom: 3.7,
    disableDefaultUI: true,
    clickableIcons: false
  };

  mapOptionsSmall: google.maps.MapOptions = {
    center: { lat: 39.8283, lng: -98.5795 },
    zoom: 3.4,
    disableDefaultUI: true,
    clickableIcons: false
  };

  networkOptions = {
    height: '800px',
    width: '1100px',
    nodes: {
            shape: 'dot',
            font: {
                color: '#000000',
                strokeWidth: 4,
                strokeColor: '#ffffff'
            },
            borderWidth: 2,
            scaling: {
              label: {
                min: 8,
                max: 20
              }
            },
              shadow: false
        },
        edges: {
            width: 2,
              shadow: false,
              smooth: false,
            font: {
                color: '#000000',
                strokeWidth: 3,
                strokeColor: 'rgba(255, 255, 255, 0.85)'
            },
        },
  };

  constructor(
    private _route: ActivatedRoute,
    private _api: ApiService,
    private _location: Location,
    private _router: Router,
    private _dialog: MatDialog
  ) { }

  ngOnInit () {
    // refresh the page whenever the parameter changes
    // this._route.paramMap is an observable that emits whenever the route parameters change
    // and when a new value is emitted, .subscribe is called
    this._route.paramMap.subscribe((params) => {
      this.itemId = params.get('id');
      this.getData();
    });
  }

  getData () {
    this.loading = true;
    this._api.getTypeRequest('institution/' + this.itemId).subscribe((res: any) => {
      this.data = res;
      this.buildMapData();
      this.instIDInYear = res.instIDInYear;
      this.loading = false;
      this.networkStartYear = res.year?.[0] ?? null;
      this.networkEndYear = res.year?.[res.year.length - 1] ?? null;
      this.fetchNetwork(this.networkStartYear ?? undefined, this.networkEndYear ?? undefined);
      const center = { lat: this.data.latitude, lng: this.data.longitude };
      if (window.innerWidth < 768) {
        this.mapOptionsSmall = { ...this.mapOptionsSmall, center, zoom: 7 };
      } else {
        this.mapOptionsWide = { ...this.mapOptionsWide, center, zoom: 7 };
      }
      this._api.getTypeRequest('institution/' + this.itemId + '/dendrogram').subscribe((dendrogramRes: any) => {
        this.dendrogramData = dendrogramRes;
      });
    });
  }

  /** Shape the single institution into the marker array the map-vis component expects. */
  private buildMapData (): void {
    if (this.data?.latitude && this.data?.longitude) {
      // The aggregated detail record exposes instID as an array (one per year);
      // use the route id (always a scalar) for the marker's navigation target.
      const id = this.itemId ?? (Array.isArray(this.data.instID) ? this.data.instID[0] : this.data.instID);
      this.mapData = [{
        latitude: this.data.latitude,
        longitude: this.data.longitude,
        title: Array.isArray(this.data.instName) ? this.data.instName[0] : (this.data.instName || ''),
        internalLink: id ? ['/institutions', id] : null
      }];
    } else {
      this.mapData = [];
    }
  }

  fetchDendrogram (year?: number) {
    let url = 'institution/' + this.itemId + '/dendrogram';
    if (year != null) url += '?year=' + year;
    this._api.getTypeRequest(url).subscribe({
      next: (dendrogramRes: any) => {
        this.dendrogramData = dendrogramRes;
      },
      error: () => {
        this.dendrogramData = null;
      }
    });
  }

  fetchNetwork (startYear?: number, endYear?: number) {
    this.networkTimeWindowLoading = true;
    let url = 'institution/' + this.itemId + '/network';
    const params: string[] = [];
    if (startYear != null) params.push('startYear=' + startYear);
    if (endYear != null) params.push('endYear=' + endYear);
    if (params.length) url += '?' + params.join('&');
    this._api.getTypeRequest(url).subscribe({
      next: (networkRes: any) => {
        this.network = networkRes;
        this.networkTimeWindowLoading = false;
      },
      error: () => {
        this.network = { nodes: [], edges: [] };
        this.networkTimeWindowLoading = false;
      }
    });
  }

  onNetworkTimeWindowChange (event: { startYear: number; endYear: number }) {
    this.networkStartYear = event.startYear;
    this.networkEndYear = event.endYear;
    this.fetchNetwork(event.startYear, event.endYear);
  }

  /**
   * when a user clicks the year button, the child component emits the variable year and the yearSelected event
   * @param year 
   */
  onYearSelected (year: number | string) {
    //this.loading = true;
    if (year === 'All') {
      this.dioceseInfo = [];
      this.getData();
      this.fetchDendrogram();
    } else {
      const y = Number(year);
      this.networkStartYear = y;
      this.networkEndYear = y;
      this.fetchNetwork(y, y);
      this._api.getTypeRequest('institution/' + this.instIDInYear[String(year)][0] + '/' + year).subscribe((res: any) => {
      this.loading = false;
      const allYears = this.data.year;
      this.data = res;
      this.data.year = allYears;
      this.buildMapData();
      this.itemId = this.data.instID;
      this.fetchDendrogram(y);
      this._api.getTypeRequest('diocese?diocese=' + this.data.diocese[0] + '&year=' + year).subscribe((dioceseInfoData: any) => {
        this.dioceseInfo = dioceseInfoData;
    })});}
  };

  goBack (): void {
    if (window.history.length > 1) {
      this._location.back();
    } else {
      this._router.navigate(['/institutions']);
    }
  };

  onDendrogramNodeDoubleClick(node: DendrogramNode): void {
    if (node.instID) {
      this._router.navigate(['/institutions', node.instID]);
    }
  }

  displayDioceseInfo () {
    if (this.dioceseInfo.length > 0) {
      const dialogRef = this._dialog.open(DialogComponent, {
        data: {
          diocese: this.dioceseInfo[0].diocese,
          year: this.dioceseInfo[0].year,
          dioceseInfo: this.dioceseInfo[0].dioceseInfo
        }
      });
    }
  }
}
