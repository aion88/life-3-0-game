import {expect,it} from 'vitest';
import {spokenLine} from '../../../src/worlds/spokenLines';
import {journeys} from '../../../src/worlds/catalogue';
it('gives all 27 encounter openings spoken lines without altering their authored context',()=>{
 for(const journey of Object.values(journeys))for(let i=1;i<=3;i++){
  const scene=journey.scenes.find(s=>s.id===`encounter_${i}`)!;const before=JSON.stringify(scene);
  const line=spokenLine(journey.id,scene.id,scene.text);expect(line?.length).toBeGreaterThan(40);expect(line?.length).toBeLessThan(350);expect(JSON.stringify(scene)).toBe(before);
 }
});
it('does not attribute a third-person embedded quote to the current speaker',()=>{
 expect(spokenLine('w10','arrival','Marlène rapporte la phrase du voisin : « Je refuse. »')).toBeNull();
 expect(spokenLine('w10','plant','« Viens dîner. » Elle te tend le pot.')).toBe('Viens dîner.');
});
