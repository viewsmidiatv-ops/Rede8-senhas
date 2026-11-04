import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler'));
const {Miniflare}=wr('miniflare'),{build}=wr('esbuild');
const bundle=await build({stdin:{contents:`
import {actorFor,loadQueue,mutateQueue} from './lib/queue-db';
import {publicQueue} from './lib/queue';
import {checkMutationRequest} from './lib/request-security';
export default {async fetch(request){
 try{
  const data=await request.json();
  if(data.checkOrigin){checkMutationRequest(new Request('https://test.local/api/queue',{method:'POST',headers:data.headers}));return Response.json({ok:true});}
  if(!data.user)return Response.json({error:'unauthenticated'},{status:401});
  const actor=await actorFor(data.user);
  if(data.action==='state'){const state=await loadQueue();return Response.json({actor,...state,public:publicQueue(state.queue)});}
  const result=await mutateQueue(data.action,data.data||{},actor);return Response.json({actor,...result});
 }catch(e){return Response.json({error:e.message},{status:e.status||500});}
}}
`,resolveDir:process.cwd(),sourcefile:'database-fixture.ts',loader:'ts'},bundle:true,write:false,format:'esm',platform:'browser',external:['cloudflare:workers'],logLevel:'silent'});
const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-05-15',d1Databases:{DB:'test-db'},cf:false});
const owner={userId:'test-owner',email:'owner@example.test',displayName:'Owner',fullName:null},op={userId:'test-operator',email:'op@example.test',displayName:'Op',fullName:null},visitor={userId:'test-visitor',email:'visitor@example.test',displayName:'Visitor',fullName:null};
async function request(user,action,data={}){const r=await mf.dispatchFetch('https://test.local/test',{method:'POST',body:JSON.stringify({user,action,data})});return {status:r.status,body:await r.json()};}
try{
 const db=await mf.getD1Database('DB');
 const migration=(await readdir('drizzle')).find(n=>n.endsWith('.sql'));
 const sql=await readFile('drizzle/'+migration,'utf8');
 for(const statement of sql.split('--> statement-breakpoint'))await db.prepare(statement).run();
 assert.equal((await request(null,'state')).status,401);
 assert.equal((await request(owner,'state')).body.actor.role,'admin');
 assert.equal((await request(visitor,'state')).body.actor.role,'visitor');
 assert.equal((await request(visitor,'call',{counterId:1})).status,403);
 await db.prepare("INSERT INTO queue_members(email,role,enabled) VALUES (?,'operator',1)").bind(op.email).run();
 assert.equal((await request(op,'state')).body.actor.role,'operator');
 assert.equal((await request(op,'reset')).status,403);
 const requests=await Promise.all(Array.from({length:6},(_,i)=>request(visitor,'take',{kind:i%2?'priority':'normal',requestId:'parallel-request-'+i})));
 assert.deepEqual(requests.map(r=>r.status),[200,200,200,200,200,200]);
 const ids=requests.map(r=>r.body.result.id);assert.equal(new Set(ids).size,6);
 const retry=await request(visitor,'take',{kind:'normal',requestId:'parallel-request-0'});assert.equal(retry.body.result.id,requests[0].body.result.id);
 await request(op,'claim',{counterId:1});
 const called=await Promise.all([request(op,'call',{counterId:1}),request(owner,'call',{counterId:2})]);assert.equal(called[0].status,200);assert.equal(called[1].status,200);
 const state=(await request(owner,'state')).body;
 assert.notEqual(state.queue.counters[0].current,state.queue.counters[1].current);assert.equal(state.queue.tickets.filter(t=>t.status==='serving').length,2);assert.equal(state.queue.tickets.filter(t=>t.status==='serving').every(t=>t.kind==='priority'),true);
 assert.equal(JSON.stringify(state.public).includes('operatorId'),false);assert.equal(JSON.stringify(state.public).includes(op.email),false);
 const persisted=await db.prepare('SELECT revision,payload FROM queue_state WHERE key=1').first();assert.equal(JSON.parse(persisted.payload).tickets.length,6);assert.ok(persisted.revision>=9);
 const config=structuredClone(state.queue.settings);config.name='Cliente configurado';config.voice.rate=1.1;
 assert.equal((await request(op,'settings:save',{configVersion:0,settings:config})).status,403);
 const simultaneous=await Promise.all([request(owner,'settings:save',{configVersion:0,settings:config}),request(visitor,'take',{kind:'normal',requestId:'parallel-with-config'})]);
 assert.deepEqual(simultaneous.map(r=>r.status),[200,200]);
 const afterConfig=(await request(owner,'state')).body;
 assert.equal(afterConfig.queue.settings.name,'Cliente configurado');assert.equal(afterConfig.queue.configVersion,1);assert.equal(afterConfig.queue.tickets.length,7);
 assert.equal((await request(owner,'settings:save',{configVersion:0,settings:config})).status,409);
 const savedConfig=await db.prepare('SELECT payload FROM queue_state WHERE key=1').first();assert.equal(JSON.parse(savedConfig.payload).settings.voice.rate,1.1);
 await db.prepare('UPDATE queue_members SET enabled=0 WHERE email=?').bind(op.email).run();assert.equal((await request(op,'complete',{counterId:1})).status,403);
 for(const [origin,expected]of [['https://attacker.test',403],['https://test.local',200]]){const r=await mf.dispatchFetch('https://test.local/test',{method:'POST',body:JSON.stringify({checkOrigin:true,headers:{origin,'content-type':'application/json'}})});assert.equal(r.status,expected);}
 console.log('PASS: D1 persistence, atomic concurrent issuance, idempotency, role binding/revocation, two-counter isolation, public projection CSRF origin validation, settings persistence and concurrent settings/issuance.');
}finally{await mf.dispose();}
