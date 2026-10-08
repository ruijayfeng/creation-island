import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-jobs'
import { stopOwnedJobs } from './jobs.js'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import { mkdir, readFile, readdir, stat, realpath, rm, writeFile, rename, copyFile } from 'node:fs/promises'
import { resolve, basename, extname, dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { atomic, scan, same, materialize, diff, textObject, safePath, type Manifest } from './files.js'
import { Previews, recipes } from './preview.js'
import { digest } from './files.js'
import { emptyNotes, validateNotes, notesContext, type ProjectNotes } from './notes.js'
import { starterList, starterSource } from './starters.js'
import { ProjectMedia } from './media.js'
import { validateAnnotations, type GrowthMetadata } from './metadata.js'
import type {} from '@deepseek-ai/dsh-attachment'
const exec = promisify(execFile)
export interface Achievement { id: string; projectId: string; title: string; note: string; createdAt: number; manifest: Manifest; notes?:ProjectNotes }
export interface Run { id: string; projectId: string; sessionId: string; turn: number; state: 'running'|'finished'|'interrupted'|'failed'; startedAt: number; before?: Manifest; after?: Manifest; error?: string; notes?:ProjectNotes }
interface ProjectRecord extends GrowthMetadata { revision: number; achievements: Achievement[]; slots: (string|null)[]; runs: Run[] }
interface Build { projectId:string; versionId:string; directory:string; manifest:Manifest; log:string; createdAt:number }
interface State { builds?:Record<string,Build>; version:1|2; projects: Record<string,ProjectRecord>; receipts: Record<string,{ fingerprint:string; result:unknown }> }
const validId = (value: unknown): value is string => typeof value === 'string' && /^[\w-]{1,160}$/.test(value) && !['__proto__','constructor','prototype'].includes(value)
export const inject = ['workspaceRegistry','webServer','sessions','jobs','attachments']
export function apply(ctx: Context) {
  ctx.inject(['systemPrompt'], c => c.effect(() => c.systemPrompt.section({ name:'creation-island:partner', order:50, text:'You are 阿启 (Aqi), the making partner in Creation Island. Work on real files in the current project using the available tools and actual permissions. Read existing files before editing. Do not claim a task result is verified without running checks. Never claim a URL is a verified preview: the host checks previews separately. User-confirmed saved achievements are separate from finishing a turn. Favor simple runnable Web projects for new ideas, retain existing project structure when editing. Do not run persistent preview servers yourself: provide a package.json dev/start script honoring PORT and HOST, or static index.html, for the host to run. Do not install dependencies or access outside the project by bypassing runtime approval. Shiye and Adu are local management interfaces, not additional agents. Respond in the user’s language.' }), 'creation-island persona'))
  const home = resolve(process.env.DSH_HOME ?? '.creation-island-home', 'open-projects')
  const objects = resolve(home,'objects'), store = resolve(home,'state.json')
  const previews = new Previews()
  let state: State = { version:2, projects:{}, receipts:{} }
  const initialized = (async () => {
    try { state = JSON.parse(await readFile(store,'utf8')); if (![1,2].includes(state.version) || !state.projects || !state.receipts) throw new Error('corrupt') }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e }
    if(state.version===1) {
      await copyFile(store,`${store}.v1-backup`,2).catch(e=>{if(e.code!=='EEXIST')throw e})
      for(const r of Object.values(state.projects)) Object.assign(r,{notes:emptyNotes(),showcaseRevision:0,captures:{},feedback:{},covers:{}})
      state.version=2;await atomic(store,state)
    }
    let interrupted = false
    // Older receipts stored JSON arguments; hashes avoid retaining image bytes
    // outside the private, reference-counted media objects.
    for(const receipt of Object.values(state.receipts))if(receipt.fingerprint.startsWith('{')){receipt.fingerprint=digest(receipt.fingerprint);interrupted=true}
    for (const p of Object.values(state.projects)) for (const run of p.runs) if (run.state === 'running') { run.state='interrupted'; interrupted=true }
    if (interrupted) await atomic(store,state)
  })()
  let tail: Promise<unknown> = initialized
  const serial = <T>(fn:()=>Promise<T>) => { const result=tail.then(fn); tail=result.catch(()=>{}); return result }
  const project = (id: string) => {
    if (!validId(id)) throw new Error('project')
    const workspace = ctx.workspaceRegistry.get(WorkspaceId(id)); if (!workspace) throw new Error('project'); return workspace
  }
  const record = (id:string) => state.projects[id] ??= { revision:0, achievements:[], slots:Array(6).fill(null), runs:[], notes:emptyNotes(),showcaseRevision:0,captures:{},feedback:{},covers:{} }
  let owner: { sessionId: string; projectId: string; run: Run; agent:Agent; finishing?:boolean } | undefined
  let maintenance = false
  // The runtime assembles context BEFORE agent/pre-step. Contribute through its
  // public assembly waterfall, scoped by the actual agent/session association.
  const contexts=new WeakMap<Agent,{turn:number;projectId:string;value:string;notes:ProjectNotes}>()
  ctx.on('system-prompt/assemble',async (assembly,context,next)=>{
    await initialized
    const result=await next(),agent=context.agent
    if(!agent)return result
    const workspace=ctx.workspaceRegistry.list().find(p=>p.sessionIds.includes(agent.session.id))
    if(!workspace)return result
    const started=[...agent.session.snapshotEvents()].reverse().find(e=>e.type==='turn/start')
    const turn=started?.type==='turn/start'?started.data.turn:0
    let frozen=contexts.get(agent)
    if(!frozen||frozen.turn!==turn||frozen.projectId!==workspace.id){
      const notes=structuredClone(record(workspace.id).notes)
      frozen={turn,projectId:workspace.id,value:notesContext(workspace.id,notes),notes}
      contexts.set(agent,frozen)
    }
    return {...result,variables:{...result.variables,ci_project_notes:frozen.value},contexts:[...result.contexts,...(frozen.value?[{name:'creation-island:notes',text:'{{ci_project_notes}}'}]:[])]}
  })
  const media=new ProjectMedia(resolve(home,'media'),ctx.attachments)
  async function copyProject(cmd:Record<string,any>,manifest:Manifest,title:string,extra?:{starter?:GrowthMetadata['starter'];notes?:ProjectNotes}) {
    const journalFile=resolve(home,'transactions',`${cmd.requestId}.json`)
    let journal:{target:string;ready:boolean;id?:string;fingerprint:string;manifest:Manifest;title:string;extra?:typeof extra}
    const fingerprint=digest(JSON.stringify({...cmd,requestId:undefined}))
    try{journal=JSON.parse(await readFile(journalFile,'utf8'));if(journal.fingerprint.startsWith('{'))journal.fingerprint=digest(journal.fingerprint);if(journal.fingerprint!==fingerprint)throw new Error('conflict')}
    catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e; journal={target:resolve(home,'workspaces',`copy-${cmd.requestId}`),ready:false,fingerprint,manifest,title,extra};await atomic(journalFile,journal)}
    manifest=journal.manifest;title=journal.title;extra=journal.extra
    if(!journal.ready){
      const stage=`${journal.target}.preparing`;await rm(stage,{recursive:true,force:true});await mkdir(stage,{recursive:true});await materialize(manifest,objects,stage)
      // A previous rename may have completed before its journal update.
      try{await rename(stage,journal.target)}catch(e){if(!['EEXIST','ENOTEMPTY'].includes((e as NodeJS.ErrnoException).code??''))throw e;if(!same(manifest,await scan(journal.target)))throw new Error('changed');await rm(stage,{recursive:true,force:true})}
      journal.ready=true;await atomic(journalFile,journal)
    }
    const existing=ctx.workspaceRegistry.list().find(p=>p.path===journal.target)
    const workspace=existing??await ctx.workspaceRegistry.create(journal.target,title)
    journal.id=workspace.id;await atomic(journalFile,journal)
    const r=record(workspace.id)
    if(extra?.starter)r.starter=extra.starter
    if(extra?.notes&&r.notes.revision===0)r.notes={...structuredClone(extra.notes),revision:1}
    return {id:workspace.id,path:workspace.path}
  }
  const finish = (sessionId:string) => {
    if (!owner || owner.sessionId !== sessionId || owner.finishing) return
    const current=owner
    current.finishing=true
    void serial(async () => {
      current.run = record(current.projectId).runs.find(r=>r.id===current.run.id) ?? current.run
      try { await stopOwnedJobs(ctx.jobs,current.agent); current.run.after = await scan(project(current.projectId).path,objects); current.run.state='finished'; const events=ctx.sessions.get(sessionId as import('@deepseek-ai/dsh-session').SessionId)?.snapshotEvents(); const ended=[...(events??[])].reverse().find(e=>e.type==='turn/end'); if(ended?.type==='turn/end' && ended.data.reason.kind!=='completed') current.run.state=ended.data.reason.kind==='error'?'failed':'interrupted' }
      catch (e) { current.run.state='failed'; current.run.error=(e as Error).message }
      await atomic(store,state)
    }).catch(() => { current.run.state='failed'; current.run.error='storage' }).finally(() => { if (owner === current) {
      const live=ctx.jobs.list(current.agent).some(j=>j.ownerSession===sessionId&&['running','stopping'].includes(j.status))
      if(!live) owner=undefined
      else current.finishing=false
    } })
  }
  ctx.effect(()=>ctx.jobs.onJobsChanged(agent=>{
    if(agent && owner?.sessionId===agent.session.id && owner.run.state!=='running' && !owner.finishing) finish(agent.session.id)
  }), 'creation-projects: late job settlement')
  ctx.on('agent/pre-step', async ({agent,turn,signal},next) => {
    await initialized
    const sessionId=agent.session.id
    const workspace=ctx.workspaceRegistry.list().find(p=>p.sessionIds.includes(sessionId))
    if (!workspace) return next()
    if (maintenance || owner && (owner.sessionId!==sessionId || owner.finishing || owner.run.state!=='running')) throw new Error('Creation Island: another project is working. Please retry when it finishes. / 另一个项目正在工作，请稍后重试。')
    if (!owner) {
      const run: Run = { id:randomUUID(),projectId:workspace.id,sessionId,turn,state:'running',startedAt:Date.now(),notes:contexts.get(agent)?.notes }
      owner={ sessionId,projectId:workspace.id,run,agent }
      try { await serial(async()=> { run.before=await scan(workspace.path,objects); record(workspace.id).runs.push(run); await atomic(store,state) }) }
      catch(e) { owner=undefined; throw e }
    }
    if (signal.aborted) throw new Error('cancelled')
    return next()
  })
  ctx.on('agent/status', ({agent,status})=> { if(status==='idle') finish(agent.session.id) })
  ctx.on('agent/disposed', ({agent})=>finish(agent.session.id))
  ctx.effect(()=>()=>previews.close(), 'creation-projects: preview cleanup')
  const achievement=(id:string,versionId:string) => { const a=record(id).achievements.find(a=>a.id===versionId); if(!a) throw new Error('version'); return a }
  const rootFor=async(id:string,versionId?:string) => {
    const p=project(id)
    if(!versionId) return p.path
    const a=achievement(id,versionId), target=resolve(home,'previews',randomUUID())
    await mkdir(target,{recursive:true}); await materialize(a.manifest,objects,target); return target
  }
  const checkIdle=()=> { if(owner || maintenance) throw new Error('busy') }
  const read=async(id:string) => {
    const p=project(id), data=record(id)
    return { id:p.id,title:p.title,path:p.path,...data, active:owner ? {projectId:owner.projectId,sessionId:owner.sessionId}:null,
      previews:[...previews.records.values()].filter(p=>p.projectId===id), recipes:await recipes(p.path), builds:Object.entries(state.builds??{}).filter(([,b])=>b.projectId===id).map(([buildId,b])=>({buildId,...b})) }
  }
  async function command(cmd: Record<string,any>) {
    if(!validId(cmd.requestId)) throw new Error('request')
    const fingerprint=digest(JSON.stringify({...cmd,requestId:undefined}))
    const previous=state.receipts[cmd.requestId]
    if(previous) {
      if(previous.fingerprint!==fingerprint) throw new Error('conflict')
      if(['preview','starter-preview'].includes(cmd.op)) {const saved=previous.result as import('./preview.js').Preview;return previews.records.get(saved.id)??{...saved,state:'stopped',url:undefined}}
      return previous.result
    }
    const id=String(cmd.projectId ?? '')
    if(!['create','starter-copy','starter-preview','starter-stop'].includes(cmd.op)) project(id)
    let result:unknown
    switch(cmd.op) {
      case 'starter-copy': {
        checkIdle();const {item,manifest}=await starterSource(cmd.starterId,objects)
        const title=String(cmd.title??item.title[0]).trim();if(!title||title.length>80)throw new Error('title')
        result=await copyProject(cmd,manifest,title,{starter:{id:item.id,version:item.version,manifestHash:item.manifestHash}});break
      }
      case 'starter-preview': {
        const {item,manifest}=await starterSource(cmd.starterId,objects)
        const root=resolve(home,'starter-previews',cmd.requestId);await rm(root,{recursive:true,force:true});await mkdir(root,{recursive:true});await materialize(manifest,objects,root)
        result=await previews.start(`starter-${item.id}`,root,{kind:'static',directory:'',command:'HTTP .'});break
      }
      case 'starter-stop': {
        const p=previews.records.get(cmd.previewId);if(!p?.projectId.startsWith('starter-'))throw new Error('preview');await previews.stop(p.id);result={ok:true};break
      }
      case 'notes-save': {
        const r=record(id);if(cmd.revision!==r.notes.revision)throw new Error('conflict')
        r.notes=validateNotes(cmd.notes,r.notes.revision+1);result=r.notes;break
      }
      case 'showcase-set': {
        const r=record(id)
        if(cmd.revision!==r.showcaseRevision)throw new Error('conflict')
        if(!Array.isArray(cmd.slots)||cmd.slots.length!==6||new Set(cmd.slots.filter((v:unknown)=>v!==null)).size!==cmd.slots.filter((v:unknown)=>v!==null).length)throw new Error('conflict')
        for(const v of cmd.slots)if(v!==null)achievement(id,v)
        r.slots=[...cmd.slots];r.showcaseRevision++;r.revision++;result={ok:true};break
      }
      case 'media-save': {
        const parent=cmd.derivedFrom?record(id).captures[cmd.derivedFrom]:undefined
        if(cmd.derivedFrom&&!parent)throw new Error('invalid-media')
        if(parent){if(parent.sessionId&&parent.sessionId!==cmd.sessionId)throw new Error('session');Object.assign(cmd,{source:parent.source,previewId:parent.previewId,versionId:parent.versionId,capturedAt:parent.capturedAt})}
        if(cmd.sessionId&&!project(id).sessionIds.includes(cmd.sessionId))throw new Error('session')
        if(cmd.versionId)achievement(id,cmd.versionId)
        if(cmd.source==='preview'&&!parent){
          const p=previews.records.get(cmd.previewId)
          if(!p||p.projectId!==id||p.state!=='ready'||p.versionId!==cmd.versionId)throw new Error('source-changed')
        }
        const capture=await media.save(id,cmd,parent)
        record(id).captures[capture.id]=capture;result=capture;break
      }
      case 'feedback-save': {
        const r=record(id),d=cmd.draft
        if(!d||!project(id).sessionIds.includes(d.sessionId)||!r.captures[d.captureId]||(r.captures[d.captureId]!.sessionId&&r.captures[d.captureId]!.sessionId!==d.sessionId))throw new Error('session')
        const old=r.feedback[d.sessionId]
        if(cmd.revision!==(old?.revision??0))throw new Error('conflict')
        if(typeof d.text!=='string'||d.text.length>6000||String(d.route??'').length>300||(d.requestId&&!validId(d.requestId)))throw new Error('feedback-invalid')
        if(d.delivery&&(typeof d.delivery.text!=='string'||d.delivery.text.length>24000||(d.delivery.imageCaptureId&&!r.captures[d.delivery.imageCaptureId])))throw new Error('feedback-invalid')
        const annotations=validateAnnotations(d.annotations)
        r.feedback[d.sessionId]={revision:(old?.revision??0)+1,sessionId:d.sessionId,captureId:d.captureId,annotations,text:d.text,route:String(d.route??''),requestId:d.requestId,submission:d.requestId?'pending':undefined,delivery:d.delivery?{text:d.delivery.text,imageCaptureId:d.delivery.imageCaptureId}:undefined}
        result=r.feedback[d.sessionId];break
      }
      case 'feedback-delete': {
        const r=record(id);if(cmd.revision!==(r.feedback[cmd.sessionId]?.revision??0))throw new Error('conflict');delete r.feedback[cmd.sessionId];result={ok:true};break
      }
      case 'cover-set': {
        const r=record(id),a=achievement(id,cmd.versionId),capture=r.captures[cmd.captureId],p=capture&&previews.records.get(capture.previewId??'')
        if(cmd.revision!==(r.covers[a.id]?.revision??0))throw new Error('conflict')
        if(!capture||capture.source!=='preview'||capture.versionId!==a.id||!capture.thumbnailHash||!p||p.kind!=='static'||p.state!=='ready'||p.versionId!==a.id||!cmd.confirmed)throw new Error('source-changed')
        r.covers[a.id]={captureId:capture.id,manifestHash:digest(JSON.stringify(a.manifest)),revision:(r.covers[a.id]?.revision??0)+1};result=r.covers[a.id];break
      }
      case 'create': {
        if(typeof cmd.title!=='string' || !cmd.title.trim() || cmd.title.length>80) throw new Error('title')
        const parent=cmd.parent ? await realpath(cmd.parent) : resolve(home,'workspaces')
        await mkdir(parent,{recursive:true})
        const target=resolve(parent,`${cmd.title.replace(/[^\p{L}\p{N}_-]/gu,'-')}-${cmd.requestId}`)
        await mkdir(target) // Never adopt an existing directory after an unknown outcome.
        const p=await ctx.workspaceRegistry.create(target,cmd.title.trim())
        result={id:p.id,path:p.path}; break
      }
      case 'save': {
        checkIdle(); if(cmd.revision!==record(id).revision) throw new Error('conflict')
        if(typeof cmd.title!=='string' || !cmd.title.trim() || cmd.title.length>120 || String(cmd.note??'').length>4000) throw new Error('title')
        maintenance=true
        try {
          const manifest=await scan(project(id).path,objects)
          if(!Object.keys(manifest.files).length) throw new Error('empty')
          if(!same(manifest,await scan(project(id).path))) throw new Error('changed')
          const a:Achievement={id:randomUUID(),projectId:id,title:cmd.title.trim(),note:String(cmd.note??''),createdAt:Date.now(),manifest,notes:structuredClone(record(id).notes)}
          record(id).achievements.push(a); record(id).revision++; result=a
        } finally { maintenance=false }
        break
      }
      case 'showcase': {
        if(cmd.revision!==record(id).revision || !Number.isInteger(cmd.slot) || cmd.slot<0 || cmd.slot>5) throw new Error('conflict')
        if(cmd.versionId!==null) achievement(id,cmd.versionId)
        if(cmd.versionId!==null)record(id).slots=record(id).slots.map(v=>v===cmd.versionId?null:v);record(id).slots[cmd.slot]=cmd.versionId; record(id).revision++;record(id).showcaseRevision++; result={ok:true}; break
      }
      case 'restore': {
        checkIdle(); const a=achievement(id,cmd.versionId)
        result=await copyProject(cmd,a.manifest,`${project(id).title} — ${a.title}`,{notes:a.notes});break
      }
      case 'preview': {
        checkIdle()
        const root=await rootFor(id,cmd.versionId)
        const available=await recipes(root), recipe=available.find(r=>r.kind===cmd.kind && r.directory===String(cmd.directory??'') && r.script===cmd.script)
        if(!recipe) throw new Error('recipe')
        // The caller explicitly confirms this exact server command; never inferred from a model URL.
        if(cmd.confirmCommand!==recipe.command) throw new Error('approval')
        result=await previews.start(id,root,recipe,cmd.versionId); break
      }
      case 'stop-preview': {
        const p=previews.records.get(cmd.previewId); if(!p || p.projectId!==id) throw new Error('preview')
        await previews.stop(p.id); result={ok:true}; break
      }
      case 'build': {
        checkIdle(); const a=achievement(id,cmd.versionId)
        const target=resolve(home,'builds',cmd.requestId); await mkdir(target,{recursive:true}); await materialize(a.manifest,objects,target)
        const pkg=JSON.parse(await readFile(resolve(target,'package.json'),'utf8'))
        if(typeof pkg.scripts?.build!=='string' || cmd.confirmCommand!=='install dependencies + npm run build') throw new Error('approval')
        maintenance=true
        try {
          const env={ PATH:`${dirname(process.execPath)}:${process.env.PATH??''}`, HOME:target, TMPDIR:process.env.TMPDIR, LANG:process.env.LANG, CI:'true' }
          const install=await exec('npm',[a.manifest.files['package-lock.json']?'ci':'install','--no-audit','--no-fund'],{cwd:target,env,timeout:180000,maxBuffer:1024*1024})
          const build=await exec('npm',['run','build'],{cwd:target,env,timeout:180000,maxBuffer:1024*1024})
          const recipe=(await recipes(target)).find(r=>r.kind==='static' && r.directory!=='')
          if(!recipe) throw new Error('no-static-build')
          const dir=resolve(target,recipe.directory), manifest=await scan(dir,objects)
          const preview=await previews.start(id,dir,{kind:'static',directory:'',command:'HTTP verified build'},a.id)
          if(preview.state!=='ready') throw new Error('build-preview')
          result={buildId:cmd.requestId,projectId:id,versionId:a.id,directory:recipe.directory,manifest,log:(install.stdout+'\n'+build.stdout).slice(-12000),createdAt:Date.now()}
          state.builds??={};state.builds[cmd.requestId]=result as Build
        } finally {maintenance=false}
        break
      }
      case 'export': {
        const a=achievement(id,cmd.versionId), target=resolve(home,'exports',cmd.requestId)
        await mkdir(target,{recursive:true}); const source=resolve(target,'project'); await mkdir(source)
        const built=cmd.kind==='static' ? state.builds?.[cmd.buildId] : undefined
        if(cmd.kind==='static' && (!built || built.projectId!==id || built.versionId!==a.id)) throw new Error('build-required')
        const exported=built?.manifest??a.manifest
        await materialize(exported,objects,source)
        for(const [path,file] of Object.entries(exported.files)) {
          if(file.size>2*1024*1024) continue
          const text=await textObject(objects,file.hash)
          if(text && /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:sk-[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{16})/.test(text)) throw new Error('sensitive-export')
        }
        const instructions = `# ${a.title}\n\nSaved: ${new Date(a.createdAt).toISOString()}\nVersion: ${a.id}\n\n${a.note}\n\n${built?'Verified static build. Serve the project directory using an HTTP static server; double-clicking files may not work. / 已验证静态构建：使用 HTTP 静态服务部署 project 目录，不能保证双击运行。':'Source snapshot. Dependencies, credentials and Git history are not included.'}\n源码快照，不包含依赖、凭据和 Git 历史。\n\n${(await recipes(source)).map(r=>r.command).join('\n') || 'No verified startup recipe. / 未检测到已验证的启动方式。'}\n\nFor Node projects install the lockfile-matched dependencies first; inspect package.json scripts and configure required services.\nNode 项目需按锁文件安装依赖，核对脚本并配置所需服务。\n\nExcluded / 排除项:\n${exported.excluded.join('\n')}\n`
        await writeFile(resolve(target,'RUNNING.md'),instructions+(cmd.includeNotes&&a.notes?'\n## Confirmed project notes / 已确认项目记录\n\n'+JSON.stringify(a.notes,null,2):''))
        await writeFile(resolve(target,'manifest.json'),JSON.stringify(exported,null,2))
        let name=cmd.kind==='static'?'static.tar.gz':'source.tar.gz'
        if(cmd.kind==='html') {
          const paths=Object.keys(a.manifest.files)
          if(paths.length!==1 || paths[0]!=='index.html') throw new Error('not-self-contained')
          const html=await readFile(resolve(source,'index.html'),'utf8')
          if(/(?:\b(?:src|href)\s*=\s*["'](?!data:|#)|\b(?:fetch|import|XMLHttpRequest|WebSocket)\s*\(|url\s*\(\s*(?!["']?data:))/i.test(html)) throw new Error('not-self-contained')
          name='index.html'; await writeFile(resolve(target,name),html)
        } else if(!['source','static'].includes(cmd.kind)) throw new Error('export-kind')
        else await exec('/usr/bin/tar',['-czf',resolve(target,name),'-C',target,'project','RUNNING.md','manifest.json'])
        result={exportId:cmd.requestId,name}; break
      }
      default: throw new Error('operation')
    }
    await media.collect(Object.values(state.projects))
    state.receipts[cmd.requestId]={fingerprint,result}
    await atomic(store,state)
    return result
  }
  ctx.effect(()=>ctx.webServer.register({kind:'prefix',path:'/creation/projects',handler:async(req,res)=> {
    const reply=(code:number,value:unknown)=> {res.writeHead(code,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value))}
    if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress??'') || !/^127\.0\.0\.1:\d+$/.test(req.headers.host??'') || req.headers['x-creation-projects']!=='1' || req.headers.origin && req.headers.origin!==`http://${req.headers.host}`) {reply(403,{error:'origin'});return}
    try {
      await initialized
      const url=new URL(req.url??'/', 'http://localhost'), id=url.searchParams.get('project')??''
      if(req.method==='POST') {
        let body='';for await(const chunk of req) {body+=chunk;if(body.length>13*1024*1024) throw new Error('size')}
        const cmd=JSON.parse(body)
        const result=await serial(async()=> {
          const before=structuredClone(state)
          try {return await command(cmd)} catch(e) {state=before;throw e}
        }); reply(200,result);return
      }
      if(req.method!=='GET') {reply(405,{});return}
      if(url.pathname.endsWith('/status')) {reply(200,{active:owner?{projectId:owner.projectId,sessionId:owner.sessionId}:null});return}
      if(url.pathname.endsWith('/download')) {
        const exportId=url.searchParams.get('export')??'', name=url.searchParams.get('name')??''
        if(!validId(exportId) || !['source.tar.gz','static.tar.gz','index.html'].includes(name) || !state.receipts[exportId]) throw new Error('export')
        const bytes=await readFile(resolve(home,'exports',exportId,name));res.writeHead(200,{'content-type':'application/octet-stream','content-disposition':`attachment; filename="${name}"`});res.end(bytes);return
      }
      if(url.pathname.endsWith('/starters')){reply(200,await starterList());return}
      if(url.pathname.endsWith('/image-limits')){reply(200,ctx.attachments.imageLimits);return}
      project(id)
      if(url.pathname.endsWith('/media')){const bytes=await media.read(record(id).captures,url.searchParams.get('hash')??'');res.writeHead(200,{'content-type':'image/png','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(bytes);return}
      if(url.pathname.endsWith('/submission')){
        const sessionId=url.searchParams.get('session')??'',requestId=url.searchParams.get('request')??''
        if(!project(id).sessionIds.includes(sessionId as import('@deepseek-ai/dsh-session').SessionId))throw new Error('session')
        const events=ctx.sessions.get(sessionId as import('@deepseek-ai/dsh-session').SessionId)?.snapshotEvents()
        const accepted=events?.some(e=>e.type==='user/message' && (e.data.source as {rpcId?:string}).rpcId===requestId || e.type==='agent/inbox/spliced' && e.data.inserted.some(m=>(m.source as {rpcId?:string}).rpcId===requestId))
        reply(200,{accepted:!!accepted,known:!!events});return
      }
      if(url.pathname.endsWith('/files')) {
        const path=url.searchParams.get('path')??'', file=await safePath(project(id).path,path)
        const info=await stat(file)
        if(info.isDirectory()) {reply(200,{kind:'directory',path,entries:(await readdir(file,{withFileTypes:true})).map(e=>({name:e.name,directory:e.isDirectory(),link:e.isSymbolicLink()}))});return}
        if(!info.isFile() || info.size>512*1024) throw new Error('size')
        const bytes=await readFile(file)
        if(['.png','.jpg','.jpeg','.webp','.gif'].includes(extname(file).toLowerCase())) {reply(200,{kind:'image',data:`data:image/${extname(file).slice(1)};base64,${bytes.toString('base64')}`});return}
        if(bytes.includes(0)) throw new Error('binary')
        reply(200,{kind:'file',text:new TextDecoder('utf-8',{fatal:true}).decode(bytes)});return
      }
      if(url.pathname.endsWith('/changes')) {
        const run=record(id).runs.at(-1)
        const after=run?.after ?? (run?.before ? await scan(project(id).path,objects):undefined)
        if(!run?.before || !after) {reply(200,{run,changes:[]});return}
        const changes=diff(run.before,after), path=url.searchParams.get('path'), change=changes.find(c=>c.path===path)
        reply(200,{run:{...run,before:undefined,after:undefined},changes,...change?{before:await textObject(objects,change.before),after:await textObject(objects,change.after)}:{}});return
      }
      if(url.pathname.endsWith('/version-recipes')) {const root=await rootFor(id,url.searchParams.get('version')??'');reply(200,await recipes(root));return}
      reply(200,await read(id))
    } catch(e) { reply(409,{error:(e as Error).message}) }
  }}),'creation-projects: API')
}
