import {QueueError} from './errors.ts';
export type MediaItem={id:string;name:string;url:string;kind:'image'|'video';seconds:number;enabled:boolean};
export type Indoor={enabled:boolean;position:'left'|'right';mediaPercent:50|60|70;fit:'contain'|'cover';items:MediaItem[]};
export const mediaIdPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(png|jpg|webp|mp4|webm)$/;
export const MAX_MEDIA_BYTES=20*1024*1024;
export function defaultIndoor():Indoor{return {enabled:false,position:'right',mediaPercent:60,fit:'contain',items:[]};}
export function validateIndoor(value:unknown):Indoor{
 if(value===undefined)return defaultIndoor();
 const v=value as Indoor;
 if(!v||typeof v.enabled!=='boolean'||!['left','right'].includes(v.position)||![50,60,70].includes(v.mediaPercent)||!['contain','cover'].includes(v.fit)||!Array.isArray(v.items)||v.items.length>30)throw new QueueError(400,'Revise as configurações de mídia indoor (até 30 conteúdos).');
 const ids=new Set();
 const items=v.items.map(item=>{if(!item||typeof item.id!=='string'||!mediaIdPattern.test(item.id)||ids.has(item.id)||typeof item.name!=='string'||!item.name.trim()||item.name.length>100||item.url!==`/api/media/${item.id}`||typeof item.enabled!=='boolean'||!Number.isInteger(item.seconds)||item.seconds<5||item.seconds>300||item.kind!==( /\.(mp4|webm)$/.test(item.id)?'video':'image'))throw new QueueError(400,'Conteúdo inválido. Use arquivos enviados ao sistema e duração de 5 a 300 segundos.');ids.add(item.id);return {id:item.id,name:item.name.trim(),url:item.url,kind:item.kind,seconds:item.seconds,enabled:item.enabled};});
 if(v.enabled&&!items.some(i=>i.enabled))throw new QueueError(400,'Adicione ao menos um conteúdo ativo antes de habilitar a mídia indoor.');
 return {enabled:v.enabled,position:v.position,mediaPercent:v.mediaPercent,fit:v.fit,items};
}
export function inspectMedia(bytes:Uint8Array){
 const starts=(values:number[],offset=0)=>values.every((v,i)=>bytes[offset+i]===v);
 if(starts([137,80,78,71,13,10,26,10]))return {extension:'png',contentType:'image/png',kind:'image'} as const;
 if(starts([255,216,255]))return {extension:'jpg',contentType:'image/jpeg',kind:'image'} as const;
 if(starts([82,73,70,70])&&starts([87,69,66,80],8))return {extension:'webp',contentType:'image/webp',kind:'image'} as const;
 if(starts([102,116,121,112],4)&&bytes.length>=16)return {extension:'mp4',contentType:'video/mp4',kind:'video'} as const;
 if(starts([26,69,223,163]))return {extension:'webm',contentType:'video/webm',kind:'video'} as const;
 throw new QueueError(415,'Use PNG, JPG, WebP, MP4 ou WebM.');
}
export function parseMediaRange(header:string|null,size:number):{offset:number;length:number}|null{
 if(!header)return null;
 const match=/^bytes=(\d*)-(\d*)$/.exec(header);if(!match||(!match[1]&&!match[2]))throw new QueueError(416,'Intervalo inválido.');
 const start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));const end=match[1]?(match[2]?Math.min(Number(match[2]),size-1):size-1):size-1;
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)throw new QueueError(416,'Intervalo inválido.');return {offset:start,length:end-start+1};
}
