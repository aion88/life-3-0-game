import {describe,it,expect,vi} from 'vitest';
import {createPlateLoader} from '../../../src/worlds/plateLoader';
describe('place image isolation',()=>{
 it('a failed secondary place does not reject the current place and can be retried',async()=>{
  const decode=vi.fn(async(url:string)=>{if(url==='secondary'&&decode.mock.calls.filter(c=>c[0]===url).length===1)throw new Error('network');});
  const plates=createPlateLoader(decode);
  const results=await Promise.allSettled([plates.load('current'),plates.load('secondary')]);
  expect(results.map(r=>r.status)).toEqual(['fulfilled','rejected']);expect(plates.ready('current')).toBe(true);expect(plates.ready('secondary')).toBe(false);
  await plates.load('secondary');expect(plates.ready('secondary')).toBe(true);expect(decode).toHaveBeenCalledTimes(3);
 });
 it('shares a pending decode and keeps successful results cached',async()=>{
  let resolve!:()=>void;const decode=vi.fn(()=>new Promise<void>(r=>{resolve=r;}));const plates=createPlateLoader(decode);
  const a=plates.load('place'),b=plates.load('place');expect(a).toBe(b);resolve();await a;await plates.load('place');expect(decode).toHaveBeenCalledTimes(1);
 });
});
