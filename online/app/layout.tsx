import type {Metadata} from 'next';
import {INSTANCE} from '../lib/instance.mjs';
import './globals.css';
export const metadata:Metadata={title:`${INSTANCE.name} • Senhas`,description:`Sistema de atendimento de ${INSTANCE.name}.`,icons:{icon:INSTANCE.logoUrl||'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body style={{'--purple':INSTANCE.primaryColor,'--accent':INSTANCE.accentColor} as React.CSSProperties}>{children}</body></html>;}
