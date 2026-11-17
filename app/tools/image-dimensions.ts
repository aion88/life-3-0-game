/** Read source dimensions without decoding or depending on platform image utilities. */
export function imageDimensions(bytes:Uint8Array):{width:number;height:number} {
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(bytes.length>=24&&v.getUint32(0)===0x89504e47&&v.getUint32(4)===0x0d0a1a0a)return {width:v.getUint32(16),height:v.getUint32(20)};
 if(bytes[0]===0xff&&bytes[1]===0xd8){
  let p=2;
  while(p+3<bytes.length){
   if(bytes[p++]!==0xff)throw new Error('Invalid JPEG marker');
   while(bytes[p]===0xff)p++;
   const marker=bytes[p++]!;
   if(marker===0xd9||marker===0xda)break;
   if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
   const length=v.getUint16(p);
   if(length<2||p+length>bytes.length)throw new Error('Truncated JPEG');
   if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return {width:v.getUint16(p+5),height:v.getUint16(p+3)};
   p+=length;
  }
 }
 throw new Error('Unsupported or invalid image header');
}
