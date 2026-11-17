import { expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { journeys } from '../../../src/worlds/catalogue';
import illustrations from '../../../src/worlds/illustrations.json';
import type { Plate } from '../../../src/worlds/illustrationAssets';

it('supplies a distinct existing illustration for every playable journey location', () => {
 const plates = illustrations as unknown as Record<string, Record<string, Plate>>;
 const used = new Set<string>();
 for (const journey of Object.values(journeys)) for (const location of journey.locations) {
  const plate = plates[journey.id]?.[location.id]; expect(plate, `${journey.id}/${location.id}`).toBeDefined();
  const key = `${plate!.atlas}:${plate!.tile}`; expect(used.has(key),key).toBe(false); used.add(key);
 }
 for (const [world,locations] of Object.entries(plates)) for (const [location,plate] of Object.entries(locations)) {
  expect(existsSync(`public/illustrated/${plate.atlas}.${plate.extension ?? 'jpg'}`)).toBe(true);
  expect(plate.tile).toBeGreaterThanOrEqual(0); expect(plate.tile).toBeLessThan(4);
  if (plate.full) expect(plate.tile).toBe(0);
  if (plate.actorSpots) {
   expect(plate.actorSpots).toHaveLength(2);
   for (const spot of plate.actorSpots) {
    expect(spot).toHaveLength(2);
    for (const coordinate of spot) { expect(Number.isFinite(coordinate)).toBe(true); expect(coordinate).toBeGreaterThan(0); expect(coordinate).toBeLessThan(1); }
   }
  }
  if(!['w07','w12'].includes(world)&&location!=='dinner.insert'){
   expect(plate.actorHeights,`${world}/${location}: explicit human scale`).toHaveLength(2);
   for(const [i,height] of plate.actorHeights!.entries()){
    expect(height).toBeGreaterThanOrEqual(.25);expect(height).toBeLessThanOrEqual(.6);
    expect(plate.actorSpots![i]![1]-height).toBeGreaterThan(.1);
   }
  }
 }
 expect(plates.w07?.end).not.toEqual(plates.w12?.end);
});
