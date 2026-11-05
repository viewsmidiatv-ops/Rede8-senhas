import {requireChatGPTUser} from './chatgpt-auth';
import QueueApp from './queue-app';
export const dynamic='force-dynamic';
export default async function Home(){await requireChatGPTUser('/');return <QueueApp mode="home"/>;}
