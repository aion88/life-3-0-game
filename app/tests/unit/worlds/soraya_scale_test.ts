// @vitest-environment happy-dom
import { afterEach, expect, test, vi } from 'vitest';
import { Box3, Vector3 } from 'three';
import { buildSorayaRoom } from '../../../src/worlds/sorayaRoom';

afterEach(()=>vi.restoreAllMocks());
test('the witness room uses human-scale furniture and an adult-sized doorway',()=>{
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({fillRect:()=>{}} as never);
  const room=buildSorayaRoom(); room.group.updateMatrixWorld(true);
  const bounds=(name:string)=>{ const object=room.group.getObjectByName(name); expect(object, name).toBeDefined(); return new Box3().setFromObject(object!,true); };
  try {
    // Ergonomic ranges are in metres, independent of camera perspective or pixel size.
    const seat=bounds('home.chair-seat'); expect(seat.max.y).toBeGreaterThan(.43); expect(seat.max.y).toBeLessThan(.49);
    const chair=bounds('home.dining-chair'); expect(chair.max.y).toBeLessThan(1.05);
    const table=bounds('home.table-top'); expect(table.max.y).toBeGreaterThan(.73); expect(table.max.y).toBeLessThan(.81);
    const doorway=bounds('home.door.unlocked').getSize(new Vector3()); expect(doorway.y).toBeGreaterThan(2); expect(doorway.y).toBeLessThan(2.25);
    const bed=bounds('home.bed').getSize(new Vector3()); expect(bed.x).toBeGreaterThan(1.9); expect(bed.x).toBeLessThan(2.3);
    const mattress=bounds('home.linen-mattress'); expect(mattress.max.y).toBeGreaterThan(.4); expect(mattress.max.y).toBeLessThan(.55);
    // The shortest measured character is about 1.50 m: chair backs stay well below the head.
    expect(chair.max.y / 1.50).toBeLessThan(.7);
  } finally { room.dispose(); }
});
