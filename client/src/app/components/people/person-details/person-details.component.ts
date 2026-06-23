import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { RouterLink, Router } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { SelectYearComponent } from '../../common/select-year/select-year.component';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIcon, MatIconModule } from '@angular/material/icon';
import { Location } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MapVisComponent } from '../../common/map-vis/map-vis.component';
import { NetworkGraphComponent } from '../../common/network-graph/network-graph.component';

import { ApiService } from '../../../services/api.service';


@Component({
  selector: 'app-person-details',
  imports: [CommonModule, MatCardModule, MatListModule, MatTableModule, MatButtonModule,
    RouterLink, SelectYearComponent, MatTooltipModule, MatIconModule,
    MatIcon, MatProgressSpinnerModule, MapVisComponent, NetworkGraphComponent],
  templateUrl: './person-details.component.html',
  styleUrl: './person-details.component.scss'
})


export class PersonDetailsComponent implements OnInit{
  loading = true;
  itemId: any;
  data: any = [];
  mapData: any[] = [];
  network: any = { nodes: [], edges: [] };
  networkTimeWindowLoading = false;
  networkStartYear: number | null = null;
  networkEndYear: number | null = null;
  get longestName(): string {
    if (!this.data?.name || !Array.isArray(this.data.name)) return '';
    return this.data.name.reduce((a: string, b: string) => a.length > b.length ? a : b, '');
  }

  constructor(
    private _route: ActivatedRoute,
    private _api: ApiService,
    private _router: Router,
    private _location: Location,
  ) {}

  ngOnInit () {
    this.itemId = this._route.snapshot.paramMap.get('id');
    this.getData();
  }

  getData () {
    this.loading = true;
    this._api.getTypeRequest('person/' + this.itemId).subscribe((res: any) => {
      this.data = res;
      this.buildMapData();
      this.loading = false;
      this.networkStartYear = res.year?.[0] ?? null;
      this.networkEndYear = res.year?.[res.year.length - 1] ?? null;
      this.fetchNetwork(this.networkStartYear ?? undefined, this.networkEndYear ?? undefined);
    });
  }

  /** Shape this person's institutions into the marker array the map-vis component expects. */
  private buildMapData (): void {
    const insts = Array.isArray(this.data?.allInstitutions) ? this.data.allInstitutions : [];
    this.mapData = insts
      .filter((inst: any) => inst?.latitude && inst?.longitude)
      .map((inst: any) => ({
        latitude: inst.latitude,
        longitude: inst.longitude,
        title: inst.instName || '',
        internalLink: inst.instID ? ['/institutions', inst.instID] : null
      }));
  }

  fetchNetwork (startYear?: number, endYear?: number) {
    this.networkTimeWindowLoading = true;
    let url = 'person/' + this.itemId + '/network';
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

  onYearSelected (year: number | string) {
    //this.loading = true;
    if (year === 'All') {
      this.getData();
    } else {
      const y = Number(year);
      this.networkStartYear = y;
      this.networkEndYear = y;
      this.fetchNetwork(y, y);
      this._api.getTypeRequest('person/' + this.data.persID + '/' + year).subscribe((res: any) => {
      this.loading = false;
      const allYears = this.data.year;
      this.data = res;
      this.data.year = allYears;
      this.buildMapData();
      this.itemId = this.data.persID;
      });
  }};

  goBack (): void {
    if (window.history.length > 1) {
      this._location.back();
    } else {
      this._router.navigate(['/people']);
    }
  }
}
