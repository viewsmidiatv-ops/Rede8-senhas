import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 if(!await getChatGPTUser())return new Response('Não autorizado',{status:401});
 const {id}=await params;if(!/^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(id)||!env.BUCKET)return new Response('Não encontrado',{status:404});
 const image=await env.BUCKET.get(`logos/${id}`);if(!image)return new Response('Não encontrado',{status:404});
 return new Response(image.body,{headers:{'Content-Type':image.httpMetadata?.contentType||'application/octet-stream','Content-Length':String(image.size),'Cache-Control':'private, max-age=86400','X-Content-Type-Options':'nosniff','ETag':image.httpEtag}});
}
