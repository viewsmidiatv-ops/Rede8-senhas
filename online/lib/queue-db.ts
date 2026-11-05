import {deviceBridge,deviceConnection} from './device-bridge';
import {env} from 'cloudflare:workers';
import {initialQueue, hydrateQueue, type Actor, type Queue, applyAction, QueueError} from './queue';
import type {ChatGPTUser} from '../app/chatgpt-auth';
export function database(){if(!env.DB)throw new QueueError(503,'O banco de dados está indisponível. Tente novamente.');return env.DB;}
// First registration is safe only behind this Site's owner-private access gate.
// No public registration or password fallback exists in the hosted application.
export async function actorFor(user: ChatGPTUser): Promise<Actor> {
 const db=database();const email=user.email.trim().toLowerCase();
 let owner=await db.prepare('SELECT user_id FROM queue_owner WHERE key = 1').first<{user_id:string}>();
 if(!owner){await db.prepare('INSERT OR IGNORE INTO queue_owner (key,user_id) VALUES (1,?)').bind(user.userId).run();owner=await db.prepare('SELECT user_id FROM queue_owner WHERE key=1').first<{user_id:string}>();}
 if(owner?.user_id===user.userId){
  await db.prepare("INSERT OR IGNORE INTO queue_members (email,user_id,role,enabled) VALUES (?,?,'admin',1)").bind(email,user.userId).run();
  return {id:user.userId,email,role:'admin'};
 }
 let row=await db.prepare('SELECT user_id,role,enabled FROM queue_members WHERE email=?').bind(email).first<{user_id:string|null;role:string;enabled:number}>();
 if(row&&row.enabled===1&&!row.user_id){await db.prepare('UPDATE queue_members SET user_id=? WHERE email=? AND user_id IS NULL').bind(user.userId,email).run();row=await db.prepare('SELECT user_id,role,enabled FROM queue_members WHERE email=?').bind(email).first();}
 const role=row?.user_id===user.userId&&row.enabled===1&&(row.role==='admin'||row.role==='operator')?row.role:'visitor';
 return {id:user.userId,email,role};
}
async function legacyQueue(): Promise<{queue:Queue;revision:number}> {
 const db=database();let row=await db.prepare('SELECT revision,payload FROM queue_state WHERE key=1').first<{revision:number;payload:string}>();
 if(!row){await db.prepare('INSERT OR IGNORE INTO queue_state (key,revision,payload) VALUES (1,0,?)').bind(JSON.stringify(initialQueue())).run();row=await db.prepare('SELECT revision,payload FROM queue_state WHERE key=1').first<{revision:number;payload:string}>();}
 if(!row)throw new QueueError(503,'Não foi possível carregar a fila.');
 return {queue:hydrateQueue(JSON.parse(row.payload)),revision:row.revision};
}
export async function loadQueue(): Promise<{queue:Queue;revision:number}> {
 if(!deviceConnection())return legacyQueue();
 let remote=await deviceBridge('load');
 if(!remote.exists){const legacy=await legacyQueue();remote=await deviceBridge('seed',legacy);}
 return {queue:hydrateQueue(remote.queue),revision:remote.revision};
}
export async function mutateQueue(action:string,data:Record<string,unknown>,actor:Actor) {
 const db=database();
 // Compare-and-swap persists a whole transition atomically: concurrent kiosks
 // cannot get the same number and counters cannot acquire the same ticket.
 for(let attempt=0;attempt<8;attempt++){
  const {queue,revision}=await loadQueue();const result=applyAction(queue,action,data,actor);
  if(deviceConnection()){const write=await deviceBridge('cas',{queue,revision});if(write.written)return {result,queue,revision:revision+1};continue;}
  const write=await db.prepare('UPDATE queue_state SET payload=?,revision=revision+1 WHERE key=1 AND revision=?').bind(JSON.stringify(queue),revision).run();
  if(write.meta.changes===1)return {result,queue,revision:revision+1};
 }
 throw new QueueError(409,'A fila foi atualizada por outro dispositivo. Tente novamente.');
}
