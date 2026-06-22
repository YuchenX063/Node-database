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
};
