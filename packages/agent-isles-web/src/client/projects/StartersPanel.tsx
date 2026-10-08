import { useEffect, useRef, useState } from 'react'
import type { Starter } from '../../projects/starters.js'
import type { Preview } from '../../projects/preview.js'
import { api, command } from './api.js'
import { translator, errorText } from './words.js'
export function StartersPanel({en,copy,legacy}:{en:boolean;copy(id:string,idea:string):Promise<void>;legacy():void}) {
  const t=translator(en),[items,setItems]=useState<Starter[]>([]),[selected,setSelected]=useState<Starter>(),[preview,setPreview]=useState<Preview>(),[title,setTitle]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const requests=useRef(new Map<string,string>())
  const mounted=useRef(true),ownedPreview=useRef<string>()
  useEffect(()=>{mounted.current=true;void api<Starter[]>('starters').then(s=>{if(mounted.current)setItems(s)}).catch(e=>{if(mounted.current)setError(errorText(e,en))});return()=>{mounted.current=false;if(ownedPreview.current)void command({op:'starter-stop',previewId:ownedPreview.current}).catch(()=>{})}},[])
  async function play(){if(ownedPreview.current)await command({op:'starter-stop',previewId:ownedPreview.current});const p=await command<Preview>({op:'starter-preview',starterId:selected!.id});if(mounted.current){ownedPreview.current=p.id;setPreview(p)}else await command({op:'starter-stop',previewId:p.id})}
  async function run(fn:()=>Promise<void>){if(busy)return;setBusy(true);setError('');try{await fn()}catch(e){setError(errorText(e,en))}finally{setBusy(false)}}
  return <section><p>{t('starterHint')}</p><div className="ci-gallery">{items.map(item=><button key={item.id} disabled={busy} aria-pressed={selected?.id===item.id} onClick={()=>{setSelected(item);setTitle(item.title[en?1:0])}}><strong>{item.title[en?1:0]}</strong><p>{item.description[en?1:0]}</p><small>v{item.version}</small></button>)}</div>
    {selected&&<div className="ci-item"><h2>{selected.title[en?1:0]}</h2><p>{selected.description[en?1:0]}</p><p className="ci-muted">{t('starterStorage')}</p><label>{t('title')}<input maxLength={80} value={title} onChange={e=>setTitle(e.target.value)}/></label><div className="ci-actions"><button disabled={busy} onClick={()=>void run(play)}>{t('starterPlay')}</button><button className="ci-primary" disabled={busy||!title.trim()} onClick={()=>void run(async()=>{
      const key=JSON.stringify([selected.id,title]),storageKey=`ci-starter-copy:${key}`,requestId=requests.current.get(key)??sessionStorage.getItem(storageKey)??crypto.randomUUID();requests.current.set(key,requestId);sessionStorage.setItem(storageKey,requestId)
      const p=await command({op:'starter-copy',starterId:selected.id,title,requestId});if(mounted.current)await copy(p.id,selected.suggestion[en?1:0]);requests.current.delete(key);sessionStorage.removeItem(storageKey)
    })}>{t('starterCopy')}</button><button disabled={busy} onClick={()=>setSelected(undefined)}>{t('cancel')}</button></div>{busy&&<p role="status">{t('starterWorking')}</p>}</div>}
    {preview?.state==='ready'&&<><iframe className="ci-preview" src={preview.url} sandbox="allow-scripts allow-forms allow-same-origin allow-modals" referrerPolicy="no-referrer" title={t('starterPlay')}/><button disabled={busy} onClick={()=>void run(async()=>{await command({op:'starter-stop',previewId:preview.id});setPreview(undefined)})}>{t('starterStop')}</button></>}
    {preview?.state==='failed'&&<p className="ci-error">{preview.log}</p>}{error&&<p className="ci-error" role="alert">{error}</p>}<p><button onClick={legacy}>{t('legacy')}</button></p>
  </section>
}
