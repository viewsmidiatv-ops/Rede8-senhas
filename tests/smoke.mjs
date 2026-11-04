import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:net'
const scratch = await mkdtemp(join(tmpdir(), 'rede8-smoke-'))
const probe = createServer()
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve))
const port = probe.address().port
await new Promise(resolve => probe.close(resolve))
const root = fileURLToPath(new URL('../', import.meta.url))
const server = spawn(process.execPath, ['server/index.js'], { cwd: root, env: {...process.env, PORT: String(port), HOST: '127.0.0.1', SUPABASE_URL: '', SUPABASE_SERVICE_KEY: '', QUEUE_DATA_FILE: join(scratch, 'data.json')}, stdio:['ignore','pipe','pipe'] })
await new Promise((resolve,reject)=> { const timer=setTimeout(()=>reject(new Error('Server startup timeout')),15000);server.stdout.on('data',d=>{if(d.toString().includes('Queue server running')){clearTimeout(timer);resolve()}}); server.once('error',reject);server.once('exit',c=>reject(new Error('Server exited '+c))) })
import { io } from 'socket.io-client'
const base = `http://127.0.0.1:${port}`
const sockets=[]
async function connect(){
 const s=io(base,{transports:['websocket']});sockets.push(s)
 await new Promise((resolve,reject)=>{s.once('state:sync',state=>{s.initialState=state;resolve()});s.once('connect_error',reject)})
 return s
}
try {
 const reception=await connect(), display=await connect()
 const emit=(s,e,d)=>new Promise((resolve,reject)=>s.timeout(3000).emit(e,d,(err,r)=>err?reject(err):resolve(r)))
 const initial=reception.initialState
 assert.equal(initial.settings.uiLang,'pt')
 assert.equal(initial.settings.ttsProvider,'browser')
 assert.equal(initial.settings.elevenLabsApiKey,'')
 const response=await fetch(base+'/api/ticket',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({categoryId:'invalid'})})
 assert.equal(response.status,400)
 const normal=await emit(reception,'ticket:take',{categoryId:'normal'})
 const priority=await emit(reception,'ticket:take',{categoryId:'priority'})
 assert.equal(normal.displayNumber,'N-001')
 assert.equal(priority.displayNumber,'P-002')
 const announced=new Promise(resolve=>display.once('ticket:announced',resolve))
 const called=await emit(reception,'ticket:call',{counterId:1})
 assert.equal(called.number,priority.number)
 assert.equal((await announced).ticketNumber,'P-002')
 assert.equal((await emit(reception,'ticket:recall',{counterId:1})).number,priority.number)
 assert.equal((await emit(reception,'ticket:call',{counterId:2})).number,normal.number)
 assert.equal((await emit(reception,'ticket:complete',{counterId:1})).status,'served')
 for(const route of ['/retirar','/recepcao','/painel']) {
  const r=await fetch(base+route);assert.equal(r.status,200);assert.match(await r.text(),/Rede8/)
 }
 console.log('PASS: REST validation, normal/priority issuance, priority selection, cross-client announcement, recall, two-counter isolation, completion and three URL routes')
} finally { sockets.forEach(s=>s.disconnect()); server.kill(); await new Promise(resolve => server.once('close', resolve)); await rm(scratch, { recursive: true, force: true }) }
