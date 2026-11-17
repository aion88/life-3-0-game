/** Trim prose delimiters, preserving balanced parentheses inside real URL paths. */
export function cleanResourceUrl(raw:string):string {
 let value=raw.trim().replace(/[.,;]+$/,'');
 while(value.endsWith(')')&&(value.match(/\)/g)?.length??0)>(value.match(/\(/g)?.length??0))value=value.slice(0,-1).replace(/[.,;]+$/,'');
 return value;
}
/** Markdown destinations can contain balanced parentheses (Wikipedia, treaty URLs). */
export function resourceLinks(line:string):{url:string;title?:string}[] {
 const result:{url:string;title?:string}[]=[];const ranges:[number,number][]=[];
 for(const m of line.matchAll(/\[([^\]]+)\]\((https?:\/\/)/g)){
  const start=m.index!+m[0].length-m[2]!.length;let depth=1,end=start;
  for(;end<line.length;end++){if(line[end]==='(')depth++;if(line[end]===')'&&--depth===0)break;if(/\s/.test(line[end]!))break;}
  result.push({url:cleanResourceUrl(line.slice(start,end)),title:m[1]!});ranges.push([m.index!,end+1]);
 }
 let plain=line;for(const [start,end] of ranges.reverse())plain=plain.slice(0,start)+' '.repeat(end-start)+plain.slice(end);
 for(const m of plain.matchAll(/https?:\/\/[^\s<>"`\]]+/g))result.push({url:cleanResourceUrl(m[0])});
 return result;
}
