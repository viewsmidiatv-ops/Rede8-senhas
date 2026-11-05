import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler')),{Miniflare}=wr('miniflare'),{build}=wr('esbuild');
const bundle=await build({stdin:{contents:`import {POST} from './app/api/media/route';import {GET} from './app/api/media/[id]/route';export default{async fetch(request){globalThis.testRole=request.headers.get('x-test-role');return request.method==='POST'?POST(request):GET(request,{params:Promise.resolve({id:new URL(request.url).pathname.split('/').pop()})});}}`,resolveDir:process.cwd(),sourcefile:'media-fixture.ts',loader:'ts'},bundle:true,write:false,format:'esm',platform:'browser',external:['cloudflare:workers'],logLevel:'silent',plugins:[{name:'test-identities',setup(b){b.onResolve({filter:/chatgpt-auth$/},()=>({path:'auth',namespace:'test'}));b.onResolve({filter:/queue-db$/},()=>({path:'roles',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},({path})=>({contents:path==='auth'?`export async function getChatGPTUser(){return globalThis.testRole?{userId:'test',email:'test@example.test'}:null;}`:`export async function actorFor(){return {role:globalThis.testRole};}`,loader:'js'}));}}]});
const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-05-15',r2Buckets:{BUCKET:'test-media'},cf:false});
const bytes=new Uint8Array([0,0,0,24,102,116,121,112,105,115,111,109,0,0,0,0,5,6,7,8]);
async function upload(role,body=bytes,origin='https://test.local'){return mf.dispatchFetch('https://test.local/api/media',{method:'POST',headers:{...(role?{'x-test-role':role}:{}),origin,'content-type':'application/octet-stream'},body});}
try{
 assert.equal((await upload(null)).status,401);assert.equal((await upload('operator')).status,403);assert.equal((await upload('admin',bytes,'https://other.test')).status,403);assert.equal((await upload('admin',new TextEncoder().encode('<html>bad</html>'))).status,415);
 const sent=await upload('admin');assert.equal(sent.status,200);const asset=await sent.json();assert.equal(asset.kind,'video');
 const read=(range,role='visitor')=>mf.dispatchFetch(`https://test.local${asset.url}`,{headers:{...(role?{'x-test-role':role}:{}),...(range?{range}:{})}});
 assert.equal((await read(null,null)).status,401);
 const full=await read();assert.equal(full.status,200);assert.equal(full.headers.get('content-type'),'video/mp4');assert.deepEqual(new Uint8Array(await full.arrayBuffer()),bytes);
 const part=await read('bytes=4-7');assert.equal(part.status,206);assert.equal(part.headers.get('content-range'),'bytes 4-7/20');assert.deepEqual(new Uint8Array(await part.arrayBuffer()),bytes.slice(4,8));assert.equal((await read('bytes=90-')).status,416);
 console.log('PASS: actual media routes enforce authentication, admin uploads, origin, file signatures and authenticated R2 full/range playback.');
}finally{await mf.dispose();}
