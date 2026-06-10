import { Routes } from '@angular/router';

import { HomeComponent } from './components/home/home.component';
import { NotFoundComponent } from './components/common/not-found/not-found.component';
import { AboutComponent } from './components/common/about/about.component'; 
import { BrowseInstitutionComponent } from './components/insitutions/browse-institution/browse-institution.component';
import { InstitutionDetailsComponent } from './components/insitutions/institution-details/institution-details.component';
import { BrowsePeopleComponent } from './components/people/browse-people/browse-people.component';
import { PersonDetailsComponent } from './components/people/person-details/person-details.component';
import { ExportComponent } from './components/export/export.component';
import { MapComponent as InstitutionMapComponent } from './components/insitutions/map/map.component';
import { MapComponent as PeopleMapComponent } from './components/people/map/map.component';
import { MapComponent as DioceseMapComponent } from './components/dioceses/map/map.component';
import { NetworksComponent } from './components/networks/networks.component';
import { InstitutionalNetworkContainerComponent } from './components/networks/institutional-network-container/institutional-network-container.component';
import { PersonalNetworkContainerComponent } from './components/networks/personal-network-container/personal-network-container.component';
import { MapsComponent } from './components/maps/maps.component';

export const routes: Routes = [
    { path: '', component: HomeComponent },
    { path: 'about', component: AboutComponent },
    { path: 'institutions', component: BrowseInstitutionComponent },
    { path: 'institutions/map', component: InstitutionMapComponent },
    { path: 'institutions/:id', component: InstitutionDetailsComponent },
    { path: 'people', component: BrowsePeopleComponent},
    { path: 'people/map', component: PeopleMapComponent },
    { path: 'people/:id', component: PersonDetailsComponent }, 
    { path: 'dioceses/map', component: DioceseMapComponent },
    { path: 'networks', component: NetworksComponent },
    { path: 'networks/institutional', component: InstitutionalNetworkContainerComponent },
    { path: 'networks/personal', component: PersonalNetworkContainerComponent },
    { path: 'maps', component: MapsComponent },
    { path: 'export', component: ExportComponent },
    // Static content pages: drop .md or .html files into client/public/page-content/
    // and they are served at /pages/<file path without extension>
    // Lazy-loaded so the markdown parser stays out of the initial bundle
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
