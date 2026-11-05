import {createHandler} from './handler.mjs';
const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
const secret=keys.default||Object.values(keys)[0]||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if(!secret)throw new Error('Missing server credentials');
Deno.serve(createHandler({url:Deno.env.get('SUPABASE_URL')!,secret,legacy:!String(secret).startsWith('sb_secret_')}));
