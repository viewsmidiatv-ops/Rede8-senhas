import {getChatGPTUser} from '../../chatgpt-auth';
import {actorFor,loadQueue,mutateQueue,database} from '../../../lib/queue-db';
import {QueueError,publicQueue,rollDay} from '../../../lib/queue';
import {checkMutationRequest} from '../../../lib/request-security';
export const dynamic='force-dynamic';
function json(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
async function identity(){const user=await getChatGPTUser();if(!user)throw new QueueError(401,'Entre com sua conta ChatGPT para continuar.');return actorFor(user);}
function failure(e:unknown){if(e instanceof QueueError)return json({error:e.message},e.status);console.error('queue_request_failed',e instanceof Error?e.message:'unknown');return json({error:'O sistema está indisponível. Tente novamente.'},503);}
export async function GET(request:Request){try{
 const actor=await identity();const view=new URL(request.url).searchParams.get('view');
 if(view==='members'){
  if(actor.role!=='admin')throw new QueueError(403,'Somente a administração pode gerenciar acessos.');
  const members=await database().prepare('SELECT email,role,enabled FROM queue_members ORDER BY email').all();return json({members:members.results});
 }
 const {queue,revision}=await loadQueue();rollDay(queue,Date.now());
 return json({queue:publicQueue(queue),settings:queue.settings,configVersion:queue.configVersion,revision,self:{email:actor.email,role:actor.role}});
}catch(e){return failure(e);}}
export async function POST(request:Request){try{
 checkMutationRequest(request);
 const actor=await identity();const text=await request.text();if(text.length>64000)throw new QueueError(413,'Solicitação muito grande.');
 let body;try{body=JSON.parse(text);}catch{throw new QueueError(400,'Solicitação inválida.');}
 if(!body||typeof body.action!=='string'||!body.data||Array.isArray(body.data)||typeof body.data!=='object')throw new QueueError(400,'Solicitação inválida.');
 if(body.action==='member'){
  if(actor.role!=='admin')throw new QueueError(403,'Somente a administração pode gerenciar acessos.');
  const email=String(body.data.email||'').trim().toLowerCase(),role=body.data.role;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>180||!['admin','operator','disabled'].includes(role))throw new QueueError(400,'Informe e-mail e perfil válidos.');
  const owner=await database().prepare('SELECT user_id FROM queue_owner WHERE key=1').first<{user_id:string}>();
  const member=await database().prepare('SELECT user_id FROM queue_members WHERE email=?').bind(email).first<{user_id:string}>();
  if(member?.user_id===owner?.user_id||email===actor.email)throw new QueueError(400,'O proprietário e seu próprio acesso são preservados.');
  await database().prepare('INSERT INTO queue_members (email,role,enabled) VALUES (?,?,?) ON CONFLICT(email) DO UPDATE SET role=excluded.role,enabled=excluded.enabled').bind(email,role==='disabled'?'operator':role,role==='disabled'?0:1).run();
  return json({ok:true});
 }
 const {result,queue,revision}=await mutateQueue(body.action,body.data,actor);
 return json({result,queue:publicQueue(queue),settings:queue.settings,configVersion:queue.configVersion,revision,self:{email:actor.email,role:actor.role}});
}catch(e){return failure(e);}}
