import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { Settings } from '../../../app.settings';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ThemeService } from '../../../services/theme.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-sidenav',
  imports: [MatListModule, CommonModule, MatButtonModule, MatSlideToggleModule],
  templateUrl: './sidenav.component.html',
  styleUrl: './sidenav.component.scss'
})
export class SidenavComponent implements OnInit {
  @Output() menuClicked = new EventEmitter<void>();

  isDarkTheme$: Observable<boolean> = new Observable<boolean>();
  isDarkTheme: boolean = false;

  navItems = [
    {
      name: 'Home',
      route: ''
    },
    {
      name: 'Institutions',
      route: 'institutions'
    },
    {
      name: 'People',
      route: 'people'
    },
    {
      name: 'Dashboards',
      route: 'dashboards'
    }
  ]

  constructor (private _router: Router, private themeService: ThemeService) { 
  }

  ngOnInit(): void {
    this.isDarkTheme$ = this.themeService.isDarkTheme$;
    this.isDarkTheme$.subscribe(values => {
      this.isDarkTheme = values;
    });
    if (Settings.exportEnabled) {
      this.navItems.push({
        name: 'Export',
        route: 'export'
      });
    }
  }

  // routerLink is used in HTMLs to navigate to different routes; navigate() is used in TypeScript and can add other logic
  navigate(path: string) {
    this._router.navigate([path]);
    this.menuClicked.emit();
  }

  toggleThemeState() {
    this.themeService.setTheme(!this.isDarkTheme);
  }
}
