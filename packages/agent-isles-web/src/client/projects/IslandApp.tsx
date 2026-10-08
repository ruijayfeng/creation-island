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
import { translator, errorText, type Word } from './words.js'
import { api, command, download } from './api.js'
import { FeedbackPanel, type CaptureInput, type EditorMemory } from './FeedbackPanel.js'
import { capturePreview, confirmStaticPreview } from './capture.js'
import { mediaUrl } from './api.js'
import { NotesPanel } from './NotesPanel.js'
import { StartersPanel } from './StartersPanel.js'
import type { GrowthMetadata } from '../../projects/metadata.js'
import type { ProjectNotes } from '../../projects/notes.js'
import { islandStyles } from './styles.js'
import type { Achievement, Run } from '../../projects/service.js'
import type { Preview, Recipe } from '../../projects/preview.js'

type Props=PropsRuntime<'shell.overlay'> & PropsLocale<typeof NS> & AgentIslesWorldInjected
type Panel='chat'|'draft'|'delivery'|'projects'|'files'|'changes'|'preview'|'versions'|'save'|'inspiration'|'notes'|'feedback'|'help'|null
interface ProjectData extends GrowthMetadata { builds?:{buildId:string;versionId:string;directory:string;log:string}[]; id:string; title:string; path:string; revision:number; achievements:Achievement[]; slots:(string|null)[]; runs:Run[]; previews:Preview[]; recipes:Recipe[]; active:{projectId:string;sessionId:string}|null }
const storedIdeas=()=>{try{return JSON.parse(storage('ci-project-ideas','{}')) as Record<string,string>}catch{return {}}}
const storage=(key:string,fallback='')=> {try{return localStorage.getItem(key)??fallback}catch{return fallback}}
export function IslandApp(props:Props) {
  const locale=useSyncExternalStore(props.localeState.subscribe.bind(props.localeState),props.localeState.getSnapshot.bind(props.localeState)).active
  const en=!locale.startsWith('zh'),t=translator(en)
  useEffect(()=>{document.documentElement.style.setProperty('--agent-isles-hero-title',JSON.stringify(t('start')));document.documentElement.style.setProperty('--agent-isles-hero-subtitle',JSON.stringify(t('welcome')))},[en])
  const workspaces=props.useWorkspaces(s=>s.items),sessions=props.useSessions(s=>s),pending=props.useSessionPendingInteraction(s=>s)
  const [projectId,setProjectId]=useState<string>(),[data,setData]=useState<ProjectData>(),[panel,setPanel]=useState<Panel>(null),[bindingId,setBindingId]=useState<string>(),[modelSettings,setModelSettings]=useState(false)
  const [welcomeHidden,setWelcomeHidden]=useState(storage('ci-island-welcome-hidden')==='true')
  const [mapOpen,setMapOpen]=useState(false),[previewChat,setPreviewChat]=useState(false),[viewportWidth,setViewportWidth]=useState(window.innerWidth)
  const [focus,setFocus]=useState(false),[light,setLight]=useState(storage('ci-light')==='true'),[reduced,setReduced]=useState(storage('ci-reduced',String(matchMedia('(prefers-reduced-motion: reduce)').matches))==='true')
  const [previewEpoch,setPreviewEpoch]=useState(0),[ready,setReady]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[restored,setRestored]=useState(false)
  const [title,setTitle]=useState(''),[idea,setIdea]=useState(storage('ci-new-idea')),[existingPath,setExistingPath]=useState(''),[parent,setParent]=useState<string>(),[note,setNote]=useState(''),[version,setVersion]=useState<string>(),[versionRecipes,setVersionRecipes]=useState<Recipe[]>([])
  const [includeNotes,setIncludeNotes]=useState(false),[captureInput,setCaptureInput]=useState<CaptureInput>(),[coverImages,setCoverImages]=useState<Record<string,string>>({})
  const previewArea=useRef<HTMLDivElement>(null),previewFrame=useRef<HTMLIFrameElement>(null),editorMemory=useRef(new Map<string,EditorMemory>()),notesMemory=useRef(new Map<string,ProjectNotes>()),capturing=useRef(false),captureController=useRef<AbortController>()
  const [captureWorking,setCaptureWorking]=useState(false)
  const [filePath,setFilePath]=useState(''),[file,setFile]=useState<any>(),[changes,setChanges]=useState<any>(),[search,setSearch]=useState('')
  const mapControl=useRef<HTMLDivElement>(null),frame=useRef<HTMLIFrameElement>(null),aside=useRef<HTMLElement>(null),lastTrigger=useRef<HTMLElement|null>(null),selectedRef=useRef(projectId),panelRef=useRef(panel)
  selectedRef.current=projectId;panelRef.current=panel
  const [projectIdeas,setProjectIdeas]=useState<Record<string,string>>(storedIdeas)
  const projectIdea=projectId?projectIdeas[projectId]??'':''
  useEffect(()=>{try{localStorage.setItem('ci-project-ideas',JSON.stringify(projectIdeas))}catch{}},[projectIdeas])
  const actionLock=useRef(false),saveDrafts=useRef(new Map<string,{title:string;note:string}>())
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
    captureController.current?.abort();setData(undefined);setVersion(undefined);setFilePath('');setFile(undefined);setChanges(undefined);setBindingId(undefined);setCaptureInput(undefined);setCoverImages({})
    if(!projectId)return
    void props.saveProject(projectId).catch(e=>setError(errorText(e,en)))
    let active=true
    const poll=()=>void refresh(projectId).catch(e=>{if(active)setError(errorText(e,en))})
    poll();const timer=setInterval(poll,2500);return()=>{active=false;clearInterval(timer)}
  },[projectId])
  useEffect(()=>{
    if(!['chat','preview','feedback'].includes(panel??'')||!projectId||!restored)return
    let active=true
    void props.selectResident('coder',projectId).then(id=>{if(active){setBindingId(id);props.focusSession(id)}}).catch(e=>{if(active)setError(errorText(e,en))})
    return()=>{active=false}
  },[projectId,panel,restored])
  useEffect(()=>{if(!bindingId)return;props.blockComposer?.(bindingId,data?.active||runningSession()?t('busy'):undefined);return()=>props.blockComposer?.(bindingId,undefined)},[bindingId,data?.active?.sessionId,sessions])
  function runningSession(){return Object.values(sessions.byId).some(s=>s.running)}
  function close(){captureController.current?.abort();setPanel(null);setModelSettings(false);setFocus(false);setMapOpen(false);setError('');if(lastTrigger.current?.isConnected)lastTrigger.current.focus();else frame.current?.focus()}
  function show(next:Panel){if(next!=='feedback')captureController.current?.abort();lastTrigger.current=document.activeElement as HTMLElement;setPanel(next);setWelcomeHidden(true);setMapOpen(false);setError('');setFocus(false);if(next==='save'){const draft=projectId?saveDrafts.current.get(projectId):undefined;setTitle(draft?.title??current?.title??'');setNote(draft?.note??'')}}
  const act=async(fn:()=>Promise<unknown>)=>{if(actionLock.current)return;actionLock.current=true;setBusy(true);setError('');try{await fn();await refresh()}catch(e){setError(errorText(e,en))}finally{actionLock.current=false;setBusy(false)}}
  useEffect(()=>{if(panel)aside.current?.focus()},[panel])
  useEffect(()=>{try{localStorage.setItem('ci-island-welcome-hidden',String(welcomeHidden))}catch{}},[welcomeHidden])
  useEffect(()=>{
    if(!mapOpen)return
    const outside=(event:PointerEvent)=>{if(!mapControl.current?.contains(event.target as Node))setMapOpen(false)}
    document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside)
  },[mapOpen])
  useEffect(()=>{
    const root=document.querySelector<HTMLElement>('[data-agent-isles-town]')
    root?.toggleAttribute('data-creation-focus',focus)
    return()=>root?.removeAttribute('data-creation-focus')
  },[focus,workbench,legacy])
  useEffect(()=>{if(panel==='save'&&projectId)saveDrafts.current.set(projectId,{title,note})},[panel,projectId,title,note])
  useEffect(()=>{
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!event.defaultPrevented&&!document.querySelector('[role="dialog"],dialog[open],[role="menu"]')){event.preventDefault();if(modelSettings)setModelSettings(false);else if(mapOpen){setMapOpen(false);mapControl.current?.querySelector<HTMLButtonElement>(':scope > button')?.focus();}else close()}}
    window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape)
  },[modelSettings,mapOpen])
  useEffect(()=>{const resize=()=>setViewportWidth(window.innerWidth);window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize)},[])
  useEffect(()=>{
    const listener=(event:MessageEvent)=>{
      if(event.source!==frame.current?.contentWindow||event.origin!==location.origin||!isWorldToHostMessage(event.data))return
      if(event.data.type==='world:ready'||event.data.type==='world:playable')setReady(true)
      if(event.data.type==='resident:selected'){const map:Record<ResidentId,Panel>={coder:'chat',teacher:'projects',file_keeper:'delivery',coordinator:'inspiration'};show(map[event.data.payload.residentId])}
      if(event.data.type==='showcase:selected'){setVersion(data?.slots[event.data.payload.slot]??undefined);show('versions')}
    };window.addEventListener('message',listener);return()=>window.removeEventListener('message',listener)
  },[data])
  const activeSession=projectId?props.sessionForResident(projectId,'coder'):undefined
  const running=!!(activeSession&&sessions.byId[activeSession as SessionId]?.running)
  const waiting=!!(activeSession&&pending.has(activeSession as SessionId))
  const residents=[{id:'coder',displayName:t('start'),status:waiting?'approval':running?'working':lastRun?.state==='interrupted'?'failed':'idle'},{id:'teacher',displayName:t('projects'),status:'idle'},{id:'file_keeper',displayName:t('files'),status:'idle'},{id:'coordinator',displayName:t('inspiration'),status:'idle'}]
  const encounter=['projects','draft','help'].includes(panel??'')||(panel==='chat'&&!current)
  const attentionTarget=panel==='inspiration'?'coordinator':['projects','notes'].includes(panel??'')?'teacher':['delivery','files','changes'].includes(panel??'')?'file_keeper':panel==='versions'?'showcase':'coder'
  const worldState=JSON.stringify({locale:en?'en':'zh',workspace:current?{workspaceId:current.workspaceId,title:current.title}:null,sessionId:activeSession??null,panelOpen:!!panel||modelSettings,residents,reducedMotion:reduced,attention:panel&&panel!=='help'?{target:attentionTarget,layout:focus?'focus':encounter?'encounter':'side',sideRatio:Math.min(.85,(panel==='preview'?Math.min(960,viewportWidth*.68):panel==='feedback'?Math.min(800,viewportWidth*.58):Math.min(480,viewportWidth*.4))/viewportWidth)}:null})
  useEffect(()=>{if(ready)frame.current?.contentWindow?.postMessage({source:'agent-isles-host',version:WORLD_BRIDGE_VERSION,type:'world:init',payload:JSON.parse(worldState)},location.origin)},[ready,worldState])
  useEffect(()=>{if(ready)frame.current?.contentWindow?.postMessage({source:'agent-isles-host',version:WORLD_BRIDGE_VERSION,type:'project:showcase',payload:(data?.slots??Array(6).fill(null)).map(id=>{const a=data?.achievements.find(a=>a.id===id);return a?{versionId:a.id,title:a.title,coverPng:coverImages[a.id]?.split(',')[1]}:null})},location.origin)},[ready,data?.revision,projectId,JSON.stringify(coverImages)])
  useEffect(()=>{let active=true;setFile(undefined);if(panel==='files'&&projectId)void api('files',projectId,{path:filePath}).then(v=>{if(active)setFile(v)}).catch(e=>{if(active)setError(errorText(e,en))});return()=>{active=false}},[panel,projectId,filePath])
  useEffect(()=>{let active=true;setChanges(undefined);if(['changes','delivery'].includes(panel??'')&&projectId)void api('changes',projectId).then(v=>{if(active)setChanges(v)}).catch(e=>{if(active)setError(errorText(e,en))});return()=>{active=false}},[panel,projectId,lastRun?.state])
  useEffect(()=>{let active=true;setVersionRecipes([]);if(version&&projectId)void api<Recipe[]>('version-recipes',projectId,{version}).then(v=>{if(active)setVersionRecipes(v)}).catch(e=>{if(active)setError(errorText(e,en))});return()=>{active=false}},[version,projectId])
  useEffect(()=>{
    let active=true
    if(!data)return
    const id=data.id
    void Promise.all(Object.entries(data.covers).map(async([versionId,cover])=>{const c=data.captures[cover.captureId];if(!c?.thumbnailHash)return;const image=await mediaUrl(id,c.thumbnailHash);if(active&&selectedRef.current===id)setCoverImages(old=>({...old,[versionId]:image}))})).catch(()=>{})
    return()=>{active=false}
  },[data?.id,JSON.stringify(data?.covers)])
  async function capture(cover=false,signal?:AbortSignal){
    if(!previewArea.current||!preview||preview.state!=='ready')return
    if(bindingId&&data?.feedback[bindingId]?.requestId)throw new Error('unknownSubmission')
    const before=preview.id,id=projectId
    if(cover){if(!previewFrame.current)throw new Error('source-changed');await confirmStaticPreview(previewFrame.current,preview)}
    const dataUrl=await capturePreview(previewArea.current,signal)
    if(cover){if(!previewFrame.current)throw new Error('source-changed');await confirmStaticPreview(previewFrame.current,preview)}
    const latest=await api<ProjectData>('state',id)
    signal?.throwIfAborted()
    if(selectedRef.current!==id||latest.previews.find(p=>p.id===before)?.state!=='ready')throw new Error('source-changed')
    if(bindingId)editorMemory.current.delete(`${id}:${bindingId}`)
    setCaptureInput({dataUrl,source:'preview',previewId:before,versionId:version,cover,capturedAt:Date.now()});show('feedback')
  }
  async function captureAction(cover=false){if(capturing.current)return;capturing.current=true;const controller=new AbortController();captureController.current=controller;setCaptureWorking(true);setError('');try{await capture(cover,controller.signal)}catch(e){setError(errorText(controller.signal.aborted?'captureCancelled':e,en))}finally{capturing.current=false;setCaptureWorking(false)}}
  async function create(){
    const from=selectedRef.current,fromPanel=panelRef.current
    const result=await command({op:'create',title:title.trim()||idea.trim().split('\n')[0]!.slice(0,40),parent});await props.refreshProjects?.(result.id);setProjectIdeas(old=>({...old,[result.id]:idea}));setIdea('');if(selectedRef.current===from&&panelRef.current===fromPanel){setProjectId(result.id);setPanel('chat')}else setNotice(t('projectCreated'))
  }
  async function open(){const path=await props.pickDirectory();if(path){const id=await props.bindWorkspace(path);setProjectId(id);setPanel('chat')}}
  async function sendIdea(){if(!projectId||!projectIdea.trim())return;await props.sendResidentPrompt('coder',projectId,projectIdea);setProjectIdeas(old=>({...old,[projectId]:''}))}
  function toWorkbench(){setWorkbench(true);history.pushState(null,'','/workbench')}
  if(legacy)return <><button className="town-return-island" onClick={()=>setLegacy(false)}>{t('back')}</button><CreationApp {...props}/></>
  const shownNotes=running&&lastRun?.notes?lastRun.notes:data?.notes
  const sessionStatus=waiting?t('waiting'):running?t('running'):lastRun?.state==='interrupted'?t('interrupted'):lastRun?.state==='failed'?t('taskFailed'):lastRun?t('finished'):''
  const panelTitle:Record<NonNullable<Panel>,Word>={draft:'new',delivery:'handoff',chat:'start',projects:'projects',files:'files',changes:'changes',preview:'preview',versions:'showcase',save:'save',inspiration:'inspiration',notes:'notes',feedback:'annotate',help:'brand'}
  const panelPortrait=['projects','notes'].includes(panel??'')?'shiye':['delivery','files','changes'].includes(panel??'')?'adu':'aqi'
  const roleName=panelPortrait==='shiye'?'shiyeName':panelPortrait==='adu'?'aduName':'aqiName'
  const place=panel==='inspiration'?'inspiration':panel==='versions'?'showcase':panelPortrait==='shiye'?'pagesPlace':panelPortrait==='adu'?'dockPlace':'makingPlace'
  const projectBooks=[...workspaces].sort((a,b)=>Number(b.workspaceId===projectId)-Number(a.workspaceId===projectId))
  const delivered=a??data?.achievements.at(-1)
  const recipes=version?versionRecipes:data?.recipes??[]
  const shortStatus=waiting?'shortWaiting':running?'shortWorking':lastRun?.state==='failed'||lastRun?.state==='interrupted'?'shortFailed':'shortFinished'
  const backPanel:Panel=['files','changes'].includes(panel??'')?'delivery':panel==='notes'?'projects':['preview','save','feedback'].includes(panel??'')?'chat':null
  function chooseProject(id:string){setProjectId(id);show('chat')}
  function showCurrentPreview(){setVersion(undefined);setPreviewChat(false);show('preview')}
  const savedList=<div className="ci-list">{data?.achievements.slice().reverse().map(saved=><button className="ci-book-row" key={saved.id} aria-pressed={version===saved.id} onClick={()=>setVersion(saved.id)}><span>{saved.title}</span><small>{new Date(saved.createdAt).toLocaleString()}</small></button>)}</div>
  const launchers=<div className="ci-list">{recipes.map((r,i)=><div className="ci-item" key={i}>
    {r.kind==='static'?<><strong>{t('staticLaunch')}</strong><details><summary>{t('runDetails')}</summary><pre className="ci-code">{r.command}</pre></details></>:<><strong>{t('nodeLaunch')}</strong><p className="ci-muted">{t('runHint')}</p><pre className="ci-code">{r.command}</pre></>}
    <button className="ci-primary" disabled={busy||!!data?.active} onClick={()=>void act(async()=>{await command({op:'preview',projectId,versionId:version,...r,confirmCommand:r.command})})}>{t(r.kind==='static'?'staticLaunch':'launch')}</button>
  </div>)}</div>
  const previewFooter=data?<div className="ci-preview-footer">{a?<button className="ci-primary" disabled={busy||!!data.active} onClick={()=>void act(async()=>{const p=await command({op:'restore',projectId,versionId:a.id});await props.refreshProjects?.(p.id);if(selectedRef.current===data.id&&panelRef.current==='preview'){setProjectId(p.id);show('chat')}})}>{t('restore')}</button>:<><button className="ci-primary" onClick={()=>setPreviewChat(!previewChat)}>{t(previewChat?'close':'changeSomething')}</button><button onClick={()=>show('save')} disabled={busy||!!data.active}>{t('keepWork')}</button></>}<button onClick={()=>setPreviewEpoch(n=>n+1)}>{t('refreshPreview')}</button></div>:null
  return <><style>{islandStyles}</style>{workbench&&<button className="town-return-island" onClick={()=>{setWorkbench(false);history.pushState(null,'','/')}}>{t('back')}</button>}
    <div className={'ci-island town-shell '+(reduced?'ci-reduced ':'')+(captureWorking?'ci-capturing':'')} data-surface={panel??'island'} style={workbench?{display:'none'}:undefined}>
      {!light?<iframe className="ci-world" ref={frame} src="/world/?embed=1" title={t('world')}/>:<div className="ci-light"><h1>{t('brand')}</h1><p>{t('mapHint')}</p>{(['chat','projects','delivery','versions','inspiration'] as const).map(p=><button key={p} onClick={()=>show(p)}>{p!=='versions'&&p!=='inspiration'&&<img src={'/agent-isles/brand/'+(p==='projects'?'shiye':p==='delivery'?'adu':'aqi')+'.svg'} alt=""/>}{t(panelTitle[p])}</button>)}</div>}
      <div className="ci-top"><div><button className="ci-project-chip" onClick={()=>show('projects')}><span>⌂</span>{current?.title??t('brand')}</button>{current&&sessionStatus&&<button className={'ci-task-chip '+(waiting?'needs-input':'')} onClick={()=>show('chat')}><i/>{t(shortStatus)}</button>}</div><button aria-label={t('islandOptions')} onClick={()=>show('help')}>⚙</button></div>
      {!panel&&!light&&!welcomeHidden&&<div className="ci-island-greeting"><button className="ci-greeting-close" aria-label={t('close')} onClick={()=>setWelcomeHidden(true)}>×</button>
        <img src="/agent-isles/brand/aqi.svg" alt=""/><div><strong>{current?t('returnHint'):t('helloAqi')}</strong><p>{current?(sessionStatus||t('aqiHint')):t('islandHint')}</p><button className="ci-primary" onClick={()=>show('chat')}>{t(current?'continueAqi':'talkAqi')}</button></div>
      </div>}
      <div className="ci-map-control" ref={mapControl}>
        {mapOpen&&<nav className="ci-map" aria-label={t('islandMap')}><strong>{t('islandMap')}</strong><p className="ci-muted">{t('mapHint')}</p>{(['chat','projects','delivery','versions','inspiration'] as const).map(p=><button key={p} onClick={()=>show(p)}><span>{t(p==='chat'?'aqiName':p==='projects'?'shiyeName':p==='delivery'?'aduName':panelTitle[p])}</span><small>{t(p==='chat'?'makingPlace':p==='projects'?'pagesPlace':p==='delivery'?'dockPlace':panelTitle[p])}</small></button>)}</nav>}
        <button aria-expanded={mapOpen} aria-label={t('islandMap')} onClick={()=>setMapOpen(!mapOpen)}>⌖ <span>{t('islandMap')}</span></button>
      </div>
      <ResidentNotifications t={props.t} hidden={workbench} onCount={()=>{}} sessions={workspaces.flatMap(p=>p.sessionIds.flatMap(id=>{const summary=sessions.byId[id],request=pending.get(id);return summary?[{id,projectId:p.workspaceId,projectName:p.title,resident:'coder',updatedAt:summary.updatedAt,running:summary.running,pending:request?request.kind+('callId'in request?':'+request.callId:''):undefined} satisfies NotificationSession]:[]}))} activeSession={panel==='chat'||panel==='preview'&&previewChat?bindingId:undefined} read={props.readRecentSession} open={item=>{void act(async()=>{await props.selectProjectSession?.(item.projectId,item.id);setProjectId(item.projectId);setBindingId(item.id);props.focusSession(item.id);show('chat')})}}/>
      {notice&&<div className="ci-notice" role="status">{notice}<button onClick={()=>setNotice('')}>{t('close')}</button></div>}
      {!panel&&error&&<div className="ci-notice ci-error" role="alert">{error}</div>}
      {panel&&<aside ref={aside} tabIndex={-1} className={'ci-panel '+(encounter?'encounter ':'')+(panel==='preview'?'result ':'')+(panel==='feedback'?'image-editor ':'')+(focus?'focus':'')} aria-label={t(panelTitle[panel])}>
        <header>
          {!['inspiration','versions','help'].includes(panel)&&<img src={'/agent-isles/brand/'+panelPortrait+'.svg'} alt=""/>}
          <div><small className="ci-place">{t(place)}</small><strong>{t(panel==='help'?'islandOptions':panel==='inspiration'?'inspiration':panel==='versions'?'showcase':roleName)}</strong><small>{panel==='draft'?t('new'):current?.title??t('brand')}</small></div>
          <button className="ci-icon-button" aria-label={t(focus?'shrink':'expand')} title={t(focus?'shrink':'expand')} onClick={()=>setFocus(!focus)}>{focus?'↙':'↗'}</button>
          <button className="ci-icon-button" aria-label={t('back')} title={t('back')} onClick={close}>×</button>
        </header>
        {error&&<div className="ci-error" role="alert">{error}</div>}
        {backPanel&&<button className="ci-back-step" onClick={()=>show(backPanel)}>‹ {t(backPanel==='delivery'?'aduName':backPanel==='projects'?'shiyeName':'continueAqi')}</button>}
        {panel==='chat'&&current?<>
          <div className="ci-status"><span>{sessionStatus||t('aqiHint')}</span>{running&&binding&&<button onClick={()=>void act(async()=>{const r=await binding.session.cancel();if(!r.ok)throw new Error(r.error.message)})}>{t('stop')}</button>}</div>
          <div className="ci-chat-tools"><button onClick={showCurrentPreview}>{t('tryWork')}</button><details><summary>{t('chatMore')}</summary><div className="ci-tool-menu">{(['changes','save','versions','notes','feedback'] as const).map(p=><button key={p} onClick={()=>show(p)}>{t(p==='save'?'keepWork':p==='feedback'?'annotate':p)}</button>)}<button onClick={()=>show('delivery')}>{t('handoff')}</button></div></details></div>
          {shownNotes?.useAsContext&&<details className="ci-context"><summary>{t(running?'contextVersion':'nextContextVersion')} {shownNotes.revision}</summary><p>{shownNotes.brief}</p><ul>{shownNotes.decisions.map((d,i)=><li key={i}>{d}</li>)}</ul></details>}
          {projectIdea&&<div className="ci-idea"><small>{t('ideaRetained')}</small><p>{projectIdea}</p><button disabled={busy||running} onClick={()=>void act(sendIdea)}>{t('send')}</button></div>}
          {bindingId?<NativeChat sessionId={bindingId} t={props.t}/>:<p>{t('loading')}</p>}
        </>:<div className="ci-body">
          {current&&!data&&['delivery','notes','save','versions','preview','feedback'].includes(panel)&&<p role="status">{t('loading')}</p>}
          {(panel==='draft'||panel==='chat'&&!current)&&<>
            <p className="ci-dialogue-line">{t('firstIdea')}</p>
            <label>{t('idea')}<textarea value={idea} placeholder={t('ideaExample')} onChange={e=>setIdea(e.target.value)}/></label>
            <label>{t('optionalName')}<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={80}/></label>
            <button disabled={busy||!title.trim()&&!idea.trim()} className="ci-primary" onClick={()=>void act(create)}>{t('createPlace')}</button>
            <details className="ci-secondary"><summary>{t('projectSetup')}</summary><p className="ci-muted">{parent??t('location')}</p><button onClick={()=>void act(async()=>setParent(await props.pickDirectory()??undefined))}>{t('selectLocation')}</button><p>{t('openHint')}</p><button disabled={busy} onClick={()=>void act(open)}>{t('open')}</button></details>
            <button className="ci-text-button" onClick={()=>show('inspiration')}>{t('inspiration')}</button>
          </>}
          {panel==='projects'&&<>
            <p className="ci-dialogue-line">{t('shiyeHello')}</p>
            {workspaces.length?<div className="ci-list ci-project-books">{projectBooks.map(p=><button className="ci-book-row" title={p.path} key={p.workspaceId} aria-current={projectId===p.workspaceId?'true':undefined} onClick={()=>chooseProject(p.workspaceId)}><span>▤ {p.title}</span><small>{projectId===p.workspaceId?t('resume'):t('openPath')}</small></button>)}</div>:<p>{t('noProjects')}</p>}
            <div className="ci-actions"><button onClick={()=>{setTitle('');show('draft')}}>{t('newWithAqi')}</button><button disabled={busy} onClick={()=>void act(open)}>{t('open')}</button></div>
            {current&&<details><summary>{t('projectMore')} · {current.title}</summary><div className="ci-actions"><button onClick={()=>show('notes')}>{t('notes')}</button><button onClick={()=>show('versions')}>{t('versions')}</button></div><details><summary>{t('otherHistory')}</summary><label>{t('history')}<input value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="ci-list">{current.sessionIds.filter(id=>(sessions.byId[id]?.title??id).toLowerCase().includes(search.toLowerCase())).map(id=><button key={id} onClick={()=>void act(async()=>{await props.selectProjectSession?.(projectId!,id);setBindingId(id);props.focusSession(id);show('chat')})}>{sessions.byId[id]?.title??id}</button>)}</div></details><p className="ci-muted">{current.path}</p></details>}
            <details className="ci-secondary"><summary>{t('enterPath')}</summary><p>{t('openHint')}</p><label>{t('folderPath')}<input value={existingPath} onChange={e=>setExistingPath(e.target.value)}/></label><button disabled={busy||!existingPath.trim()} onClick={()=>void act(async()=>{const id=await props.bindWorkspace(existingPath.trim());setProjectId(id);setPanel('chat')})}>{t('openPath')}</button></details>
          </>}
          {panel==='help'&&<><h2>{t('showGuide')}</h2><p>{t('help')}</p><div className="ci-actions"><button onClick={()=>setModelSettings(true)}>{t('settings')}</button><button onClick={()=>props.localeState.setLocale(en?'zh':'en')}>{t('language')} · {en?'中文':'English'}</button></div><details><summary>{t('islandOptions')}</summary><div className="ci-list"><button onClick={()=>setLight(!light)}>{t(light?'world':'light')}</button><label className="ci-check"><input type="checkbox" checked={reduced} onChange={e=>setReduced(e.target.checked)}/>{t('reduced')}</label></div></details><details className="ci-secondary"><summary>{t('advanced')}</summary><button onClick={toWorkbench}>{t('advanced')}</button><button onClick={()=>setLegacy(true)}>{t('legacy')}</button></details></>}
          {panel==='inspiration'&&<StartersPanel en={en} legacy={()=>setLegacy(true)} copy={async(id,idea)=>{const from=selectedRef.current;await props.refreshProjects?.(id);setProjectIdeas(old=>({...old,[id]:idea}));if(selectedRef.current===from&&panelRef.current==='inspiration'){setProjectId(id);setPanel('chat');setNotice(t('starterCopied'))}}}/>}
          {panel==='notes'&&data&&<><p className="ci-dialogue-line">{t('notesHello')}</p><NotesPanel key={data.id} projectId={data.id} memory={notesMemory.current.get(data.id)} remember={value=>{notesMemory.current.set(data.id,value)}} notes={data.notes} en={en} busy={!!data.active} refresh={()=>refresh(data.id)} organize={async()=>{await props.sendResidentPrompt('coder',data.id,t('organizePrompt'));show('chat')}}/></>}
          {panel==='delivery'&&data&&<>
            <p className="ci-dialogue-line">{t('aduHello')}</p>
            <div className="ci-item"><strong>{t('changes')}</strong><p>{lastRun?sessionStatus:t('noRun')}</p>{lastRun&&!data.active&&changes?.changes&&<p className="ci-muted">{changes.changes.length?changes.changes.length+' '+t('changedFiles'):t('noChanges')}</p>}<button onClick={()=>show('changes')}>{t('changes')}</button><button className="ci-text-button" onClick={()=>show('files')}>{t('browseFiles')}</button></div>
            <h3>{t('handoff')}</h3>
            {delivered?<><div className="ci-item"><strong>{delivered.title}</strong><p className="ci-muted">{t('savedIdentity')} {new Date(delivered.createdAt).toLocaleString()} · {delivered.id.slice(0,8)}</p><p>{t('sourceHint')}</p>{delivered.notes&&<label className="ci-check"><input type="checkbox" checked={includeNotes} onChange={e=>setIncludeNotes(e.target.checked)}/>{t('includeNotes')}</label>}<details><summary>{t('versionDetails')}</summary><p>{t('exportHint')}</p><pre className="ci-code">{Object.keys(delivered.manifest.files).join('\n')}</pre><p>{t('excluded')}</p><pre className="ci-code">{delivered.manifest.excluded.join('\n')}</pre></details><button className="ci-primary" disabled={busy} onClick={()=>void act(async()=>{const r=await command({op:'export',projectId,versionId:delivered.id,kind:'source',includeNotes});await download(r.exportId,r.name)})}>{t('sourceExport')}</button>
              <details className="ci-secondary"><summary>{t('moreDelivery')}</summary><p>{t('htmlHint')}</p><button disabled={busy||includeNotes} onClick={()=>void act(async()=>{const r=await command({op:'export',projectId,versionId:delivered.id,kind:'html'});await download(r.exportId,r.name)})}>{t('htmlExport')}</button>
                {delivered.manifest.files['package.json']&&<><p>{t('buildHint')}</p><button disabled={busy||!!data.active} onClick={()=>void act(async()=>command({op:'build',projectId,versionId:delivered.id,confirmCommand:'install dependencies + npm run build'}))}>{t('build')}</button></>}
                {data.builds?.filter(b=>b.versionId===delivered.id).map(b=><div key={b.buildId}><details><summary>{t('runDetails')}</summary><pre className="ci-code">{b.log}</pre></details><button disabled={busy} onClick={()=>void act(async()=>{const r=await command({op:'export',projectId,versionId:delivered.id,kind:'static',buildId:b.buildId,includeNotes});await download(r.exportId,r.name)})}>{t('staticExport')}</button></div>)}
              </details></div><details><summary>{t('savedShelf')}</summary>{savedList}</details></>:<><p>{t('noSaved')}</p><button onClick={showCurrentPreview}>{t('tryWork')}</button><button onClick={()=>show('save')}>{t('keepWork')}</button></>}
          </>}
          {panel==='files'&&current&&<><h2>{t('browseFiles')}</h2><p className="ci-muted">{current.path}/{filePath}</p><button disabled={!filePath} onClick={()=>setFilePath(filePath.split('/').slice(0,-1).join('/'))}>{t('parent')}</button>{file?.kind==='directory'?<div className="ci-list">{file.entries.map((e:any)=><button key={e.name} disabled={e.link} onClick={()=>setFilePath([filePath,e.name].filter(Boolean).join('/'))}>{e.directory?'▸':'·'} {e.name}{e.link?' ↗':''}</button>)}</div>:file?.kind==='image'?<img className="ci-image" src={file.data} alt={filePath}/>:<pre className="ci-code">{file?.text}</pre>}</>}
          {panel==='changes'&&<><h2>{t('changes')}</h2><p>{changes?.run?.state==='interrupted'?t('interrupted'):sessionStatus||t('noRun')}</p>{!changes?.changes?.length&&<p>{t('empty')}</p>}<div className="ci-list">{changes?.changes?.map((c:any)=><button key={c.path} onClick={()=>void act(async()=>setChanges(await api('changes',projectId,{path:c.path})))}>{c.kind==='added'?'+':c.kind==='deleted'?'−':'±'} {c.path}</button>)}</div>{changes?.before!==undefined&&<div className="ci-diff"><div><h3>{t('before')}</h3><pre className="ci-code">{changes.before??t('binary')}</pre></div><div><h3>{t('after')}</h3><pre className="ci-code">{changes.after??t('binary')}</pre></div></div>}</>}
          {panel==='save'&&data&&<><p className="ci-dialogue-line">{t('saveQuestion')}</p><p>{t('saveHint')}</p><label>{t('title')}<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={80}/></label><label>{t('note')}<textarea value={note} onChange={e=>setNote(e.target.value)}/></label><button className="ci-primary" disabled={busy||!!data.active||!title.trim()} onClick={()=>void act(async()=>{const a=await command<Achievement>({op:'save',projectId,title,note,revision:data.revision});if(selectedRef.current===data.id&&panelRef.current==='save'){setVersion(a.id);setPanel('versions')}setNotice(t('saveDone'))})}>{t('keepWork')}</button></>}
          {panel==='preview'&&data&&<>
            <div className="ci-preview-caption"><strong>{a?a.title:t('current')}</strong><span>{a?new Date(a.createdAt).toLocaleString():data.title}</span></div>
            {a&&<p className="ci-muted">{t('versionHint')}</p>}
            {preview?.state==='ready'?<><p className="ci-muted" role="status">{t('ready')}</p><div className={'ci-preview-workspace '+(previewChat?'with-chat':'')}><div ref={previewArea} className="ci-preview-capture-area"><iframe ref={previewFrame} key={preview.id+'-'+previewEpoch} className="ci-preview" src={preview.url} sandbox="allow-scripts allow-forms allow-same-origin allow-modals" referrerPolicy="no-referrer" title={a?.title??data.title}/></div>{previewChat&&bindingId&&<section className="ci-preview-chat" aria-label={t('chat')}><h3>{t('chat')}</h3><NativeChat sessionId={bindingId} t={props.t}/></section>}</div>

              <details><summary>{t('annotate')}</summary><p>{t('screenshotHelp')}</p><div className="ci-actions">{captureWorking&&<button onClick={()=>captureController.current?.abort()}>{t('cancelCapture')}</button>}<button disabled={busy||captureWorking} onClick={()=>void captureAction()}>{t('capture')}</button><button onClick={()=>{setCaptureInput(undefined);show('feedback')}}>{t('uploadScreenshot')}</button>{a&&<button disabled={busy||captureWorking||preview.kind!=='static'} onClick={()=>void captureAction(true)}>{t('takeCover')}</button>}</div></details>
              <details className="ci-secondary"><summary>{t('runDetails')}</summary>{launchers}<pre className="ci-code">{preview.log}</pre><button onClick={()=>void act(async()=>command({op:'stop-preview',projectId,previewId:preview.id}))}>{t('stopPreview')}</button></details>
            </>:<><p className="ci-dialogue-line">{t('previewWelcome')}</p>{preview&&<p role="status">{t(preview.state as 'starting'|'failed'|'stopped')}</p>}{busy&&<p role="status">{t('starting')}</p>}{launchers}{!recipes.length&&<p>{t('noRecipe')}</p>}{preview?.state==='failed'&&<pre className="ci-code">{preview.log}</pre>}<button onClick={()=>show('chat')}>{t('continueAqi')}</button></>}
          </>}
          {panel==='feedback'&&data&&bindingId&&props.sendProjectFeedback&&<FeedbackPanel key={`${projectId}-${bindingId}-${captureInput?.previewId??'draft'}-${captureInput?.cover??false}`} projectId={data.id} sessionId={bindingId} en={en} input={captureInput} memory={editorMemory.current.get(`${data.id}:${bindingId}`)} remember={value=>editorMemory.current.set(`${data.id}:${bindingId}`,value)} saved={data.feedback[bindingId]} captures={data.captures} coverRevision={data.covers[captureInput?.versionId??editorMemory.current.get(`${data.id}:${bindingId}`)?.origin?.versionId??'']?.revision??0} busy={!!data.active} send={props.sendProjectFeedback} refresh={()=>refresh(data.id)} done={()=>{const cover=captureInput?.cover??editorMemory.current.get(`${data.id}:${bindingId}`)?.origin?.cover;editorMemory.current.delete(`${data.id}:${bindingId}`);if(selectedRef.current===data.id&&panelRef.current==='feedback'){setCaptureInput(undefined);show(cover?'versions':'chat')}}} restore={async versionId=>{const p=await command({op:'restore',projectId,versionId});await props.refreshProjects?.(p.id);if(selectedRef.current===data.id&&panelRef.current==='feedback'){setProjectId(p.id);show('chat')}}}/>}
          {panel==='versions'&&data&&<>
            {a?<article className="ci-saved-work">{coverImages[a.id]?<img className="ci-cover" src={coverImages[a.id]} alt={a.title}/>:<div className="ci-version-icon">{t('fileIcon')}</div>}<h2>{a.title}</h2><p className="ci-muted">{t('savedIdentity')} {new Date(a.createdAt).toLocaleString()} · {a.id.slice(0,8)}</p><p>{a.note}</p>
              <div className="ci-actions"><button className="ci-primary" onClick={()=>{setPreviewChat(false);show('preview')}}>{t('tryWork')}</button><button onClick={()=>show('delivery')}>{t('handoff')}</button></div>
              <details><summary>{t('arrangeCoast')}</summary><div className="ci-list">{data.slots.map((id,slot)=><div key={slot} className="ci-slot-row"><span>{t('slot')} {slot+1}</span><button disabled={busy} onClick={()=>void act(async()=>command({op:'showcase',projectId,versionId:id===a.id?null:a.id,slot,revision:data.revision}))}>{t(id===a.id?'remove':id?'replace':'display')}</button>{id===a.id&&[-1,1].map(offset=><button key={offset} aria-label={t(offset===-1?'moveLeft':'moveRight')} disabled={busy||slot+offset<0||slot+offset>5} onClick={()=>void act(async()=>{const slots=[...data.slots];[slots[slot],slots[slot+offset]]=[slots[slot+offset]!,slots[slot]!];await command({op:'showcase-set',projectId,slots,revision:data.showcaseRevision})})}>{offset===-1?'←':'→'}</button>)}</div>)}</div></details>
              <details className="ci-secondary"><summary>{t('versionDetails')}</summary><p>{t('restoreHint')}</p><div className="ci-actions"><button disabled={busy||!!data.active} onClick={()=>void act(async()=>{const p=await command({op:'restore',projectId,versionId:a.id});await props.refreshProjects?.(p.id);if(selectedRef.current===data.id&&panelRef.current==='versions'){setProjectId(p.id);show('chat')}})}>{t('restore')}</button><button onClick={()=>{setNotice(t('coverSwitch'));show('preview')}}>{t('takeCover')}</button></div><p>{t('included')} ({Object.keys(a.manifest.files).length})</p><pre className="ci-code">{Object.keys(a.manifest.files).join('\n')}</pre><p>{t('excluded')}</p><pre className="ci-code">{a.manifest.excluded.join('\n')}</pre>{a.notes&&<pre className="ci-code">{JSON.stringify(a.notes,null,2)}</pre>}</details>
              <details className="ci-secondary"><summary>{t('savedShelf')}</summary>{savedList}</details>
            </article>:<><p className="ci-dialogue-line">{t('coastHello')}</p>{data.achievements.length?savedList:<><p>{t('noSaved')}</p><button onClick={showCurrentPreview}>{t('tryWork')}</button><button onClick={()=>show('save')}>{t('keepWork')}</button></>}</>}
          </>}
          {!current&&['delivery','files','changes','preview','save','versions','feedback','notes'].includes(panel)&&<><p>{t('noProjects')}</p><button onClick={()=>show('projects')}>{t('project')}</button><button onClick={()=>show('chat')}>{t('talkAqi')}</button></>}
        </div>}
        {panel==='preview'&&preview?.state==='ready'&&previewFooter}
      </aside>}
      {modelSettings&&<ModelSettings actions={props.models} close={()=>setModelSettings(false)} t={props.t}/>}
    </div></>
}
