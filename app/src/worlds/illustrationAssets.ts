import illustrations from './illustrations.json';
import './illustratedView.css';
export type Plate = { atlas: string; tile: number; full?: boolean; extension?: 'jpg' | 'png'; actorSpots?: [[number, number], [number, number]]; actorHeights?: [number, number] };
export const illustratedLocations = illustrations as unknown as Record<string, Record<string, Plate>>;
export function plateUrl(plate: Plate): string {
  return `${import.meta.env.BASE_URL}illustrated/${plate.atlas}.${plate.extension ?? 'jpg'}`;
}
export function plateStyle(plate: Plate): string {
  const size = plate.full ? '100% 100%' : '200% 200%';
  const position = plate.full ? 'center' : `${plate.tile % 2 * 100}% ${Math.floor(plate.tile / 2) * 100}%`;
  return `background-image:url("${plateUrl(plate)}");background-size:${size};background-position:${position}`;
}
