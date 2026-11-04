import {QueueError} from './queue';
export function checkMutationRequest(request:Request){
 const origin=request.headers.get('origin');
 if(!origin||origin!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')throw new QueueError(403,'Origem da solicitação não permitida.');
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new QueueError(415,'Use uma solicitação JSON.');
}
