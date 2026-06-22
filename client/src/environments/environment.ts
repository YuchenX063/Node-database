// DEFAULT environment — local development against the Docker container.
// Used by `ng serve` and `ng build --configuration development`.
// The other files in this folder are swapped in at build time via the
// fileReplacements in angular.json (see app.settings.ts for the map).
export const environment = {
  name: 'local',
  production: false,
  apiUrl: 'http://localhost:8080/api/',
  exportEnabled: false,
};
