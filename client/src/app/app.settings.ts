import { environment } from '../environments/environment';

// Per-environment config (which API to hit, feature flags) lives in
// src/environments/*. The active file is swapped at BUILD time by the
// fileReplacements in angular.json — never edit the URL here:
//   ng serve  /  ng build --configuration development  -> environment.ts      (local Docker, :8080)
//   ng build --configuration dev                       -> environment.dev.ts  (live dev)
//   ng build  (production is the default)              -> environment.prod.ts (live prod)
export const Settings = {
    apiUrl: environment.apiUrl,
    exportEnabled: environment.exportEnabled,
        // multiple styles (first style is the default)
    mapTilesUrl: [{
        name: 'OpenStreetMap',
        url: 'https://raw.githubusercontent.com/go2garret/maps/main/src/assets/json/openStreetMap.json',
    }, {
        name: 'Map Libre Demo Tiles',
        url: 'https://demotiles.maplibre.org/globe.json',
    }, {
        name: 'CartoDB Voyager',
        url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
    }],
    mapTilesAttribution: 'Powered by MapLibre... Use of OpenStreetMap and CartoDB for dev phase only',
    mapTilesMaxZoom: 18
};
