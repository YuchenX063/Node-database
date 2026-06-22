import { Component, OnInit} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FilterComponent } from '../../common/filter/filter.component';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatInput, MatInputModule } from '@angular/material/input';
import { FormsModule } from  '@angular/forms';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import { MapComponent as CommonMapComponent} from '../../common/map/map.component';

import { ApiService } from '../../../services/api.service';
import { FilterService } from '../../../services/filter.service';
import { NavigationService } from '../../../services/navigation.service';

@Component({
  selector: 'app-diocese-map',
  imports: [FilterComponent, MatCardModule, CommonModule, 
    MatButtonModule, MatIconModule, MatSliderModule, MatInputModule, FormsModule,
    CommonMapComponent],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss'
})
export class MapComponent {
  data: any[] = [];
  isPlaying: boolean = false;
  year: number = 1833;
  yearMin: number = 1833;
  yearMax: number = 1870;

  private dioceseColorMap: { [key: string]: string } = {};

  mapOptions: google.maps.MapOptions = {
    center: { lat: 39.8283, lng: -98.5795 },
    zoom: 4.5,
    disableDefaultUI: true,
    clickableIcons: false
  };

  filterValues$!: Observable<any>; //! = can be null
  filterValues: any = {
  };

  filterFields = [
    //{ type: 'slider', label: 'Year', keyword: 'year', min: 1830, max: 1870, active: true, defaultValue: '1864'},
    { type: 'input', label: 'Institution Type', keyword: 'instType', active: false},
    { type: 'input', label: 'Institution Name', keyword: 'instName', active: false},
  ]

  constructor(
    private _api: ApiService, 
    private filterService: FilterService, 
    private _router:Router,
    private navigationService: NavigationService
  ) { 
    this.initDioceseColorMap();
  }

  ngOnInit(): void {
    if (this.navigationService.lastNavigationTrigger !== 'popstate') {
    this.filterService.clearFilters();
    this.filterService.setFields(this.filterFields);
  }
    this.filterValues$ = this.filterService.filterValues$;
    this.filterValues$.subscribe(values => {
      this.filterValues = values;
      this.getData();
    });
    
    setInterval (() => {
      if (this.isPlaying && this.year < this.yearMax) {
        this.year += 1;
        this.getData();
      };
      if (this.isPlaying && this.year >= this.yearMax) {
        this.isPlaying = false;
      }
    }, 2000);
  }

  getData() {
    
    let queryString = '';
    //if (this.filterValues.year) {
    //  queryString = `?year=${this.filterValues.year}`;
    //};
    queryString = `?year=${this.year}`;
    // do not yet have these filters on the backend
    if (this.filterValues.instType) {
      queryString += queryString ? `&instType=${this.filterValues.instType}` : `?instType=${this.filterValues.instType}`;
    };
    if (this.filterValues.instName) {
      queryString += queryString ? `&instName=${this.filterValues.instName}` : `?instName=${this.filterValues.instName}`;
    };

    this._api.getTypeRequest('maps/dioceses' + queryString).subscribe((res: any) => {
      let institutionData: any[] = [];
      for (let item of res.rows) {
        for (let almanacRecord of item.almanacRecords) {
          if (almanacRecord.latitude && almanacRecord.longitude) {
            institutionData.push(Object.assign(almanacRecord));
          }
        }
      };
      this.data = institutionData;
      this.data = this.data.map(item => ({
        ...item,
        color: this.getCircleColor(item.diocese_reg)
      }));
    })
  };

  clickMap(item: any) {
    this._router.navigate(['/institutions', item.instID]);
  };

  instDetailVisible: boolean = false;
  instDetailData: any = {};
  
  showInstDetail(event: any, item: any) {
    this.instDetailData = item;
    this.instDetailVisible = true;
  };

  hideInstDetail() {
    this.instDetailVisible = false;
    this.instDetailData = {};
  };

  private initDioceseColorMap() {
    const colorPalette = [
      '#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33',
      '#a65628', '#f781bf', '#999999', '#1b9e77', '#d95f02', '#7570b3',
      '#e7298a', '#66a61e', '#e6ab02', '#a6761d', '#666666',
    ];
    const dioceseList = [
      'Albany', 'Alton', 'Baltimore', 'Bardstown', 'Boston', 'Brooklyn', 'Buffalo', 'Burlington',
      'Charleston', 'Chicago', 'Cincinnati', 'Cleveland', 'Columbus', 'Covington', 'Detroit', 'Dubuque',
      'Erie', 'FortWayne', 'Galveston', 'GrassValley', 'GreenBay', 'Harrisburg', 'Hartford', 'LaCrosse',
      'LittleRock', 'Louisville', 'Marquette', 'Milwaukee', 'Mobile', 'Monterey', 'Nashville', 'Natchez',
      'Natchitoches', 'Nesqualy', 'NewOrleans', 'NewYorkCity', 'Newark', 'OregonCity', 'Philadelphia',
      'Pittsburgh', 'Portland', 'Richmond', 'Rochester', 'SanFrancisco', 'SantaFe', 'Savannah', 'Scranton',
      'StJoseph', 'StLouis', 'StPaul', 'VAColoradoUtah', 'VAFlorida', 'VAIdaho', 'VAKansas',
      'VAMarysvilleCalifornia', 'VANebraska', 'VANorthCarolina', 'Vincennes', 'Wheeling', 'Wilmington'
    ];
    const normalized = (name: string) => name.replace(/\s+/g, '').replace(/[^a-zA-Z]/g, '').toLowerCase();
    dioceseList.forEach((d, i) => {
      this.dioceseColorMap[normalized(d)] = colorPalette[i % colorPalette.length];
    });
  }

  getCircleColor(diocese: string): string {
    const normalized = (name: string) => name.replace(/\s+/g, '').replace(/[^a-zA-Z]/g, '').toLowerCase();
    return this.dioceseColorMap[normalized(diocese)] || '#FFFFFF';
  }

  togglePlay () {
    this.isPlaying = !this.isPlaying;
  }
}
