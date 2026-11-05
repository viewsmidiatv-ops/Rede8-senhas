import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
const modulePath=process.env.PGLITE_MODULE||'@electric-sql/pglite';
const {PGlite}=await import(modulePath);
const db=new PGlite();
const migration=(await readdir('supabase/migrations')).find(n=>n.endsWith('_device_pairing.sql'));
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to service_role,anon,authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create function public.rls_auto_enable() returns event_trigger language plpgsql as $$begin null;end$$;`);
 await db.exec(await readFile('supabase/migrations/'+migration,'utf8'));
 await db.query("insert into public.tv_instances(id,verification_url,bridge_hash) values('rede8','https://test.chatgpt.site/aparelhos',$1)",['a'.repeat(64)]);
 const code='b'.repeat(64),token='c'.repeat(64);
 await db.query('select public.tv_pair_start($1,$2,$3,$4,$5)',['rede8',code,token,'TV Recepção','ip1']);
 const approved=await db.query('select public.tv_pair_approve($1,$2,$3,$4) as id',['rede8',code,'TV Recepção','owner']);assert.ok(approved.rows[0].id);
 await assert.rejects(db.query('select public.tv_pair_approve($1,$2,$3,$4)',['rede8',code,'TV duplicada','owner']));
 await db.query("update public.tv_devices set revoked_at=now() where token_hash=$1",[token]);
 assert.equal((await db.query('select count(*)::int as count from public.tv_devices where revoked_at is null')).rows[0].count,0);
 const payload={day:'2026-11-04',settings:{name:'Rede8'},tickets:[],counters:[],events:[]};
 const seeded=await db.query('select * from public.tv_queue_seed($1,$2,$3::jsonb)',['rede8',42,JSON.stringify(payload)]);assert.equal(Number(seeded.rows[0].revision),42);
 assert.equal((await db.query('select public.tv_queue_cas($1,$2,$3::jsonb) as written',['rede8',42,JSON.stringify({...payload,next:2})])).rows[0].written,true);
 assert.equal((await db.query('select public.tv_queue_cas($1,$2,$3::jsonb) as written',['rede8',42,JSON.stringify(payload)])).rows[0].written,false);
 const preserved=await db.query('select * from public.tv_queue_seed($1,$2,$3::jsonb)',['rede8',0,'{}']);assert.equal(Number(preserved.rows[0].revision),43);assert.equal(preserved.rows[0].payload.next,2);
 await db.exec('set role anon');await assert.rejects(db.query('select * from public.tv_devices'));await assert.rejects(db.query("select public.tv_queue_cas('rede8',43,'{}')"));await db.exec('reset role');
 await db.exec('set role authenticated');await assert.rejects(db.query('select * from public.tv_queue'));await db.exec('reset role');
 for(let i=0;i<10;i++)await db.query('select public.tv_pair_start($1,$2,$3,$4,$5)',['rede8',(100+i).toString().padStart(64,'0'),(200+i).toString().padStart(64,'0'),'Teste de limite','ip2']);
 await assert.rejects(db.query('select public.tv_pair_start($1,$2,$3,$4,$5)',['rede8','e'.repeat(64),'f'.repeat(64),'Tentativa adicional','ip2']));
 const rls=await db.query("select count(*)::int as count from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'tv_%' and c.relkind='r' and c.relrowsecurity");assert.equal(rls.rows[0].count,5);
 console.log('PASS: actual Postgres schema, one-use approval, revocation, atomic queue revision, migration seed preservation, anonymous/authenticated denial, rate limit and RLS.');
}finally{await db.close();}
