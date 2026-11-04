import {INSTANCE} from './instance.mjs';
export type Role = 'admin' | 'operator' | 'visitor';
export type Actor = { id: string; email: string; role: Role };
export type Ticket = { id: string; number: number; code: string; kind: 'normal' | 'priority'; day: string; status: 'waiting' | 'serving' | 'served' | 'skipped' | 'cancelled'; createdAt: number; calledAt?: number; finishedAt?: number; counterId?: number };
export type Counter = { id: number; name: string; open: boolean; current: string | null; operatorId?: string; operatorName?: string };
export type CallEvent = { id: number; code: string; counter: string; kind: string; at: number; recall: boolean };
export type Queue = { day: string; next: number; eventSequence: number; tickets: Ticket[]; counters: Counter[]; events: CallEvent[]; requests: { key: string; ticketId: string; actor: string; at: number }[]; audit: { action: string; actor: string; at: number }[] };
export class QueueError extends Error { status:number; constructor(status: number, message: string) { super(message); this.status=status; } }
export function bahiaDay(now = Date.now()) { return new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Bahia', year:'numeric',month:'2-digit',day:'2-digit'}).format(now); }
export function initialQueue(now = Date.now()): Queue { return { day: bahiaDay(now), next: 1, eventSequence: 0, tickets: [], counters:INSTANCE.counterNames.map((name,index)=>({id:index+1,name,open:true,current:null})), events:[],requests:[],audit:[] }; }
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
 counters:q.counters.map(({id,name,open,current})=>({id,name,open,current})), events:q.events.filter(e=>bahiaDay(e.at)===q.day).slice(-20)};
}
export function applyAction(q: Queue, action: string, data: Record<string,unknown>, actor: Actor, now=Date.now()): unknown {
 rollDay(q,now);
 if(action==='take') {
  if(data.kind!=='normal'&&data.kind!=='priority') throw new QueueError(400,'Escolha um tipo de atendimento válido.');
  if(typeof data.requestId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(data.requestId)) throw new QueueError(400,'Identificador de emissão inválido.');
  const requestKey=actor.id+':'+data.requestId;
  const prior=q.requests.find(r=>r.key===requestKey);
  if(prior) return q.tickets.find(t=>t.id===prior.ticketId);
  if(!q.counters.some(c=>c.open)) throw new QueueError(409,'Atendimento encerrado. Procure a recepção.');
  if(q.requests.filter(r=>r.actor===actor.id&&r.at>now-60000).length>=15) throw new QueueError(429,'Aguarde um minuto antes de emitir outra senha.');
  if(q.tickets.filter(t=>t.day===q.day).length>=2000) throw new QueueError(409,'Limite do piloto atingido. Procure a recepção.');
  const number=q.next++;
  const ticket: Ticket={id: `${q.day}:${number}`, number, code:`${data.kind==='priority'?'P':'N'}-${String(number).padStart(3,'0')}`,kind:data.kind,day:q.day,status:'waiting',createdAt:now};
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
    ticket=q.tickets.filter(t=>t.day===q.day&&t.status==='waiting').sort(compareTickets)[0];
    if(!ticket)throw new QueueError(409,'Não há senhas aguardando.');
    ticket.status='serving';ticket.counterId=c.id;ticket.calledAt=now;c.current=ticket.id;
   } else if(action==='recall'||action==='complete'||action==='skip'){
    if(!ticket)throw new QueueError(409,'Não há atendimento em andamento neste guichê.');
    if(action==='complete'||action==='skip'){ticket.status=action==='complete'?'served':'skipped';ticket.finishedAt=now;c.current=null;}
   } else throw new QueueError(400,'Ação inválida.');
   if(ticket&&(action==='call'||action==='recall')){
    q.events.push({id:++q.eventSequence,code:ticket.code,counter:c.name,kind:ticket.kind,at:now,recall:action==='recall'});q.events=q.events.slice(-30);
   }
  }
 }
 q.audit.push({action,actor:actor.id,at:now});q.audit=q.audit.slice(-200);
 return {ok:true};
}
