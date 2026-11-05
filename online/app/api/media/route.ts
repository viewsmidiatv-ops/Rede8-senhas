import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {actorFor} from '../../../lib/queue-db';
import {QueueError} from '../../../lib/errors';
import {inspectMedia,MAX_MEDIA_BYTES} from '../../../lib/indoor';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{
 if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')throw new QueueError(403,'Origem não permitida.');
 const user=await getChatGPTUser();if(!user)throw new QueueError(401,'Entre para continuar.');
 if((await actorFor(user)).role!=='admin')throw new QueueError(403,'Somente a administração pode enviar conteúdos.');
 if(!env.BUCKET)throw new QueueError(503,'Armazenamento indisponível.');
 const length=Number(request.headers.get('content-length'));if(length>MAX_MEDIA_BYTES)throw new QueueError(413,'Envie um arquivo de até 20 MB.');
 if(!request.body)throw new QueueError(400,'Selecione um arquivo.');
 const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_MEDIA_BYTES){await reader.cancel();throw new QueueError(413,'Envie um arquivo de até 20 MB.');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}const type=inspectMedia(bytes),id=`${crypto.randomUUID()}.${type.extension}`;
 await env.BUCKET.put(`media/${id}`,bytes,{httpMetadata:{contentType:type.contentType}});
 return Response.json({id,url:`/api/media/${id}`,kind:type.kind},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof QueueError?e.message:'Não foi possível enviar o conteúdo.'},{status:e instanceof QueueError?e.status:503});}}
