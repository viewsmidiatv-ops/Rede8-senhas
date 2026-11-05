import {env} from 'cloudflare:workers';
import {deviceConnection,copyDeviceMedia,hasDeviceMedia} from '../../../../lib/device-bridge';
import {loadQueue} from '../../../../lib/queue-db';
import {mediaIdPattern} from '../../../../lib/indoor';
import {QueueError} from '../../../../lib/errors';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
async function matches(a:string,b:string){const hash=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));const [x,y]=await Promise.all([hash(a),hash(b)]);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0;}
// Server-only maintenance endpoint: protected by the private Site gate and the
// per-installation bridge secret. It never accepts visitor identity headers.
export async function POST(request:Request){try{
 const c=deviceConnection();if(!c)throw new QueueError(503,'Integração ainda não configurada.');
 const key=request.headers.get('X-Bridge-Key')||'';if(key.length!==64||!await matches(key,c.key))throw new QueueError(403,'Integração não autorizada.');
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new QueueError(403,'Origem não permitida.');
 const raw=await request.text();if(raw.length>4000)throw new QueueError(413,'Solicitação muito grande.');let data;try{data=raw?JSON.parse(raw):{};}catch{throw new QueueError(400,'Solicitação inválida.');}
 const {queue,revision}=await loadQueue();
 if(data.action==='sync'){const id=data.id;if(typeof id!=='string'||!mediaIdPattern.test(id)||!queue.settings.indoor.items.some(item=>item.id===id))throw new QueueError(400,'Conteúdo inválido.');if(!await hasDeviceMedia(id)){const object=await env.BUCKET?.get('media/'+id);if(!object)throw new QueueError(404,'Arquivo original não encontrado.');await copyDeviceMedia(id,object);}return json({ok:true,id});}
 if(data.action&&data.action!=='status')throw new QueueError(400,'Ação inválida.');
 return json({ok:true,revision,tickets:queue.tickets.length,counters:queue.counters.length,media:queue.settings.indoor.items.filter(i=>i.enabled).map(({id,name})=>({id,name})),backend:'supabase'});
 }catch(e){return json({error:e instanceof QueueError?e.message:'Não foi possível concluir a integração.'},e instanceof QueueError?e.status:503);}}
