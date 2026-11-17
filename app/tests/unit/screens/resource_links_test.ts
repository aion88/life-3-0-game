import {describe,it,expect} from 'vitest';
import {cleanResourceUrl,resourceLinks} from '../../../tools/resource-links';
import resources from '../../../src/screens/lang/resources.json';
import ledger from '../../../../research/atlas/ledger.json';
import {QUESTION_SOURCES} from '../../../src/screens/questionnaire/help';
describe('research source URL integrity',()=>{
 it('removes prose punctuation without removing balanced URL parentheses',()=>{
  expect(cleanResourceUrl('https://example.org/paper).')).toBe('https://example.org/paper');
  expect(cleanResourceUrl('https://example.org/Title_(film)).')).toBe('https://example.org/Title_(film)');
 });
 it('extracts markdown destinations with parentheses and bare links exactly once',()=>{
  expect(resourceLinks('[Film](https://example.org/Title_(film)) and (https://example.org/paper).')).toEqual([{url:'https://example.org/Title_(film)',title:'Film'},{url:'https://example.org/paper'}]);
 });
 it('ships only well-formed unique research URLs and valid cited references',()=>{
  const urls=resources.map(r=>r.url);
  expect(new Set(urls.map(u=>u.replace(/\/$/,''))).size).toBe(urls.length);
  for(const url of [...urls,...Object.values(QUESTION_SOURCES).map(s=>s!.url)]){
   expect(new URL(url).protocol).toBe('https:');
   expect(cleanResourceUrl(url)).toBe(url);
   expect((url.match(/\)/g)??[]).length).toBe((url.match(/\(/g)??[]).length);
  }
 });
 it('Q07 points to the UN Geneva account of the CCW and autonomous weapons',()=>{
  expect(QUESTION_SOURCES.Q07!.url).toMatch(/^https:\/\/www\.ungeneva\.org\//);
 });
 it('test_no_resource_url_comes_from_a_blocked_ledger_entry',()=>{
  const norm=(u:string)=>u.replace(/\/$/,'');
  const blocked=new Set((ledger as {verdict:string;url?:string;url_suivi?:string}[]).filter(e=>e.verdict==='bloqué').flatMap(e=>[e.url,e.url_suivi]).filter((u):u is string=>!!u).map(norm));
  expect(blocked.size).toBeGreaterThan(0);
  expect(resources.map(r=>norm(r.url)).filter(u=>blocked.has(u))).toEqual([]);
  expect(resources.filter(r=>r.url.startsWith('http:'))).toEqual([]);
 });
});
