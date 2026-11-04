// Prepare a clean checkout from the canonical base; never copy Site identity,
// credentials, runtime databases, generated output or another customer's config.
import {readFile,writeFile,mkdir,readdir,copyFile} from 'node:fs/promises';
import {resolve,dirname,relative,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {validateInstance} from '../lib/instance-config.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2), get=flag=>args[args.indexOf(flag)+1];
if(!args.includes('--config')||!args.includes('--out')){console.error('Usage: node scripts/prepare-instance.mjs --config <client.json> --out <new-empty-directory>');process.exit(1);}
const dest=resolve(get('--out')),config=validateInstance(JSON.parse(await readFile(resolve(get('--config')),'utf8')));
if(dest===root||!relative(root,dest).startsWith('..'))throw new Error('Use um destino fora da pasta da base.');
await mkdir(dest,{recursive:true});if((await readdir(dest)).length)throw new Error('O destino precisa estar vazio. Nenhum arquivo foi alterado.');
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
for(const file of [...new Set(files)]){
 if(file==='.openai/hosting.json'||file==='config/instance.json'||file.startsWith('instances/')||file.startsWith('deployments/')||file.startsWith('outputs/')||file.startsWith('.sites-runtime/')||file.startsWith('.wrangler/')||file.split('/').some(part=>part.startsWith('.env')||part.startsWith('.dev.vars')))continue;
 const source=resolve(root,file);if(!source.startsWith(root+'/'))throw new Error('Caminho de origem inválido.');
 const target=join(dest,file);await mkdir(dirname(target),{recursive:true});await copyFile(source,target);
}
await mkdir(join(dest,'config'),{recursive:true});await mkdir(join(dest,'.openai'),{recursive:true});
await writeFile(join(dest,'config/instance.json'),JSON.stringify(config,null,2)+'\n');
await writeFile(join(dest,'.openai/hosting.json'),JSON.stringify({d1:'DB',r2:'BUCKET'},null,2)+'\n');
console.log(JSON.stringify({prepared:true,instance:config.id,directory:dest,requires:'Register a NEW Site; persist its returned project_id; publish with its own D1. Do not reuse an existing customer Site ID.'}));
