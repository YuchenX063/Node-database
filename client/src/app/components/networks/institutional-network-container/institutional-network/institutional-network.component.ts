import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SpaceNamePipe } from '../../../../pipes/space-name.pipe';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { ApiService } from '../../../../services/api.service';
import { NetworkGraphComponent } from "../../../common/network-graph/network-graph.component";

@Component({
  selector: 'app-institutional-network',
  imports: [
    SpaceNamePipe,
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    NetworkGraphComponent
  ],
  templateUrl: './institutional-network.component.html',
  styleUrl: './institutional-network.component.scss'
})
export class InstitutionalNetworkComponent implements OnInit, OnDestroy {
  @Input() initialState: string = '';
  @Input() initialCity: string = '';
  @Input() initialDiocese: string = '';
  loading: boolean = true;
  error: string | null = null;
  network: any = { nodes: [], edges: [] };
  networkOptions: any = {};
  truncated = false;
  totalNodes: number | null = null;
  private fetchSubscription: Subscription | null = null;

  // Filter fields
  state: string = '';
  city: string = '';
  diocese: string = '';
  instType: string = '';
  instFunction: string = '';
  language: string = '';
  order: string = '';
  startYear: number | null = null;
  endYear: number | null = null;

  // Dropdown options loaded from the CSVs in public/
  dioceseOptions: string[] = [];
  typeOptions: string[] = [];
  functionOptions: string[] = [];
  orderOptions: string[] = [];

  usStates = [
    { abbr: '', name: 'All States' },
    { abbr: 'AL', name: 'Alabama' },
    { abbr: 'AK', name: 'Alaska' },
    { abbr: 'AZ', name: 'Arizona' },
    { abbr: 'AR', name: 'Arkansas' },
    { abbr: 'CA', name: 'California' },
    { abbr: 'CO', name: 'Colorado' },
    { abbr: 'CT', name: 'Connecticut' },
    { abbr: 'DE', name: 'Delaware' },
    { abbr: 'FL', name: 'Florida' },
    { abbr: 'GA', name: 'Georgia' },
    { abbr: 'HI', name: 'Hawaii' },
    { abbr: 'ID', name: 'Idaho' },
    { abbr: 'IL', name: 'Illinois' },
    { abbr: 'IN', name: 'Indiana' },
    { abbr: 'IA', name: 'Iowa' },
    { abbr: 'KS', name: 'Kansas' },
    { abbr: 'KY', name: 'Kentucky' },
    { abbr: 'LA', name: 'Louisiana' },
    { abbr: 'ME', name: 'Maine' },
    { abbr: 'MD', name: 'Maryland' },
    { abbr: 'MA', name: 'Massachusetts' },
    { abbr: 'MI', name: 'Michigan' },
    { abbr: 'MN', name: 'Minnesota' },
    { abbr: 'MS', name: 'Mississippi' },
    { abbr: 'MO', name: 'Missouri' },
    { abbr: 'MT', name: 'Montana' },
    { abbr: 'NE', name: 'Nebraska' },
    { abbr: 'NV', name: 'Nevada' },
    { abbr: 'NH', name: 'New Hampshire' },
    { abbr: 'NJ', name: 'New Jersey' },
    { abbr: 'NM', name: 'New Mexico' },
    { abbr: 'NY', name: 'New York' },
    { abbr: 'NC', name: 'North Carolina' },
    { abbr: 'ND', name: 'North Dakota' },
    { abbr: 'OH', name: 'Ohio' },
    { abbr: 'OK', name: 'Oklahoma' },
    { abbr: 'OR', name: 'Oregon' },
    { abbr: 'PA', name: 'Pennsylvania' },
    { abbr: 'RI', name: 'Rhode Island' },
    { abbr: 'SC', name: 'South Carolina' },
    { abbr: 'SD', name: 'South Dakota' },
    { abbr: 'TN', name: 'Tennessee' },
    { abbr: 'TX', name: 'Texas' },
    { abbr: 'UT', name: 'Utah' },
    { abbr: 'VT', name: 'Vermont' },
    { abbr: 'VA', name: 'Virginia' },
    { abbr: 'WA', name: 'Washington' },
    { abbr: 'WV', name: 'West Virginia' },
    { abbr: 'WI', name: 'Wisconsin' },
    { abbr: 'WY', name: 'Wyoming' }
  ];

  constructor(private _api: ApiService, private _http: HttpClient) { }

  ngOnInit(): void {
    if (this.initialState) {
      this.state = this.initialState;
    }
    if (this.initialCity) {
      this.city = this.initialCity;
    }
    if (this.initialDiocese) {
      this.diocese = this.initialDiocese;
    }
    this.loadCsvOptions('diocese.csv', options => this.dioceseOptions = options);
    this.loadCsvOptions('types.csv', options => this.typeOptions = options);
    this.loadCsvOptions('functions.csv', options => this.functionOptions = options);
    this.loadCsvOptions('order.csv', options => this.orderOptions = options);
    this.fetchNetwork();
  }

  private loadCsvOptions(file: string, assign: (options: string[]) => void): void {
    this._http.get(file, { responseType: 'text' }).subscribe({
      next: data => assign(
        data.split('\n').map(line => line.replace(/\uFEFF/g, '').trim()).filter(line => line.length > 0)
      ),
      error: () => assign([])
    });
  }

  fetchNetwork(overrideStartYear?: number, overrideEndYear?: number): void {
    this.loading = true;
    const start = overrideStartYear ?? this.startYear;
    const end = overrideEndYear ?? this.endYear;
    let url = 'institution/network';
    const params: string[] = [];
    if (this.state) params.push('state=' + encodeURIComponent(this.state));
    if (this.city) params.push('city=' + encodeURIComponent(this.city));
    if (this.diocese) params.push('diocese=' + encodeURIComponent(this.diocese));
    if (this.instType) params.push('instType=' + encodeURIComponent(this.instType));
    if (this.instFunction) params.push('instFunction=' + encodeURIComponent(this.instFunction));
    if (this.language) params.push('language=' + encodeURIComponent(this.language));
    if (this.order) params.push('order=' + encodeURIComponent(this.order));
    if (start != null) params.push('startYear=' + start);
    if (end != null) params.push('endYear=' + end);
    if (params.length) url += '?' + params.join('&');
    this.error = null;
    // Cancel any in-flight request so a stale response can't overwrite a newer one
    this.fetchSubscription?.unsubscribe();
    this.fetchSubscription = this._api.getTypeRequest(url).subscribe({
      next: (res: any) => {
        this.network = res;
        this.truncated = !!res.truncated;
        this.totalNodes = res.totalNodes ?? null;
        this.networkOptions = this.buildDioceseGroups(res.nodes);
        this.loading = false;
      },
      error: (err: any) => {
        this.network = { nodes: [], edges: [] };
        this.truncated = false;
        this.totalNodes = null;
        this.error = err?.error?.message || 'Could not load the network. Check your connection and try again.';
        this.loading = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.fetchSubscription?.unsubscribe();
  }

  onTimeWindowChange(event: { startYear: number; endYear: number }): void {
    this.startYear = event.startYear;
    this.endYear = event.endYear;
    this.fetchNetwork(event.startYear, event.endYear);
  }

  buildDioceseGroups(nodes: any[]): any {
    // Collect unique dioceses
    const dioceses = Array.from(new Set(nodes.map(n => n.diocese || n.group || 'Unknown')));
    // Assign a color to each diocese
    const palette = [
      '#1976d2', '#388e3c', '#fbc02d', '#d32f2f', '#7b1fa2', '#0288d1', '#c2185b', '#ffa000', '#388e3c', '#455a64', '#f57c00', '#0097a7', '#afb42b', '#5d4037', '#c62828', '#00897b', '#6d4c41', '#303f9f', '#7e57c2', '#0288d1', '#43a047', '#fbc02d', '#d84315', '#8e24aa', '#1976d2', '#cddc39', '#ffb300', '#e64a19', '#009688', '#607d8b', '#fbc02d', '#d32f2f', '#7b1fa2', '#0288d1', '#c2185b', '#ffa000', '#388e3c', '#455a64', '#f57c00', '#0097a7', '#afb42b', '#5d4037', '#c62828', '#00897b', '#6d4c41', '#303f9f', '#7e57c2', '#0288d1', '#43a047', '#fbc02d', '#d84315', '#8e24aa', '#1976d2', '#cddc39', '#ffb300', '#e64a19', '#009688', '#607d8b'
    ];
    const groups: any = {};
    dioceses.forEach((d, i) => {
      groups[d] = {
        color: { background: palette[i % palette.length], border: '#333' },
        borderWidth: 2,
        shape: 'dot'
      };
    });
    return { groups };
  }

}
