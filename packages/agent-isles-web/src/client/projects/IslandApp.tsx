import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { AgentIslesWorldInjected } from '../AgentIslesWorld.js'
import { NativeChat } from '../NativeChat.js'
import { ModelSettings } from '../ModelSettings.js'
import { CreationApp } from '../creation/App.js'
import { NS } from '../locales.js'
import { WORLD_BRIDGE_VERSION, isWorldToHostMessage, type ResidentId } from '../world-bridge.js'
import { ResidentNotifications, type NotificationSession } from '../ResidentNotifications.js'
import { projectResidentEvents } from '../resident-model.js'
import { translator, errorText, type Word } from './words.js'
import { api, command, download } from './api.js'
import { islandStyles } from './styles.js'
import type { Achievement, Run } from '../../projects/service.js'
import type { Preview, Recipe } from '../../projects/preview.js'

type Props=PropsRuntime<'shell.overlay'> & PropsLocale<typeof NS> & AgentIslesWorldInjected
type Panel='chat'|'projects'|'files'|'changes'|'preview'|'versions'|'save'|'inspiration'|'help'|null
interface ProjectData { builds?:{buildId:string;versionId:string;directory:string;log:string}[]; id:string; title:string; path:string; revision:number; achievements:Achievement[]; slots:(string|null)[]; runs:Run[]; previews:Preview[]; recipes:Recipe[]; active:{projectId:string;sessionId:string}|null }
const portraits={chat:'aqi',projects:'shiye',files:'adu'}
const storedIdeas=()=>{try{return JSON.parse(storage('ci-project-ideas','{}')) as Record<string,string>}catch{return {}}}
const storage=(key:string,fallback='')=> {try{return localStorage.getItem(key)??fallback}catch{return fallback}}
export function IslandApp(props:Props) {
  const locale=useSyncExternalStore(props.localeState.subscribe.bind(props.localeState),props.localeState.getSnapshot.bind(props.localeState)).active
  const en=!locale.startsWith('zh'),t=translator(en)
  useEffect(()=>{document.documentElement.style.setProperty('--agent-isles-hero-title',JSON.stringify(t('start')));document.documentElement.style.setProperty('--agent-isles-hero-subtitle',JSON.stringify(t('welcome')))},[en])
  const workspaces=props.useWorkspaces(s=>s.items),sessions=props.useSessions(s=>s),pending=props.useSessionPendingInteraction(s=>s)
  const [projectId,setProjectId]=useState<string>(),[data,setData]=useState<ProjectData>(),[panel,setPanel]=useState<Panel>(null),[bindingId,setBindingId]=useState<string>(),[modelSettings,setModelSettings]=useState(false)
  const [focus,setFocus]=useState(false),[light,setLight]=useState(storage('ci-light')==='true'),[reduced,setReduced]=useState(storage('ci-reduced',String(matchMedia('(prefers-reduced-motion: reduce)').matches))==='true')
  const [previewEpoch,setPreviewEpoch]=useState(0),[ready,setReady]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[restored,setRestored]=useState(false)
  const [title,setTitle]=useState(''),[idea,setIdea]=useState(storage('ci-new-idea')),[existingPath,setExistingPath]=useState(''),[parent,setParent]=useState<string>(),[note,setNote]=useState(''),[version,setVersion]=useState<string>(),[versionRecipes,setVersionRecipes]=useState<Recipe[]>([])
  const [filePath,setFilePath]=useState(''),[file,setFile]=useState<any>(),[changes,setChanges]=useState<any>(),[search,setSearch]=useState('')
  const frame=useRef<HTMLIFrameElement>(null),aside=useRef<HTMLElement>(null),lastTrigger=useRef<HTMLElement|null>(null),selectedRef=useRef(projectId)
  selectedRef.current=projectId
  const [projectIdeas,setProjectIdeas]=useState<Record<string,string>>(storedIdeas)
  const projectIdea=projectId?projectIdeas[projectId]??'':''
  useEffect(()=>{try{localStorage.setItem('ci-project-ideas',JSON.stringify(projectIdeas))}catch{}},[projectIdeas])
  const [legacy,setLegacy]=useState(false)
  const [workbench,setWorkbench]=useState(()=>location.pathname==='/workbench'||new URLSearchParams(location.search).get('agent-isles')==='workbench')
  const binding=bindingId?props.getBinding(bindingId):undefined
  const current=workspaces.find(p=>p.workspaceId===projectId)
  const lastRun=data?.runs.at(-1),preview=data?.previews.filter(p=>p.versionId===version).at(-1),a=data?.achievements.find(a=>a.id===version)
  const [,rerender]=useState(0)
  useEffect(()=>binding?.session.subscribe(()=>rerender(n=>n+1)),[binding])
  useEffect(()=>binding?.eventSource.subscribe(()=>rerender(n=>n+1)),[binding])
  useEffect(()=>{void props.restoreProject().then(id=>{setProjectId(id);setRestored(true)}).catch(e=>setError(errorText(e,en)))},[])
  useEffect(()=>{try{localStorage.setItem('ci-new-idea',idea)}catch{}},[idea])
  useEffect(()=>{try{localStorage.setItem('ci-light',String(light));localStorage.setItem('ci-reduced',String(reduced))}catch{}},[light,reduced])
  useEffect(()=>{
    const root=document.querySelector<HTMLElement>('[data-shell-overlay]')?.parentElement
    if(!workbench && !legacy) root?.setAttribute('data-agent-isles-town','')
    return()=>root?.removeAttribute('data-agent-isles-town')
  },[workbench,legacy])
  const refresh=async(id=selectedRef.current)=>{if(!id)return;const result=await api<ProjectData>('state',id);if(selectedRef.current===id)setData(result)}
  useEffect(()=>{
    setData(undefined);setVersion(undefined);setFilePath('');setFile(undefined);setChanges(undefined);setBindingId(undefined)
    if(!projectId)return
    void props.saveProject(projectId).catch(e=>setError(errorText(e,en)))
    let active=true
    const poll=()=>void refresh(projectId).catch(e=>{if(active)setError(errorText(e,en))})
    poll();const timer=setInterval(poll,2500);return()=>{active=false;clearInterval(timer)}
  },[projectId])
  useEffect(()=>{
    if(!['chat','preview'].includes(panel??'')||!projectId||!restored)return
    let active=true
    void props.selectResident('coder',projectId).then(id=>{if(active){setBindingId(id);props.focusSession(id)}}).catch(e=>{if(active)setError(errorText(e,en))})
    return()=>{active=false}
  },[projectId,panel,restored])
  useEffect(()=>{if(!bindingId)return;props.blockComposer?.(bindingId,data?.active||runningSession()?t('busy'):undefined);return()=>props.blockComposer?.(bindingId,undefined)},[bindingId,data?.active?.sessionId,sessions])
  function runningSession(){return Object.values(sessions.byId).some(s=>s.running)}
  function close(){setPanel(null);setModelSettings(false);setFocus(false);setError('');lastTrigger.current?.focus()}
  function show(next:Panel){lastTrigger.current=document.activeElement as HTMLElement;setPanel(next);setError('');setFocus(false)}
  const act=async(fn:()=>Promise<unknown>)=>{setBusy(true);setError('');try{await fn();await refresh()}catch(e){setError(errorText(e,en))}finally{setBusy(false)}}
  useEffect(()=>{if(panel)aside.current?.focus()},[panel])
  useEffect(()=>{
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!event.defaultPrevented&&!document.querySelector('[role="dialog"],dialog[open],[role="menu"]')){event.preventDefault();close()}}
    window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape)
  },[])
  useEffect(()=>{
    const listener=(event:MessageEvent)=>{
      if(event.source!==frame.current?.contentWindow||event.origin!==location.origin||!isWorldToHostMessage(event.data))return
      if(event.data.type==='world:ready'||event.data.type==='world:playable')setReady(true)
      if(event.data.type==='resident:selected'){const map:Record<ResidentId,Panel>={coder:'chat',teacher:'projects',file_keeper:'files',coordinator:'inspiration'};show(map[event.data.payload.residentId])}
      if(event.data.type==='showcase:selected'){setVersion(data?.slots[event.data.payload.slot]??undefined);show('versions')}
    };window.addEventListener('message',listener);return()=>window.removeEventListener('message',listener)
  },[data])
  const activeSession=projectId?props.sessionForResident(projectId,'coder'):undefined
  const running=!!(activeSession&&sessions.byId[activeSession as SessionId]?.running)
  const waiting=!!(activeSession&&pending.has(activeSession as SessionId))
  const residents=[{id:'coder',displayName:t('start'),status:waiting?'approval':running?'working':lastRun?.state==='interrupted'?'failed':'idle'},{id:'teacher',displayName:t('projects'),status:'idle'},{id:'file_keeper',displayName:t('files'),status:'idle'},{id:'coordinator',displayName:t('inspiration'),status:'idle'}]
  const worldState=JSON.stringify({locale:en?'en':'zh',workspace:current?{workspaceId:current.workspaceId,title:current.title}:null,sessionId:activeSession??null,panelOpen:!!panel||modelSettings,residents,reducedMotion:reduced})
  useEffect(()=>{if(ready)frame.current?.contentWindow?.postMessage({source:'agent-isles-host',version:WORLD_BRIDGE_VERSION,type:'world:init',payload:JSON.parse(worldState)},location.origin)},[ready,worldState])
  useEffect(()=>{if(ready)frame.current?.contentWindow?.postMessage({source:'agent-isles-host',version:WORLD_BRIDGE_VERSION,type:'project:showcase',payload:(data?.slots??Array(6).fill(null)).map(id=>{const a=data?.achievements.find(a=>a.id===id);return a?{versionId:a.id,title:a.title}:null})},location.origin)},[ready,data?.revision,projectId])
  useEffect(()=>{let active=true;setFile(undefined);if(panel==='files'&&projectId)void api('files',projectId,{path:filePath}).then(v=>{if(active)setFile(v)}).catch(e=>{if(active)setError(errorText(e,en))});return()=>{active=false}},[panel,projectId,filePath])
  useEffect(()=>{let active=true;setChanges(undefined);if(panel==='changes'&&projectId)void api('changes',projectId).then(v=>{if(active)setChanges(v)}).catch(e=>{if(active)setError(errorText(e,en))});return()=>{active=false}},[panel,projectId,lastRun?.state])
  useEffect(()=>{let active=true;setVersionRecipes([]);if(version&&projectId)void api<Recipe[]>('version-recipes',projectId,{version}).then(v=>{if(active)setVersionRecipes(v)}).catch(e=>{if(active)setError(errorText(e,en))});return()=>{active=false}},[version,projectId])
  async function create(){
    const result=await command({op:'create',title,parent});await props.refreshProjects?.(result.id);setProjectIdeas(old=>({...old,[result.id]:idea}));setIdea('');setProjectId(result.id);setPanel('chat')
  }
  async function open(){const path=await props.pickDirectory();if(path){const id=await props.bindWorkspace(path);setProjectId(id);setPanel('chat')}}
  async function sendIdea(){if(!projectId||!projectIdea.trim())return;await props.sendResidentPrompt('coder',projectId,projectIdea);setProjectIdeas(old=>({...old,[projectId]:''}))}
  function toWorkbench(){setWorkbench(true);history.pushState(null,'','/workbench')}
  if(legacy)return <><button className="town-return-island" onClick={()=>setLegacy(false)}>{t('back')}</button><CreationApp {...props}/></>
  const sessionStatus=waiting?t('waiting'):running?t('running'):lastRun?.state==='interrupted'?t('interrupted'):lastRun?.state==='failed'?t('taskFailed'):lastRun?t('finished'):''
  const panelTitle:Record<NonNullable<Panel>,Word>={chat:'start',projects:'projects',files:'files',changes:'changes',preview:'preview',versions:'showcase',save:'save',inspiration:'inspiration',help:'brand'}
  const panelPortrait=panel==='projects'?'shiye':panel==='files'||panel==='changes'?'adu':'aqi'
  return <><style>{islandStyles}</style>{workbench&&<button className="town-return-island" onClick={()=>{setWorkbench(false);history.pushState(null,'','/')}}>{t('back')}</button>}
    <div className={`ci-island town-shell ${reduced?'ci-reduced':''}`} style={workbench?{display:'none'}:undefined}>
      {!light?<iframe className="ci-world" ref={frame} src="/world/?embed=1" title={t('world')}/>:<div className="ci-light">{(['chat','projects','files'] as const).map(p=><button key={p} onClick={()=>show(p)}><img src={`/agent-isles/brand/${portraits[p]}.svg`} alt=""/>{t(p==='chat'?'start':p)}</button>)}</div>}
      <div className="ci-top"><div><button onClick={()=>show('projects')}>{current?.title??t('project')}</button>{sessionStatus&&<button onClick={()=>show('chat')}>{sessionStatus}</button>}</div><div><button aria-label={t('settings')} onClick={()=>setModelSettings(true)}>⚙</button><button onClick={()=>props.localeState.setLocale(en?'zh':'en')}>{en?'中文':'EN'}</button><button onClick={()=>show('help')}>?</button></div></div>
      {!current&&!panel&&<div className="ci-welcome"><h1>{t('brand')}</h1><p>{t('welcome')}</p><button className="ci-primary" onClick={()=>show('chat')}>{t('start')}</button></div>}
      <nav className="ci-nav" aria-label={t('brand')}>{(['chat','projects','files','versions','inspiration'] as const).map(p=><button key={p} onClick={()=>show(p)}>{t(panelTitle[p])}</button>)}</nav>
      <ResidentNotifications t={props.t} hidden={workbench} onCount={()=>{}} sessions={workspaces.flatMap(p=>p.sessionIds.flatMap(id=>{const summary=sessions.byId[id],request=pending.get(id);return summary?[{id,projectId:p.workspaceId,projectName:p.title,resident:'coder',updatedAt:summary.updatedAt,running:summary.running,pending:request?`${request.kind}:${'callId'in request?request.callId:''}`:undefined} satisfies NotificationSession]:[]}))} activeSession={panel==='chat'?bindingId:undefined} read={props.readRecentSession} open={item=>{void act(async()=>{await props.selectProjectSession?.(item.projectId,item.id);setProjectId(item.projectId);setBindingId(item.id);props.focusSession(item.id);show('chat')})}}/>
      {notice&&<div className="ci-notice" role="status">{notice}<button onClick={()=>setNotice('')}>{t('close')}</button></div>}
      {!panel&&error&&<div className="ci-notice ci-error" role="alert">{error}</div>}
      {panel&&<aside ref={aside} tabIndex={-1} className={`ci-panel ${['preview','files','changes','versions'].includes(panel)?'wide':''} ${focus?'focus':''}`} aria-label={t(panelTitle[panel])}>
        <header><img src={`/agent-isles/brand/${panelPortrait}.svg`} alt=""/><div><strong>{t(panelTitle[panel])}</strong><small>{current?.title??t('brand')}</small></div><button onClick={()=>setFocus(!focus)}>{t(focus?'shrink':'expand')}</button><button onClick={close}>{t('back')}</button></header>
        {error&&<div className="ci-error" role="alert">{error}</div>}
        {panel==='chat'&&current?<>
          <div className="ci-status"><span>{sessionStatus||t('permission')}</span>{running&&binding&&<button onClick={()=>void act(async()=>{const r=await binding.session.cancel();if(!r.ok)throw new Error(r.error.message)})}>{t('stop')}</button>}</div>
          <div className="ci-chat-tools">{(['preview','changes','save','versions'] as const).map(p=><button key={p} onClick={()=>{setVersion(undefined);show(p)}}>{t(p==='versions'?'versions':p)}</button>)}</div>
          {projectIdea&&<div className="ci-item"><p>{projectIdea}</p><button disabled={busy||running} onClick={()=>void act(sendIdea)}>{t('send')}</button></div>}
          {bindingId?<NativeChat sessionId={bindingId} t={props.t}/>:<p>{t('loading')}</p>}
        </>:<div className="ci-body">
          {(panel==='chat'&&!current||panel==='projects')&&<>
            <h2>{t('new')}</h2><label>{t('title')}<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={80}/></label>
            <label>{t('idea')}<textarea value={idea} onChange={e=>setIdea(e.target.value)}/></label><p className="ci-muted">{parent??t('location')}</p>
            <div className="ci-actions"><button disabled={busy||!title.trim()} className="ci-primary" onClick={()=>void act(create)}>{t('create')}</button><button onClick={()=>void act(async()=>setParent(await props.pickDirectory()??undefined))}>{t('selectLocation')}</button><button disabled={busy} onClick={()=>void act(open)}>{t('open')}</button></div><p className="ci-muted">{t('openHint')}</p><details><summary>{t('enterPath')}</summary><label>{t('folderPath')}<input value={existingPath} onChange={e=>setExistingPath(e.target.value)}/></label><button disabled={busy||!existingPath.trim()} onClick={()=>void act(async()=>{const id=await props.bindWorkspace(existingPath.trim());setProjectId(id);setPanel('chat')})}>{t('openPath')}</button></details>
            <div className="ci-list">{workspaces.map(p=><button key={p.workspaceId} aria-current={projectId===p.workspaceId?'true':undefined} onClick={()=>{setProjectId(p.workspaceId);show('chat')}}>{p.title}<small className="ci-muted"> · {p.path}</small></button>)}</div>
            {current&&<><h3>{t('history')}</h3><input aria-label={t('history')} value={search} onChange={e=>setSearch(e.target.value)}/><div className="ci-list">{current.sessionIds.filter(id=>(sessions.byId[id]?.title??id).toLowerCase().includes(search.toLowerCase())).map(id=><button key={id} onClick={()=>void act(async()=>{await props.selectProjectSession?.(projectId!,id);setBindingId(id);props.focusSession(id);show('chat')})}>{sessions.byId[id]?.title??id}</button>)}</div><button onClick={()=>show('versions')}>{t('versions')}</button></>}
          </>}
          {panel==='help'&&<><p>{t('help')}</p><div className="ci-list"><button onClick={()=>setLight(!light)}>{t(light?'world':'light')}</button><label><input type="checkbox" checked={reduced} onChange={e=>setReduced(e.target.checked)}/>{t('reduced')}</label><button onClick={()=>setLegacy(true)}>{t('legacy')}</button><button onClick={toWorkbench}>{t('advanced')}</button></div></>}
          {panel==='inspiration'&&<><p>{t('sampleLabel')}</p><div className="ci-list">{(['sampleSite','sampleTool','sampleGame'] as const).map(key=><button key={key} onClick={()=>{if(projectId)setProjectIdeas(old=>({...old,[projectId]:t(key)}));else setIdea(t(key));show('chat')}}>{t(key)}</button>)}<button onClick={()=>setLegacy(true)}>{t('legacy')}</button></div></>}
          {panel==='files'&&current&&<><p className="ci-muted">{current.path}/{filePath}</p><div className="ci-actions"><button onClick={()=>setFilePath(filePath.split('/').slice(0,-1).join('/'))}>{t('parent')}</button><button onClick={()=>show('changes')}>{t('changes')}</button><button onClick={()=>show('versions')}>{t('export')}</button></div>{file?.kind==='directory'?<div className="ci-list">{file.entries.map((e:any)=><button key={e.name} disabled={e.link} onClick={()=>setFilePath([filePath,e.name].filter(Boolean).join('/'))}>{e.directory?'▸':'·'} {e.name}{e.link?' ↗':''}</button>)}</div>:file?.kind==='image'?<img className="ci-image" src={file.data} alt={filePath}/>:<pre className="ci-code">{file?.text}</pre>}</>}
          {panel==='changes'&&<><p>{changes?.run?.state==='interrupted'?t('interrupted'):t('changes')}</p>{!changes?.changes?.length&&<p>{t('empty')}</p>}<div className="ci-list">{changes?.changes?.map((c:any)=><button key={c.path} onClick={()=>void act(async()=>setChanges(await api('changes',projectId,{path:c.path})))}>{c.kind==='added'?'+':c.kind==='deleted'?'−':'±'} {c.path}</button>)}</div>{changes?.before!==undefined&&<div className="ci-diff"><div><h3>{t('before')}</h3><pre className="ci-code">{changes.before??t('binary')}</pre></div><div><h3>{t('after')}</h3><pre className="ci-code">{changes.after??t('binary')}</pre></div></div>}</>}
          {panel==='save'&&data&&<><p>{t('saveHint')}</p><label>{t('title')}<input value={title} onChange={e=>setTitle(e.target.value)}/></label><label>{t('note')}<textarea value={note} onChange={e=>setNote(e.target.value)}/></label><button className="ci-primary" disabled={busy||!!data.active||!title.trim()} onClick={()=>void act(async()=>{const a=await command<Achievement>({op:'save',projectId,title,note,revision:data.revision});setVersion(a.id);setPanel('versions');setNotice(t('saveDone'))})}>{t('save')}</button></>}
          {panel==='preview'&&data&&<><p><strong>{a?`${t('saved')}: ${a.title}`:t('current')}</strong></p>{a&&<p className="ci-muted">{t('versionHint')}</p>}{preview?.state==='ready'&&!busy?<><p role="status">{t('ready')}</p><div className="ci-preview-workspace"><iframe key={`${preview.id}-${previewEpoch}`} className="ci-preview" src={preview.url} sandbox="allow-scripts allow-forms allow-same-origin allow-modals" referrerPolicy="no-referrer" title={a?.title??data.title}/>{bindingId&&<section className="ci-preview-chat" aria-label={t('chat')}><h3>{t('chat')}</h3><NativeChat sessionId={bindingId} t={props.t}/></section>}</div></>:<p>{busy?t('starting'):preview?t(preview.state as 'starting'|'failed'|'stopped'):t('runHint')}</p>}
            <div className="ci-list">{(version?versionRecipes:data.recipes).map((r,i)=><div className="ci-item" key={i}><pre className="ci-code">{r.command}</pre><button disabled={busy||!!data.active} onClick={()=>void act(async()=>{await command({op:'preview',projectId,versionId:version,...r,confirmCommand:r.command})})}>{t('launch')}</button></div>)}</div>{!(version?versionRecipes:data.recipes).length&&<p>{t('noRecipe')}</p>}{preview&&<><button onClick={()=>setPreviewEpoch(n=>n+1)}>{t('refreshPreview')}</button><pre className="ci-code">{preview.log}</pre><button onClick={()=>void act(async()=>command({op:'stop-preview',projectId,previewId:preview.id}))}>{t('stopPreview')}</button></>}
            <div className="ci-actions"><button onClick={()=>show('chat')}>{t('chat')}</button><button onClick={()=>show('changes')}>{t('changes')}</button><button onClick={()=>show('save')}>{t('save')}</button></div></>}
          {panel==='versions'&&data&&<><div className="ci-gallery">{data.slots.map((id,i)=>{const saved=data.achievements.find(a=>a.id===id);return <button className="ci-item" key={i} onClick={()=>setVersion(id??undefined)}><div className="ci-version-icon">{saved?'⌘':'◇'}</div>{t('slot')} {i+1}<p>{saved?.title??t('empty')}</p></button>})}</div><h3>{t('versions')}</h3><div className="ci-list">{data.achievements.map(a=><button key={a.id} aria-pressed={version===a.id} onClick={()=>setVersion(a.id)}>{a.title} · {new Date(a.createdAt).toLocaleString()}</button>)}</div>
            {a&&<div className="ci-item"><h2>{a.title}</h2><p className="ci-muted">{a.id}</p><p>{a.note}</p><p>{t('restoreHint')}</p><div className="ci-actions"><button onClick={()=>show('preview')}>{t('preview')}</button><button disabled={busy||!!data.active} onClick={()=>void act(async()=>{const p=await command({op:'restore',projectId,versionId:a.id});await props.refreshProjects?.(p.id);setProjectId(p.id);setPanel('chat')})}>{t('restore')}</button></div><p>{t('exportHint')}</p><details><summary>{t('included')} ({Object.keys(a.manifest.files).length})</summary><pre className="ci-code">{Object.keys(a.manifest.files).join('\n')}</pre></details><details><summary>{t('excluded')} ({a.manifest.excluded.length})</summary><pre className="ci-code">{a.manifest.excluded.join('\n')}</pre></details><div className="ci-actions">{(['source','html'] as const).map(kind=><button disabled={busy} key={kind} onClick={()=>void act(async()=>{const r=await command({op:'export',projectId,versionId:a.id,kind});await download(r.exportId,r.name)})}>{t(kind==='source'?'sourceExport':'htmlExport')}</button>)}</div>{a.manifest.files['package.json']&&<><p className="ci-muted">{t('buildHint')}</p><button disabled={busy||!!data.active} onClick={()=>void act(async()=>command({op:'build',projectId,versionId:a.id,confirmCommand:'install dependencies + npm run build'}))}>{t('build')}</button></>}{data.builds?.filter(b=>b.versionId===a.id).map(b=><div key={b.buildId}><pre className="ci-code">{b.log}</pre><button disabled={busy} onClick={()=>void act(async()=>{const r=await command({op:'export',projectId,versionId:a.id,kind:'static',buildId:b.buildId});await download(r.exportId,r.name)})}>{t('staticExport')}</button></div>)}<h3>{t('display')}</h3><div className="ci-list">{data.slots.map((id,slot)=><button key={slot} disabled={busy} onClick={()=>void act(async()=>command({op:'showcase',projectId,versionId:id===a.id?null:a.id,slot,revision:data.revision}))}>{t('slot')} {slot+1} · {id===a.id?t('remove'):id?t('replace'):t('display')}</button>)}</div></div>}
          </>}
          {!current&&['files','changes','preview','save','versions'].includes(panel)&&<button onClick={()=>show('projects')}>{t('project')}</button>}
        </div>}
      </aside>}
      {modelSettings&&<ModelSettings actions={props.models} close={()=>setModelSettings(false)} t={props.t}/>}
    </div></>
}
