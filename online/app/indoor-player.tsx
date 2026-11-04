'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {Indoor} from '../lib/indoor';
export default function IndoorPlayer({config}:{config:Indoor}){
 const signature=JSON.stringify(config.items),items=useMemo(()=>config.items.filter(i=>i.enabled),[signature]);
 const [index,setIndex]=useState(0),[failed,setFailed]=useState(false),[blocked,setBlocked]=useState(false),video=useRef<HTMLVideoElement>(null);
 const item=items[index%Math.max(1,items.length)];
 useEffect(()=>{setIndex(0);},[signature]);
 useEffect(()=>{setFailed(false);setBlocked(false);if(!item)return;const timeout=setTimeout(()=>setIndex(i=>i+1),(item.kind==='image'?item.seconds:300)*1000);return()=>clearTimeout(timeout);},[item?.id,index,item?.seconds]);
 useEffect(()=>{if(!item||item.kind!=='video')return;const node=video.current;if(node){node.muted=true;node.play().catch(()=>setBlocked(true));}},[item?.id,index]);
 useEffect(()=>{if(!failed)return;const timer=setTimeout(()=>setIndex(i=>i+1),3000);return()=>clearTimeout(timer);},[failed,index]);
 if(!item)return null;
 return <section className="indoor-player" aria-label="Conteúdos da recepção" style={{'--media-fit':config.fit} as React.CSSProperties}>
 {failed?<p role="status">Conteúdo indisponível. Tentando o próximo…</p>:item.kind==='video'?<video key={`${item.id}-${index}`} ref={video} src={item.url} muted autoPlay playsInline preload="auto" onEnded={()=>setIndex(i=>i+1)} onError={()=>setFailed(true)} aria-label={item.name}/>:<img key={`${item.id}-${index}`} src={item.url} alt={item.name} onError={()=>setFailed(true)}/>}
 {blocked&&!failed&&<button className="btn secondary media-play" onClick={()=>{if(video.current){video.current.muted=true;video.current.play().then(()=>setBlocked(false)).catch(()=>setBlocked(true));}}}>Iniciar vídeos sem áudio</button>}
 </section>;
}
