import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FilterComponent } from '../../common/filter/filter.component';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import { MapVisComponent } from '../../common/map-vis/map-vis.component';
import { buildGrouping, LegendEntry } from '../../common/map-vis/map-grouping';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';

import { ApiService } from '../../../services/api.service';
import { FilterService } from '../../../services/filter.service';
import { NavigationService } from '../../../services/navigation.service';
import { HttpClient } from '@angular/common/http';

interface FilterField {
    type: string;
    label?: string;
    keyword?: string;
    active?: boolean;
    autocompleteOptions?: string[];
    keywordStart?: string;
    keywordEnd?: string;
    min?: number; 
    max?: number; 
    filteredOptions?: string[];
  }

@Component({
  selector: 'app-people-map',
  imports: [FilterComponent, MatCardModule, CommonModule, MatButtonModule, 
    MatIconModule, MatInputModule, FormsModule, MatSliderModule, MapVisComponent,
    MatSelectModule, MatFormFieldModule],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss'
})
export class MapComponent implements OnInit {

  data: any[] = [];
  groupBy: 'function' | 'diocese' = 'function';
  groupOptions = [
    { value: 'function', label: 'Function' },
    { value: 'diocese', label: 'Diocese' }
  ];
  legend: LegendEntry[] = [];
  private rawPoints: any[] = [];
  isPlaying: boolean = false;
  year: number = 1833;
  yearMin: number = 1833;
  yearMax: number = 1870;

  mapOptions: google.maps.MapOptions = {
    center: { lat: 39.8283, lng: -98.5795 },
    zoom: 4.5,
    disableDefaultUI: true,
    clickableIcons: false
  };

  filterValues$!: Observable<any>; //! = can be null
  filterValues: any = {
  };

  filterFields: FilterField [] = [
    { type: 'input', label: 'Person Name', keyword: 'persName', active: false },
    { type: 'autocomplete', label: 'Diocese', keyword: 'diocese', active: false}
  ]

  constructor(
    private _api: ApiService, 
    private filterService: FilterService, 
    private _router:Router,
    private navigationService: NavigationService,
    private http: HttpClient
  ) { }

  ngOnInit(): void {
    this.http.get('diocese.csv', { responseType: 'text' }).subscribe((data) => {
      const dioceses = data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      const dioceseFilter = this.filterFields.find(field => field.keyword === 'diocese');
      if (dioceseFilter) {
        dioceseFilter.autocompleteOptions = dioceses;
        dioceseFilter.filteredOptions = dioceses;
      }
    });
    if (this.navigationService.lastNavigationTrigger !== 'popstate') {
    this.filterService.clearFilters();
    this.filterService.setFields(this.filterFields);
  }
    this.filterValues$ = this.filterService.filterValues$;
    this.filterValues$.subscribe(values => {
      this.filterValues = values;
      this.getData();
    });

    setInterval(() => {
      if (this.isPlaying && this.year < this.yearMax) {
        this.year += 1;
        this.getData();
      }
      if (this.year >= this.yearMax) {
        this.isPlaying = false;
      };
    }, 2000);
  }

  getData() {
    
    let queryString = `?year=${this.year}`;
    if (this.filterValues.persName) {
      queryString += `&persName=${this.filterValues.persName}`;
    }
    if (this.filterValues.diocese) {
      queryString += `&diocese=${this.filterValues.diocese}`;
    }

    this._api.getTypeRequest('maps/people' + queryString).subscribe((res: any) => {
      let peopleData: any[] = [];
      for (let pers of res.rows) {
        for (let almanacRecord of pers.almanacRecords) {
          if (almanacRecord.latitude && almanacRecord.longitude) {
            let existingInst = peopleData.find(item => item.instID === almanacRecord.instID);
            if (existingInst) {
              if (!Array.isArray(existingInst.personInAlmanacRecord)) {
                existingInst.personInAlmanacRecord = [existingInst.personInAlmanacRecord];
              };
              existingInst.personInAlmanacRecord.push(almanacRecord.personInAlmanacRecord);
            } else {
              let almanacRecordCopy = { ...almanacRecord };
              if (!Array.isArray(almanacRecordCopy.personInAlmanacRecord)) {
                almanacRecordCopy.personInAlmanacRecord = [almanacRecordCopy.personInAlmanacRecord];
              };
              peopleData.push(almanacRecordCopy);
            };
          };
        }
      };
      this.rawPoints = peopleData;
      this.applyGrouping();
    })
  };

  /** Recolour the current points by the active "Colour by" field + build the legend. */
  applyGrouping() {
    const field = this.groupBy === 'diocese' ? 'diocese' : 'instFunction';
    const mode = this.groupBy === 'function' ? 'function' : 'categorical';
    const grouping = buildGrouping(this.rawPoints.map(p => p[field]), mode);
    this.legend = grouping.legend;
    this.data = this.rawPoints.map(item => ({
      latitude: item.latitude,
      longitude: item.longitude,
      title: item.instName || '',
      internalLink: item.instID ? '/institutions/' + item.instID : '',
      options: { color: grouping.colorFor(item[field]), radius: 6 }
    }));
  }

  onGroupChange() {
    this.applyGrouping();
  }

  clickMap(item: any) {
    this._router.navigate(['/institutions', item.instID]);
  };

  persDetailVisible: boolean = false;
  persDetailData: any = {};
  
  showPersDetail(event: any, item: any) {
    this.persDetailData = item;
    this.persDetailVisible = true;
  };

  hidePersDetail() {
    this.persDetailVisible = false;
    this.persDetailData = {};
  };

  togglePlay() {
    this.isPlaying = !this.isPlaying;
  }

  getCircleColor (type: string) : string {
    const colorMap : { [key: string] : string} = {
      'consecrated life institutions': '#FF0000', // red
      'religious institutions': '#5bcea8ff', // yellow
      'educational institutions': '#b300ffff', // orange
      'healthcare institutions': '#0000FF', // blue
      'charitable institutions': '#877b24ff', // green
    };
    return colorMap[type] || '#FFFFFF'; // default to white if type not found
  };
}
