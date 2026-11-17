import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import plates from '../../../src/worlds/illustrations.json';
import {imageDimensions} from '../../../tools/image-dimensions';
it('every shipped scene has a real full-frame source of at least 1600 × 900',()=>{
 let count=0;
 for(const [world,places] of Object.entries(plates))for(const [place,plate] of Object.entries(places)){
  const p=plate as {atlas:string;full?:boolean;extension?:string};const label=`${world}/${place}`;
  expect(p.full,label).toBe(true);
  const bytes=readFileSync(resolve(`public/illustrated/${p.atlas}.${p.extension??'jpg'}`));
  const {width,height}=imageDimensions(bytes);expect(width,label).toBeGreaterThanOrEqual(1600);expect(height,label).toBeGreaterThanOrEqual(900);count++;
 }
 expect(count).toBeGreaterThanOrEqual(48);
});
