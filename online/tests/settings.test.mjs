import test from 'node:test';
import assert from 'node:assert/strict';
import {initialQueue,hydrateQueue,applyAction,QueueError} from '../lib/queue.ts';
import {validateSettings,announcementText,validLogoUrl} from '../lib/settings.ts';
import {inspectLogo} from '../lib/logo.ts';
const now=Date.parse('2026-11-04T15:00:00Z'),admin={id:'owner',email:'owner@example.test',role:'admin'},operator={id:'op',email:'op@example.test',role:'operator'};
const save=(q,cfg,version=q.configVersion,actor=admin)=>applyAction(q,'settings:save',{configVersion:version,settings:cfg},actor,now);
function assertStatus(fn,status){assert.throws(fn,e=>e instanceof QueueError&&e.status===status);}
function examService(){return {id:'exams',name:'Exames',normalPrefix:'E',priorityPrefix:'EP',color:'#775588',enabled:true,priorityEnabled:true};}
test('legacy queue hydrates settings without dropping tickets, names, claims or numbering',()=>{
 const q=initialQueue(now);applyAction(q,'take',{kind:'normal',requestId:'legacy-request-001'},admin,now);q.counters[0].name='Recepção antiga';q.counters[0].operatorId='existing-user';delete q.settings;delete q.configVersion;delete q.counters[0].enabled;
 hydrateQueue(q);assert.equal(q.tickets.length,1);assert.equal(q.next,2);assert.equal(q.settings.counters[0].name,'Recepção antiga');assert.equal(q.counters[0].operatorId,'existing-user');assert.equal(q.configVersion,0);
});
test('admin configuration creates a service and counter; routing and prefixes follow the saved settings',()=>{
 const q=initialQueue(now),cfg=structuredClone(q.settings);cfg.services.push(examService());cfg.counters[0].serviceIds=['general'];cfg.counters[1].serviceIds=['general'];cfg.counters.push({id:3,name:'Sala de exames',enabled:true,serviceIds:['exams']});save(q,cfg);
 const exam=applyAction(q,'take',{kind:'priority',serviceId:'exams',requestId:'exam-request-001'},admin,now);const normal=applyAction(q,'take',{kind:'normal',requestId:'normal-request-002'},admin,now);
 assert.equal(exam.code,'EP-001');assert.equal(exam.serviceName,'Exames');applyAction(q,'call',{counterId:1},admin,now);assert.equal(q.counters[0].current,normal.id);applyAction(q,'call',{counterId:3},admin,now);assert.equal(q.counters[2].current,exam.id);
});
test('disabling a service blocks new tickets but preserves issuance retries and old waiting tickets',()=>{
 const q=initialQueue(now),cfg=structuredClone(q.settings);cfg.services.push(examService());save(q,cfg);const old=applyAction(q,'take',{kind:'normal',serviceId:'exams',requestId:'old-exam-request'},admin,now);
 const next=structuredClone(q.settings);next.services[1].enabled=false;save(q,next);assertStatus(()=>applyAction(q,'take',{kind:'normal',serviceId:'exams',requestId:'new-exam-request'},admin,now),400);
 assert.equal(applyAction(q,'take',{kind:'normal',serviceId:'exams',requestId:'old-exam-request'},admin,now).id,old.id);applyAction(q,'call',{counterId:1},admin,now);assert.equal(q.counters[0].current,old.id);
});
test('operator cannot configure and stale configuration revisions cannot overwrite a newer save',()=>{
 const q=initialQueue(now),cfg=structuredClone(q.settings);cfg.name='Empresa alterada';assertStatus(()=>save(q,cfg,0,operator),403);save(q,cfg,0);assertStatus(()=>save(q,cfg,0),409);assert.equal(q.settings.name,'Empresa alterada');assert.equal(q.configVersion,1);
});
test('active counters cannot be disabled or rerouted and historical service/counter IDs cannot be removed',()=>{
 const q=initialQueue(now);applyAction(q,'take',{kind:'normal',requestId:'counter-active-001'},admin,now);applyAction(q,'call',{counterId:1},admin,now);const cfg=structuredClone(q.settings);cfg.counters[0].enabled=false;assertStatus(()=>save(q,cfg),409);
 cfg.counters[0].enabled=true;cfg.counters[0].serviceIds=['general'];assertStatus(()=>save(q,cfg),409);cfg.counters[0].serviceIds=[];cfg.counters.pop();assertStatus(()=>save(q,cfg),400);
});
test('unsafe or incomplete settings are rejected with an actionable validation response',()=>{
 const base=initialQueue(now).settings;
 for(const mutate of [s=>s.services.push({...s.services[0],id:'other'}),s=>s.services[0].enabled=false,s=>s.counters.forEach(c=>c.enabled=false),s=>s.logoUrl='javascript:alert(1)',s=>s.primaryColor='red',s=>s.voice.volume=9,s=>s.texts.nextCall='Sem identificação',s=>s.services[0].normalPrefix='123',s=>s.services[0].priorityEnabled='yes']){const cfg=structuredClone(base);mutate(cfg);assertStatus(()=>validateSettings(cfg),400);}
});
test('priority can be disabled per service; renaming does not rewrite previously issued tickets',()=>{
 const q=initialQueue(now);const old=applyAction(q,'take',{kind:'normal',requestId:'service-rename-01'},admin,now);const cfg=structuredClone(q.settings);cfg.services[0].name='Consultas';cfg.services[0].priorityEnabled=false;save(q,cfg);assert.equal(old.serviceName,'Atendimento');assertStatus(()=>applyAction(q,'take',{kind:'priority',requestId:'priority-off-001'},admin,now),400);
});
test('announcement templates interpolate all occurrences as text and logo formats are constrained',()=>{
 assert.equal(announcementText('{servico}: {senha}, {guiche}. Repito {senha}.',{code:'E-001',counter:'Sala 3',serviceName:'Exames'}),'Exames: E 001, Sala 3. Repito E 001.');
 assert.equal(validLogoUrl('/api/logo/12345678-1234-1234-1234-123456789012.png'),true);assert.equal(validLogoUrl('//external.example/image.png'),false);assert.equal(validLogoUrl('https://user:password@example.com/image.png'),false);
 assertStatus(()=>inspectLogo(new TextEncoder().encode('<svg onload="alert(1)"></svg>')),400);assertStatus(()=>inspectLogo(new Uint8Array(3*1024*1024)),400);assert.equal(inspectLogo(new Uint8Array([255,216,255,0])).contentType,'image/jpeg');
});
