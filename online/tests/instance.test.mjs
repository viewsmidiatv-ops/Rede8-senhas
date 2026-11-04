import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {validateInstance} from '../lib/instance-config.mjs';
const rede8=JSON.parse(await readFile(new URL('../instances/rede8.json',import.meta.url),'utf8'));
const example=JSON.parse(await readFile(new URL('../instances/example.json',import.meta.url),'utf8'));
test('each customer configuration has its own identity and brand without mutating the base',()=>{
 const a=validateInstance(rede8),b=validateInstance(example);assert.notEqual(a.id,b.id);assert.notEqual(a.primaryColor,b.primaryColor);b.counterNames.push('Extra');assert.equal(a.counterNames.length,2);assert.equal(example.counterNames.length,2);
});
test('reject unsafe logos, invalid styles, duplicate counters and out-of-range voice',()=>{
 for(const patch of [{logoUrl:'javascript:alert(1)'},{primaryColor:'red;display:none'},{counterNames:['A','a']},{id:'../rede8'},{voice:{language:'pt-BR',rate:9}}])assert.throws(()=>validateInstance({...example,...patch}));
});
test('new customer checkout never inherits Site identity, runtime data or the current client configuration',async()=>{
 const scratch=await mkdtemp(join(tmpdir(),'queue-instance-'));
 try{
  const dest=join(scratch,'customer');
  execFileSync(process.execPath,['scripts/prepare-instance.mjs','--config','instances/example.json','--out',dest],{cwd:process.cwd(),stdio:'pipe'});
  const manifest=JSON.parse(await readFile(join(dest,'.openai/hosting.json'),'utf8'));
  assert.equal(manifest.project_id,undefined);assert.equal(manifest.d1,'DB');
  assert.equal(JSON.parse(await readFile(join(dest,'config/instance.json'),'utf8')).id,'novo-cliente');
  const names=await readdir(dest);for(const forbidden of ['.git','.wrangler','.sites-runtime','node_modules','dist','deployments','instances'])assert.equal(names.includes(forbidden),false);
  assert.throws(()=>execFileSync(process.execPath,['scripts/prepare-instance.mjs','--config','instances/example.json','--out',dest],{stdio:'pipe'}));
 }finally{await rm(scratch,{recursive:true,force:true});}
});
