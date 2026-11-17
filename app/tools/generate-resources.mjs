/** Index the project's existing research links; do not promote research notes to verified claims. */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { URL } from 'node:url';
import { join, basename } from 'node:path';
import {cleanResourceUrl,resourceLinks} from './resource-links.ts';
import { PRESENT_SIGNALS } from '../src/worlds/present.ts';
const entries=new Map();
const clean=s=>s.replace(/[*`#]/g,'').replace(/\s+/g,' ').trim();
function add(raw,title,group,origin){
 let url;try{url=new URL(cleanResourceUrl(raw));}catch{return;}
 if(!['https:','http:'].includes(url.protocol)||['localhost','127.0.0.1'].includes(url.hostname))return;
 url.hash='';for(const key of [...url.searchParams.keys()])if(key.startsWith('utm_'))url.searchParams.delete(key);
 const key=url.href.replace(/\/$/,'');const previous=entries.get(key);
 if(previous){if(!previous.origins.includes(origin))previous.origins.push(origin);return;}
 let label=clean(title??'');
 if(!label||/^(source|ici|lien|wikipédia|url|pdf)$/i.test(label)){
  const last=decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1)??'').replaceAll('_',' ').replaceAll('-',' ');
  label=last.length>8?last:url.hostname;
 }
 entries.set(key,{title:label.slice(0,180),url:url.href,domain:url.hostname.replace(/^www\./,''),group,origins:[origin]});
}
add('https://www.penguinrandomhouse.com/books/530584/life-30-by-max-tegmark/9781101970317/','Life 3.0 — Max Tegmark, présentation de l’essai','Pour commencer','Essai à l’origine du jeu');
for(const signal of PRESENT_SIGNALS)add(signal.url,`${signal.title} — ${signal.source}`,'Faits présentés dans le jeu','Cartes « Dans le monde réel »');
const groupFor=file=>/comparables|gta|licences|mesure|polices|tech-routes/.test(file)?'Création et inspirations visuelles':/dudh/.test(file)?'Droits et libertés':/trajectoires|scenarios|one-in-eight|extinctions/.test(file)?'Futurs de l’intelligence artificielle':/questionnaire|q\d|q-direction/.test(file)?'Questions de société':'Précédents et études de cas';
function walk(dir){if(!existsSync(dir))return [];return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]);}
for(const file of ['../research','../design/research','../design/gdd/reviews'].flatMap(walk).filter(f=>f.endsWith('.md')&&!f.includes('research/atlas/')).sort()){
 const body=readFileSync(file,'utf8');const origin=clean(body.match(/^#\s+(.+)$/m)?.[1]??basename(file,'.md'));
 let heading=origin;
 for(const line of body.split('\n')){
  if(/^#{1,5}\s/.test(line))heading=clean(line.replace(/^#+\s*/,''));
  for(const link of resourceLinks(line))add(link.url,link.title??heading,groupFor(file),origin);
 }
}
writeFileSync('src/screens/lang/resources.json',JSON.stringify([...entries.values()],null,2)+'\n');
