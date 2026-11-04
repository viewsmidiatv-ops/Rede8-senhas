import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {actorFor} from '../../../lib/queue-db';
import {QueueError} from '../../../lib/errors';
import {inspectLogo} from '../../../lib/logo';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{
 if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')throw new QueueError(403,'Origem não permitida.');
 const user=await getChatGPTUser();if(!user)throw new QueueError(401,'Entre para continuar.');
 const actor=await actorFor(user);if(actor.role!=='admin')throw new QueueError(403,'Somente a administração pode enviar a logomarca.');
 if(!env.BUCKET)throw new QueueError(503,'O armazenamento de imagens está indisponível. Use uma URL HTTPS temporariamente.');
 if(!request.headers.get('content-type')?.startsWith('multipart/form-data'))throw new QueueError(415,'Envie um arquivo de imagem.');
 if(Number(request.headers.get('content-length')||0)>2200000)throw new QueueError(413,'Envie uma imagem de até 2 MB.');
 const form=await request.formData(),file=form.get('file');if(!(file instanceof File))throw new QueueError(400,'Selecione uma imagem.');
 if(file.size>2*1024*1024)throw new QueueError(400,'Envie uma imagem de até 2 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer()),type=inspectLogo(bytes),id=`${crypto.randomUUID()}.${type.extension}`;
 await env.BUCKET.put(`logos/${id}`,bytes,{httpMetadata:{contentType:type.contentType}});
 return Response.json({url:`/api/logo/${id}`},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof QueueError?e.message:'Não foi possível enviar a imagem.'},{status:e instanceof QueueError?e.status:503});}}
