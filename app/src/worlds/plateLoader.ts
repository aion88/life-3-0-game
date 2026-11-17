/** Cache successful image decodes, but never cache a failed request permanently. */
export function createPlateLoader(decode: (url:string)=>Promise<void> = async url => {
  const image=new Image();image.src=url;
  let timer:ReturnType<typeof setTimeout>|undefined;
  try { await Promise.race([image.decode(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Image timeout')),10_000);})]); }
  finally { if(timer!==undefined)clearTimeout(timer); }
}) {
  const pending=new Map<string,Promise<void>>(),ready=new Set<string>();
  return {
    ready:(url:string)=>ready.has(url),
    load(url:string):Promise<void> {
      let request=pending.get(url);
      if(!request){request=decode(url).then(()=>{ready.add(url);},error=>{pending.delete(url);throw error;});pending.set(url,request);}
      return request;
    },
  };
}
