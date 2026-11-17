import {expect,it} from 'vitest';
import {existsSync} from 'node:fs';
import {castMember,castBodies} from '../../../src/worlds/cast';
import {journeys} from '../../../src/worlds/catalogue';
it('uses distinct existing models for Nadia, mother and registry agent',()=>{
 const people=['NADIA','MARLÈNE','L’AGENTE'].map(s=>castMember('w10',s)!);
 expect(new Set(people.map(p=>p.body)).size).toBe(3);
 expect(castMember('w10','TA MÈRE')).toEqual(castMember('w10','MARLÈNE'));
 for(const p of people)expect(existsSync(`public/worlds/w10/characters/char.${p.body}.glb`)).toBe(true);
});
it('every authored human speaker has a model, with no human stand-in for AI or recordings',()=>{
 for(const j of Object.values(journeys)){
  expect(castBodies(j.id).length).toBeGreaterThanOrEqual(3);
  for(const s of j.scenes){if(s.ending||['L’ORACLE','L’ÉLÈVE'].includes(s.speaker))continue;const p=castMember(j.id,s.speaker);expect(p,`${j.id}/${s.speaker}`).not.toBeNull();expect(existsSync(`public/worlds/w10/characters/char.${p!.body}.glb`)).toBe(true);}
 }
 for(const s of ['TON FRÈRE · MESSAGE ENREGISTRÉ','LA CABINE','LE CONTRÔLE'])expect(castMember('w10',s)).toBeNull();
});
