import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {mediaIdPattern,parseMediaRange} from '../../../../lib/indoor';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!await getChatGPTUser())return new Response('Não autorizado',{status:401});
 const {id}=await params;if(!mediaIdPattern.test(id)||!env.BUCKET)return new Response('Não encontrado',{status:404});
 const key=`media/${id}`,head=await env.BUCKET.head(key);if(!head)return new Response('Não encontrado',{status:404});
 let range;try{range=parseMediaRange(request.headers.get('range'),head.size);}catch{return new Response(null,{status:416,headers:{'Content-Range':`bytes */${head.size}`}});}
 const object=await env.BUCKET.get(key,range?{range}:undefined);if(!object)return new Response('Não encontrado',{status:404});
 const headers:Record<string,string>={'Content-Type':head.httpMetadata?.contentType||'application/octet-stream','Content-Length':String(range?.length??head.size),'Accept-Ranges':'bytes','Cache-Control':'private, max-age=86400','X-Content-Type-Options':'nosniff',ETag:head.httpEtag};
 if(range)headers['Content-Range']=`bytes ${range.offset}-${range.offset+range.length-1}/${head.size}`;
 return new Response(object.body,{status:range?206:200,headers});
}
