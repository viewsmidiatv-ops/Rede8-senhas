import {defaultIndoor} from './indoor.ts';
import {defaultSettings,validateSettings,type Settings} from './settings.ts';
import {QueueError} from './errors.ts';
export {QueueError} from './errors.ts';
export type Role = 'admin' | 'operator' | 'visitor';
export type Actor = { id: string; email: string; role: Role };
export type Ticket = { id: string; number: number; code: string; kind: 'normal' | 'priority'; serviceId?:string;serviceName?:string;serviceColor?:string; day: string; status: 'waiting' | 'serving' | 'served' | 'skipped' | 'cancelled'; createdAt: number; calledAt?: number; finishedAt?: number; counterId?: number };
export type Counter = { id: number; name: string; open: boolean; current: string | null; operatorId?: string; operatorName?: string;enabled?:boolean;serviceIds?:string[] };
export type CallEvent = { id: number; code: string; counter: string; kind: string; at: number; recall: boolean;serviceName?:string };
export type Queue = { settings:Settings;configVersion:number; day: string; next: number; eventSequence: number; tickets: Ticket[]; counters: Counter[]; events: CallEvent[]; requests: { key: string; ticketId: string; actor: string; at: number }[]; audit: { action: string; actor: string; at: number }[] };
export function bahiaDay(now = Date.now()) { return new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Bahia', year:'numeric',month:'2-digit',day:'2-digit'}).format(now); }
export function initialQueue(now = Date.now()): Queue { const settings=defaultSettings();return {settings,configVersion:0, day: bahiaDay(now), next: 1, eventSequence: 0, tickets: [], counters:settings.counters.map(c=>({...c,open:true,current:null})), events:[],requests:[],audit:[] }; }
export function hydrateQueue(q:Queue):Queue{q.settings ||= defaultSettings(q.counters);q.settings.indoor ||= defaultIndoor();q.configVersion ||= 0;for(const c of q.counters){c.enabled ??= true;c.serviceIds ||= [];}return q;}
export function counterAccepts(counter:Counter,ticket:Ticket){return counter.enabled!==false&&(!counter.serviceIds?.length||counter.serviceIds.includes(ticket.serviceId||'general'));}
export function compareTickets(a: Ticket, b: Ticket) { return Number(b.kind === 'priority') - Number(a.kind === 'priority') || a.number - b.number; }
export function rollDay(q: Queue, now: number) {
 const day = bahiaDay(now);
 if(q.day === day) return;
 for(const t of q.tickets) if(t.status==='waiting'||t.status==='serving'){ t.status='cancelled'; t.finishedAt=now; }
 q.tickets=q.tickets.slice(-500); q.day=day; q.next=1; q.requests=[];
 for(const c of q.counters) c.current=null;
}
export function publicQueue(q: Queue) {
 return {day:q.day,next:q.next,eventSequence:q.eventSequence,
 tickets:q.tickets.filter(t=>t.day===q.day).map(t=>({...t})),
 counters:q.counters.map(({id,name,open,current,enabled,serviceIds})=>({id,name,open,current,enabled,serviceIds})), events:q.events.filter(e=>bahiaDay(e.at)===q.day).slice(-20)};
}
export function applyAction(q: Queue, action: string, data: Record<string,unknown>, actor: Actor, now=Date.now()): unknown {
 hydrateQueue(q);rollDay(q,now);
 if(action==='settings:save'){
  if(actor.role!=='admin')throw new QueueError(403,'Somente a administração pode alterar as configurações.');
  if(data.configVersion!==q.configVersion)throw new QueueError(409,'As configurações foram alteradas em outra sessão. Recarregue antes de salvar.');
  const next=validateSettings(data.settings);
  for(const old of q.counters){const replacement=next.counters.find(c=>c.id===old.id);if(!replacement)throw new QueueError(400,'Desative guichês em vez de excluí-los, para preservar o histórico.');if(old.current&&(!replacement.enabled||JSON.stringify(old.serviceIds||[])!==JSON.stringify(replacement.serviceIds)))throw new QueueError(409,`Conclua o atendimento no ${old.name} antes de desativá-lo ou alterar seus serviços.`);}
  for(const old of q.settings.services)if(!next.services.some(s=>s.id===old.id))throw new QueueError(400,'Desative serviços em vez de excluí-los, para preservar as senhas emitidas.');
  q.counters=next.counters.map(c=>{const prior=q.counters.find(p=>p.id===c.id);return {...prior,...c,open:c.enabled?(prior?.enabled===false?true:prior?.open??true):false,current:prior?.current||null};});
  q.settings=next;q.configVersion++;q.audit.push({action,actor:actor.id,at:now});q.audit=q.audit.slice(-200);return {ok:true};
 }
 if(action==='take') {
  if(data.kind!=='normal'&&data.kind!=='priority') throw new QueueError(400,'Escolha um tipo de atendimento válido.');
  if(typeof data.requestId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(data.requestId)) throw new QueueError(400,'Identificador de emissão inválido.');
  const requestKey=actor.id+':'+data.requestId;
  const prior=q.requests.find(r=>r.key===requestKey);
  if(prior) return q.tickets.find(t=>t.id===prior.ticketId);
  const svc=q.settings.services.find(s=>s.id===(data.serviceId||'general')&&s.enabled);
  if(!svc)throw new QueueError(400,'Serviço indisponível. Escolha outro atendimento.');
  if(data.kind==='priority'&&!svc.priorityEnabled)throw new QueueError(400,'Este serviço não possui opção prioritária.');
  if(!q.counters.some(c=>c.open&&c.enabled!==false&&(!c.serviceIds?.length||c.serviceIds.includes(svc.id)))) throw new QueueError(409,'Atendimento encerrado. Procure a recepção.');
  if(q.requests.filter(r=>r.actor===actor.id&&r.at>now-60000).length>=15) throw new QueueError(429,'Aguarde um minuto antes de emitir outra senha.');
  if(q.tickets.filter(t=>t.day===q.day).length>=2000) throw new QueueError(409,'Limite do piloto atingido. Procure a recepção.');
  const number=q.next++;
  const ticket: Ticket={id: `${q.day}:${number}`, number, code:`${data.kind==='priority'?svc.priorityPrefix:svc.normalPrefix}-${String(number).padStart(3,'0')}`,kind:data.kind,serviceId:svc.id,serviceName:svc.name,serviceColor:svc.color,day:q.day,status:'waiting',createdAt:now};
  q.tickets.push(ticket);q.requests.push({key:requestKey,ticketId:ticket.id,actor:actor.id,at:now});
  q.requests=q.requests.slice(-2000);return ticket;
 }
 if(actor.role==='visitor') throw new QueueError(403,'Seu acesso permite apenas retirar senhas e visualizar o painel.');
 if(action==='reset') {
  if(actor.role!=='admin') throw new QueueError(403,'Somente a administração pode encerrar a fila.');
  for(const t of q.tickets) if(t.status==='waiting'||t.status==='serving'){t.status='cancelled';t.finishedAt=now;}
  for(const c of q.counters)c.current=null;
 } else {
  const c=q.counters.find(c=>c.id===data.counterId);
  if(!c)throw new QueueError(400,'Guichê inválido.');
  if(c.enabled===false)throw new QueueError(409,'Este guichê está desativado.');
  if(c.operatorId&&c.operatorId!==actor.id&&actor.role!=='admin')throw new QueueError(403,'Este guichê está sendo operado por outra pessoa.');
  if(action==='claim') {
   c.operatorId=actor.id;c.operatorName=actor.email;
  } else if(action==='toggle') {
   if(c.current)throw new QueueError(409,'Conclua o atendimento antes de fechar o guichê.');
   c.open=!c.open;
  } else {
   if(actor.role==='operator'&&c.operatorId!==actor.id)throw new QueueError(403,'Selecione seu guichê antes de atender.');
   let ticket=q.tickets.find(t=>t.id===c.current&&t.status==='serving');
   if(action==='call'){
    if(!c.open)throw new QueueError(409,'Abra o guichê para chamar.');
    if(ticket)throw new QueueError(409,'Conclua o atendimento atual antes de chamar outra senha.');
    ticket=q.tickets.filter(t=>t.day===q.day&&t.status==='waiting'&&counterAccepts(c,t)).sort(compareTickets)[0];
    if(!ticket)throw new QueueError(409,'Não há senhas aguardando.');
    ticket.status='serving';ticket.counterId=c.id;ticket.calledAt=now;c.current=ticket.id;
   } else if(action==='recall'||action==='complete'||action==='skip'){
    if(!ticket)throw new QueueError(409,'Não há atendimento em andamento neste guichê.');
    if(action==='complete'||action==='skip'){ticket.status=action==='complete'?'served':'skipped';ticket.finishedAt=now;c.current=null;}
   } else throw new QueueError(400,'Ação inválida.');
   if(ticket&&(action==='call'||action==='recall')){
    q.events.push({id:++q.eventSequence,code:ticket.code,counter:c.name,kind:ticket.kind,at:now,recall:action==='recall',serviceName:ticket.serviceName});q.events=q.events.slice(-30);
   }
  }
 }
 q.audit.push({action,actor:actor.id,at:now});q.audit=q.audit.slice(-200);
 return {ok:true};
}
