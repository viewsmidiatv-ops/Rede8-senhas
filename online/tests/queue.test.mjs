import test from 'node:test';
import assert from 'node:assert/strict';
import {initialQueue,applyAction,compareTickets,publicQueue,bahiaDay,rollDay,QueueError} from '../lib/queue.ts';
const now=Date.parse('2026-11-04T15:00:00Z');
const admin={id:'owner',email:'owner@example.test',role:'admin'},operator={id:'op',email:'op@example.test',role:'operator'},visitor={id:'tablet',email:'tablet@example.test',role:'visitor'};
let requestSequence=0;
function issue(q,kind='normal',actor=visitor,requestId=`request-unique-${++requestSequence}`){return applyAction(q,'take',{kind,requestId},actor,now);}
function rejects(fn,status){assert.throws(fn,e=>e instanceof QueueError&&e.status===status);}
test('normal/priority FIFO, displayed order and simultaneous counter isolation',()=>{
 const q=initialQueue(now);const n1=issue(q),n2=issue(q),p1=issue(q,'priority'),p2=issue(q,'priority');
 assert.deepEqual(q.tickets.toSorted(compareTickets).map(t=>t.code),[p1.code,p2.code,n1.code,n2.code]);
 applyAction(q,'call',{counterId:1},admin,now);applyAction(q,'call',{counterId:2},admin,now);
 assert.equal(q.counters[0].current,p1.id);assert.equal(q.counters[1].current,p2.id);
 assert.equal(q.tickets.filter(t=>t.status==='serving').length,2);
 rejects(()=>applyAction(q,'call',{counterId:1},admin,now),409);
 applyAction(q,'complete',{counterId:1},admin,now);applyAction(q,'call',{counterId:1},admin,now);
 assert.equal(q.counters[0].current,n1.id);
});
test('a retried kiosk request returns the same ticket without advancing sequence',()=>{
 const q=initialQueue(now),first=issue(q,'normal',visitor,'duplicate-unique-id');
 const retry=issue(q,'normal',visitor,'duplicate-unique-id');assert.equal(first.id,retry.id);assert.equal(q.next,2);assert.equal(q.tickets.length,1);
});
test('invalid category, invalid key and closed counters do not consume numbers',()=>{
 const q=initialQueue(now);rejects(()=>issue(q,'invalid'),400);rejects(()=>issue(q,'normal',visitor,'short'),400);
 q.counters.forEach(c=>c.open=false);rejects(()=>issue(q),409);assert.equal(q.next,1);
});
test('visitor cannot operate, reset or claim even if the browser invents an admin role',()=>{
 const q=initialQueue(now);for(const action of ['call','claim','reset','toggle','complete','recall','skip'])rejects(()=>applyAction(q,action,{counterId:1,role:'admin'},visitor,now),403);
});
test('operator must claim a counter, cannot take someone else’s counter and cannot reset',()=>{
 const q=initialQueue(now);issue(q);rejects(()=>applyAction(q,'call',{counterId:1},operator,now),403);
 applyAction(q,'claim',{counterId:1},operator,now);applyAction(q,'call',{counterId:1},operator,now);
 const another={...operator,id:'op2'};rejects(()=>applyAction(q,'claim',{counterId:1},another,now),403);rejects(()=>applyAction(q,'reset',{},operator,now),403);
});
test('recall produces a new numbered event; completion and absence release the counter',()=>{
 const q=initialQueue(now);issue(q);issue(q);applyAction(q,'call',{counterId:1},admin,now);applyAction(q,'recall',{counterId:1},admin,now+1);
 assert.equal(q.events.length,2);assert.equal(q.events[1].recall,true);assert.equal(q.events[1].id,2);
 applyAction(q,'skip',{counterId:1},admin,now);assert.equal(q.counters[0].current,null);assert.equal(q.tickets[0].status,'skipped');
 applyAction(q,'call',{counterId:1},admin,now);applyAction(q,'complete',{counterId:1},admin,now);assert.equal(q.tickets[1].status,'served');
});
test('midnight in Bahia rolls over after downtime, retaining disambiguated history',()=>{
 const before=Date.parse('2026-11-05T02:59:00Z'),after=Date.parse('2026-11-05T03:01:00Z');const q=initialQueue(before);
 const old=applyAction(q,'take',{kind:'normal',requestId:'test-midnight-001'},visitor,before);applyAction(q,'call',{counterId:1},admin,before);
 rollDay(q,after);assert.equal(bahiaDay(before),'2026-11-04');assert.equal(q.day,'2026-11-05');assert.equal(q.next,1);assert.equal(q.counters[0].current,null);assert.equal(q.tickets[0].status,'cancelled');
 const next=applyAction(q,'take',{kind:'normal',requestId:'test-midnight-002'},visitor,after);assert.equal(next.code,old.code);assert.notEqual(next.id,old.id);assert.equal(publicQueue(q).events.length,0);assert.equal(publicQueue(q).tickets.length,1);
});
test('public projection excludes account identity, claims, idempotency keys and audit',()=>{
 const q=initialQueue(now);issue(q);applyAction(q,'claim',{counterId:1},operator,now);const json=JSON.stringify(publicQueue(q));
 for(const secret of ['operatorId','operatorName','requests','audit',operator.email,operator.id+'"'])assert.equal(json.includes(secret),false);
});
test('reset preserves sequence and marks active tickets cancelled instead of reusing today’s numbers',()=>{
 const q=initialQueue(now);issue(q);applyAction(q,'reset',{},admin,now);const t=issue(q);assert.equal(t.number,2);assert.equal(q.tickets[0].status,'cancelled');
});
