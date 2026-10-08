import { useEffect, useRef, useState } from 'react'
import type { Starter } from '../../projects/starters.js'
import type { Preview } from '../../projects/preview.js'
import { api, command } from './api.js'
import { translator, errorText } from './words.js'

export function StartersPanel({en,copy,legacy}:{en:boolean;copy(id:string,idea:string):Promise<void>;legacy():void}) {
  const t=translator(en),[items,setItems]=useState<Starter[]>([]),[page,setPage]=useState(0),[preview,setPreview]=useState<Preview>(),[title,setTitle]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const selected=items[page],requests=useRef(new Map<string,string>()),mounted=useRef(true),ownedPreview=useRef<string>()
  useEffect(()=>{
    mounted.current=true
    void api<Starter[]>('starters').then(s=>{if(mounted.current)setItems(s)}).catch(e=>{if(mounted.current)setError(errorText(e,en))})
    return()=>{mounted.current=false;if(ownedPreview.current)void command({op:'starter-stop',previewId:ownedPreview.current}).catch(()=>{})}
  },[])
  async function stop(){if(ownedPreview.current){await command({op:'starter-stop',previewId:ownedPreview.current});ownedPreview.current=undefined}setPreview(undefined)}
  async function play(){await stop();const p=await command<Preview>({op:'starter-preview',starterId:selected!.id});if(mounted.current){ownedPreview.current=p.id;setPreview(p)}else await command({op:'starter-stop',previewId:p.id})}
  async function run(fn:()=>Promise<void>){if(busy)return;setBusy(true);setError('');try{await fn()}catch(e){setError(errorText(e,en))}finally{setBusy(false)}}
  const copyTitle=title.trim()||selected?.title[en?1:0]||''
  return <section>
    <p className="ci-dialogue-line">{t('starterHello')}</p>
    {selected&&<article className="ci-starter-page">
      <div className="ci-page-number"><span>{String(page+1).padStart(2,'0')} / {String(items.length).padStart(2,'0')}</span><span>{t('inspiration')}</span></div>
      <h2>{selected.title[en?1:0]}</h2><p>{selected.description[en?1:0]}</p>
      <div className="ci-actions"><button className="ci-primary" disabled={busy} onClick={()=>void run(play)}>{t('starterPlay')}</button><button disabled={busy} onClick={()=>void run(async()=>{
        const key=JSON.stringify([selected.id,copyTitle]),storageKey='ci-starter-copy:'+key,requestId=requests.current.get(key)??sessionStorage.getItem(storageKey)??crypto.randomUUID()
        requests.current.set(key,requestId);sessionStorage.setItem(storageKey,requestId)
        const p=await command({op:'starter-copy',starterId:selected.id,title:copyTitle,requestId})
        if(mounted.current)await copy(p.id,selected.suggestion[en?1:0])
        requests.current.delete(key);sessionStorage.removeItem(storageKey)
      })}>{t('starterCopy')}</button></div>
      <details><summary>{t('starterRename')}</summary><label>{t('title')}<input maxLength={80} value={title} placeholder={selected.title[en?1:0]} onChange={e=>setTitle(e.target.value)}/></label></details>
      <div className="ci-page-turn"><button disabled={busy||page===0} onClick={()=>void run(async()=>{await stop();setTitle('');setPage(page-1)})}>{t('previousPage')}</button><button disabled={busy||page===items.length-1} onClick={()=>void run(async()=>{await stop();setTitle('');setPage(page+1)})}>{t('nextPage')}</button></div>
      <p className="ci-muted">{t('starterHint')}</p>
    </article>}
    {!selected&&!error&&<p>{t('loading')}</p>}
    {busy&&<p role="status">{t('starterWorking')}</p>}
    {preview?.state==='ready'&&<div className="ci-starter-demo"><iframe className="ci-preview" src={preview.url} sandbox="allow-scripts allow-forms allow-same-origin allow-modals" referrerPolicy="no-referrer" title={selected?.title[en?1:0]??t('starterPlay')}/><p className="ci-muted">{t('starterStorage')}</p><button disabled={busy} onClick={()=>void run(stop)}>{t('starterStop')}</button></div>}
    {preview?.state==='failed'&&<p className="ci-error">{preview.log}</p>}{error&&<p className="ci-error" role="alert">{error}</p>}
    <details className="ci-secondary"><summary>{t('legacy')}</summary><button onClick={legacy}>{t('legacy')}</button></details>
  </section>
}
