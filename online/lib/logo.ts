import {QueueError} from './errors.ts';
export function inspectLogo(bytes:Uint8Array){
 if(!bytes.length||bytes.length>2*1024*1024)throw new QueueError(400,'Envie uma imagem de até 2 MB.');
 const starts=(values:number[])=>values.every((n,i)=>bytes[i]===n);
 if(starts([137,80,78,71,13,10,26,10]))return {extension:'png',contentType:'image/png'};
 if(starts([255,216,255]))return {extension:'jpg',contentType:'image/jpeg'};
 if(starts([82,73,70,70])&&[87,69,66,80].every((n,i)=>bytes[i+8]===n))return {extension:'webp',contentType:'image/webp'};
 throw new QueueError(400,'Use PNG, JPG ou WebP. SVG e outros formatos não são aceitos.');
}
