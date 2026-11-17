import {createHash} from 'node:crypto';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
async function walk(path) {
 const entries=await readdir(path,{withFileTypes:true});
 return (await Promise.all(entries.map(e=>e.isDirectory()?walk(join(path,e.name)):[join(path,e.name)]))).flat();
}
// Identify the delivered source snapshot without requiring a commit or publishing source files.
const files=[...(await walk('src')),...(await walk('public')),...(await walk('tools')),'package.json','package-lock.json'].sort();
const hash=createHash('sha256');
for(const file of files) { hash.update(file);hash.update('\0');hash.update(await readFile(file));hash.update('\0'); }
const sourceHash=hash.digest('hex');const builtAt=new Date().toISOString();
await writeFile('dist/release.json',JSON.stringify({id:`life-3.0-${sourceHash.slice(0,12)}`,builtAt,sourceHash},null,2)+'\n');
