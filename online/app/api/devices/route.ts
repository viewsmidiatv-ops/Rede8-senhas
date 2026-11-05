import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {actorFor,loadQueue} from '../../../lib/queue-db';
import {QueueError} from '../../../lib/errors';
import {deviceBridge,deviceConnection,copyDeviceMedia,hasDeviceMedia} from '../../../lib/device-bridge';
import {checkMutationRequest} from '../../../lib/request-security';
import {mediaIdPattern} from '../../../lib/indoor';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function admin(){const user=await getChatGPTUser();if(!user)throw new QueueError(401,'Entre para continuar.');const actor=await actorFor(user);if(actor.role!=='admin')throw new QueueError(403,'Somente a administração pode gerenciar aparelhos.');return actor;}
const fail=(e:unknown)=>json({error:e instanceof QueueError?e.message:'Não foi possível acessar a integração de aparelhos.'},e instanceof QueueError?e.status:503);
export async function GET(){try{await admin();const {queue}=await loadQueue();const connection=deviceConnection();if(!connection)return json({configured:false,devices:[],media:[]});const result=await deviceBridge('list');return json({configured:true,endpoint:connection.url,...result,media:queue.settings.indoor.items.filter(i=>i.enabled).map(({id,name})=>({id,name}))});}catch(e){return fail(e);}}
export async function POST(request:Request){try{checkMutationRequest(request);const actor=await admin();const raw=await request.text();if(raw.length>4000)throw new QueueError(413,'Solicitação muito grande.');let data;try{data=JSON.parse(raw);}catch{throw new QueueError(400,'Solicitação inválida.');}
 if(data.action==='preview')return json(await deviceBridge('preview',{code:data.code}));
 if(data.action==='approve')return json(await deviceBridge('approve',{code:data.code,label:data.label,actor:actor.id}));
 if(data.action==='revoke')return json(await deviceBridge('revoke',{id:data.id}));
 if(data.action==='media'){const id=data.id;if(typeof id!=='string'||!mediaIdPattern.test(id))throw new QueueError(400,'Conteúdo inválido.');const {queue}=await loadQueue();if(!queue.settings.indoor.items.some(i=>i.id===id))throw new QueueError(404,'Conteúdo não faz parte da playlist.');if(await hasDeviceMedia(id))return json({ok:true});const object=await env.BUCKET?.get('media/'+id);if(!object)throw new QueueError(404,'Arquivo não encontrado no armazenamento original.');await copyDeviceMedia(id,object);return json({ok:true});}
 throw new QueueError(400,'Ação inválida.');
 }catch(e){return fail(e);}}
