import { Routes } from '@angular/router';

import { HomeComponent } from './components/home/home.component';
import { NotFoundComponent } from './components/common/not-found/not-found.component';
import { AboutComponent } from './components/common/about/about.component';

// Heavy feature areas (vis-network, d3, leaflet, google maps) are lazy-loaded
// so the initial bundle stays small.
export const routes: Routes = [
    { path: '', component: HomeComponent },
    { path: 'about', component: AboutComponent },
    { path: 'institutions', loadComponent: () => import('./components/insitutions/browse-institution/browse-institution.component').then(m => m.BrowseInstitutionComponent) },
    { path: 'institutions/:id', loadComponent: () => import('./components/insitutions/institution-details/institution-details.component').then(m => m.InstitutionDetailsComponent) },
    { path: 'people', loadComponent: () => import('./components/people/browse-people/browse-people.component').then(m => m.BrowsePeopleComponent) },
    { path: 'people/:id', loadComponent: () => import('./components/people/person-details/person-details.component').then(m => m.PersonDetailsComponent) },
    { path: 'dashboards', loadComponent: () => import('./components/dashboards/dashboards.component').then(m => m.DashboardsComponent) },
    { path: 'dashboards/composition', loadComponent: () => import('./components/dashboards/composition/composition.component').then(m => m.CompositionDashboardComponent) },
    { path: 'dashboards/people-composition', loadComponent: () => import('./components/dashboards/people-composition/people-composition.component').then(m => m.PeopleCompositionDashboardComponent) },
    { path: 'dashboards/comparison', loadComponent: () => import('./components/dashboards/comparison/comparison.component').then(m => m.ComparisonDashboardComponent) },
    { path: 'dashboards/people-comparison', loadComponent: () => import('./components/dashboards/people-comparison/people-comparison.component').then(m => m.PeopleComparisonDashboardComponent) },
    { path: 'dashboards/subset-vs-whole', loadComponent: () => import('./components/dashboards/subset-vs-whole/subset-vs-whole.component').then(m => m.SubsetVsWholeDashboardComponent) },
    { path: 'dashboards/people-subset-vs-whole', loadComponent: () => import('./components/dashboards/people-subset-vs-whole/people-subset-vs-whole.component').then(m => m.PeopleSubsetVsWholeDashboardComponent) },
    { path: 'dashboards/clergy-hierarchy', loadComponent: () => import('./components/dashboards/people-hierarchy/people-hierarchy.component').then(m => m.PeopleHierarchyDashboardComponent) },
    { path: 'dashboards/spread', loadComponent: () => import('./components/dashboards/spread/spread.component').then(m => m.SpreadDashboardComponent) },
    { path: 'dashboards/diocese-tracker', loadComponent: () => import('./components/dashboards/diocese-tracker/diocese-tracker.component').then(m => m.DioceseTrackerDashboardComponent) },
    { path: 'dashboards/network-institutions', loadComponent: () => import('./components/networks/institutional-network-container/institutional-network-container.component').then(m => m.InstitutionalNetworkContainerComponent) },
    { path: 'dashboards/network-people', loadComponent: () => import('./components/networks/personal-network-container/personal-network-container.component').then(m => m.PersonalNetworkContainerComponent) },
    { path: 'dashboards/network-service', loadComponent: () => import('./components/networks/bipartite-network/bipartite-network.component').then(m => m.BipartiteNetworkComponent) },
    { path: 'dashboards/explore-institutions', loadComponent: () => import('./components/insitutions/map/map.component').then(m => m.MapComponent) },
    { path: 'dashboards/explore-people', loadComponent: () => import('./components/people/map/map.component').then(m => m.MapComponent) },
    { path: 'export', loadComponent: () => import('./components/export/export.component').then(m => m.ExportComponent) },
    // Static content pages: drop .md or .html files into client/public/page-content/
    // and they are served at /pages/<file path without extension>
    {
        path: 'pages',
        children: [{
            path: '**',
            loadComponent: () => import('./components/pages/page.component').then(m => m.PageComponent)
        }]
    },
    { path: '404', component: NotFoundComponent },
    { path: '**', redirectTo: '/404' }
];
