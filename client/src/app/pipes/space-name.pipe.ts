import { Pipe, PipeTransform } from '@angular/core';

// Inserts spaces into run-together place names so they read naturally:
//   "NewYorkCity"     -> "New York City"
//   "VANorthCarolina" -> "VA North Carolina"
// Display-only — the raw value is still used as the key for filtering and API
// calls, so this never changes what is sent to the server.
export function spaceName(value: string | null | undefined): string {
  if (!value) return value ?? '';
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')        // newYork  -> new York
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');  // VANorth  -> VA North
}

@Pipe({ name: 'spaceName', standalone: true })
export class SpaceNamePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return spaceName(value);
  }
}
