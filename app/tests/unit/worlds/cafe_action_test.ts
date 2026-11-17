import {expect,it} from 'vitest';
import {cafeAction,newCafeAction} from '../../../src/worlds/cafeActionState';
it('objects reveal the situation before the power decision',()=>{
 const start=newCafeAction();expect(cafeAction(start,'rescue')).toBe(start);const radio=cafeAction(start,'radio');expect(radio.phase).toBe('prepare');expect(cafeAction(radio,'radio')).toBe(radio);expect(cafeAction(radio,'reply').phase).toBe('choose');
});
it('power allocation changes who actually reaches the shelter, with no duplicate rewards',()=>{
 const choose=cafeAction(cafeAction(newCafeAction(),'radio'),'reply');
 const light=cafeAction(choose,'light'),radio=cafeAction(choose,'rescue');
 expect(light).toMatchObject({sheltered:6,father:'bridge',power:'light'});expect(radio).toMatchObject({sheltered:3,father:'shelter',power:'radio'});expect(cafeAction(light,'rescue')).toBe(light);expect(cafeAction(radio,'rescue')).toBe(radio);expect(cafeAction(radio,'restart')).toEqual(newCafeAction());
});
