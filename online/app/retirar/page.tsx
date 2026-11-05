import {requireChatGPTUser} from '../chatgpt-auth';
import QueueApp from '../queue-app';
export const dynamic='force-dynamic';
export default async function Page(){await requireChatGPTUser('/retirar');return <QueueApp mode="kiosk"/>;}
