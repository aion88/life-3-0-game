import {imageDimensions} from './image-dimensions.ts';
import console from 'node:console';
import process from 'node:process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve('dist');
async function walk(dir) {
 const entries = await readdir(dir,{withFileTypes:true});
 return (await Promise.all(entries.map(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]))).flat();
}
const files = await walk(root), issues = [];
const manifest = [];
for (const file of files) {
 const path = relative(root,file), bytes = (await stat(file)).size;
 if(bytes > 25*1024*1024) issues.push(`${path}: exceeds Cloudflare's 25 MiB limit`);
 if(/(^|\/)(\.env(?:\.|$)|\.git(?:\/|$)|node_modules\/)|\.map$/.test(path)) issues.push(`${path}: development/private artifact`);
 if(path==='capture.html') issues.push('Capture entry must not be published');
 const contents=await readFile(file);
 if(/\.(js|css)$/.test(path)&&contents.includes('__street')) issues.push(`${path}: capture hooks must not be published`);
 manifest.push({path,bytes,sha256:createHash('sha256').update(contents).digest('hex')});
}
if(files.length>20000) issues.push('More than 20,000 files');
const plates=JSON.parse(await readFile(resolve('src/worlds/illustrations.json'),'utf8'));
const requiredFiles=new Set(['release.json','index.html','_headers','mondes.html','decors.html','galerie-life.html','illustrated/poster-horizontal.jpg','illustrated/poster-vertical.jpg']);
for(const places of Object.values(plates)) for(const plate of Object.values(places)) requiredFiles.add(`illustrated/${plate.atlas}.${plate.extension ?? 'jpg'}`);
for(const required of requiredFiles) if(!manifest.some(f=>f.path===required)) issues.push(`Missing ${required}`);
try {
 const release=JSON.parse(await readFile(join(root,'release.json'),'utf8'));
 if(!/^life-3\.0-[a-f0-9]{12}$/.test(release.id)||!/^[a-f0-9]{64}$/.test(release.sourceHash)||release.id!==`life-3.0-${release.sourceHash.slice(0,12)}`||!Number.isFinite(Date.parse(release.builtAt))) issues.push('Invalid release identity');
} catch { issues.push('Missing or unreadable release identity'); }
for(const [world,places] of Object.entries(plates)) for(const [place,plate] of Object.entries(places)) {
 const file=`illustrated/${plate.atlas}.${plate.extension??'jpg'}`;
 if(plate.full!==true) issues.push(`${world}/${place}: atlas tile is not a full-frame source`);
 try {
  const {width,height}=imageDimensions(await readFile(join(root,file)));
  if(width<1600||height<900) issues.push(`${world}/${place}: source ${width}x${height} is below 1600x900`);
 } catch { issues.push(`${world}/${place}: missing or unreadable source image`); }
}
const html=await readFile(join(root,'index.html'),'utf8');
for(const [,url] of html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)) if(!manifest.some(f=>f.path===url.slice(1))) issues.push(`Missing entry asset ${url}`);
console.log(JSON.stringify({checkedAt:new Date().toISOString(),files:files.length,totalBytes:manifest.reduce((s,f)=>s+f.bytes,0),largest:manifest.toSorted((a,b)=>b.bytes-a.bytes).slice(0,5),issues,manifest},null,2));
if(issues.length) process.exitCode=1;
