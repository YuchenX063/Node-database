import { Component } from '@angular/core';
import { Router } from '@angular/router';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-dashboards',
  imports: [MatIconModule, MatButtonModule, MatCardModule],
  templateUrl: './dashboards.component.html',
  styleUrl: './dashboards.component.scss'
})
export class DashboardsComponent {

  constructor(private router: Router) { }

  navigate(path: string) {
    this.router.navigate([path]);
  }

}
