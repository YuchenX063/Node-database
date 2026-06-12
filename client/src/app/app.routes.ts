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
    { path: 'institutions/map', loadComponent: () => import('./components/insitutions/map/map.component').then(m => m.MapComponent) },
    { path: 'institutions/:id', loadComponent: () => import('./components/insitutions/institution-details/institution-details.component').then(m => m.InstitutionDetailsComponent) },
    { path: 'people', loadComponent: () => import('./components/people/browse-people/browse-people.component').then(m => m.BrowsePeopleComponent) },
    { path: 'people/map', loadComponent: () => import('./components/people/map/map.component').then(m => m.MapComponent) },
    { path: 'people/:id', loadComponent: () => import('./components/people/person-details/person-details.component').then(m => m.PersonDetailsComponent) },
    { path: 'dioceses/map', loadComponent: () => import('./components/dioceses/map/map.component').then(m => m.MapComponent) },
    { path: 'networks', loadComponent: () => import('./components/networks/networks.component').then(m => m.NetworksComponent) },
    { path: 'networks/institutional', loadComponent: () => import('./components/networks/institutional-network-container/institutional-network-container.component').then(m => m.InstitutionalNetworkContainerComponent) },
    { path: 'networks/personal', loadComponent: () => import('./components/networks/personal-network-container/personal-network-container.component').then(m => m.PersonalNetworkContainerComponent) },
    { path: 'networks/bipartite', loadComponent: () => import('./components/networks/bipartite-network/bipartite-network.component').then(m => m.BipartiteNetworkComponent) },
    { path: 'maps', loadComponent: () => import('./components/maps/maps.component').then(m => m.MapsComponent) },
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
