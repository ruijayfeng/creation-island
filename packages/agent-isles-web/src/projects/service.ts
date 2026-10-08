import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import { mkdir, readFile, readdir, stat, realpath, rm, writeFile } from 'node:fs/promises'
import { resolve, basename, extname, dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { atomic, scan, same, materialize, diff, textObject, safePath, type Manifest } from './files.js'
import { Previews, recipes } from './preview.js'
const exec = promisify(execFile)
export interface Achievement { id: string; projectId: string; title: string; note: string; createdAt: number; manifest: Manifest }
export interface Run { id: string; projectId: string; sessionId: string; turn: number; state: 'running'|'finished'|'interrupted'|'failed'; startedAt: number; before?: Manifest; after?: Manifest; error?: string }
interface ProjectRecord { revision: number; achievements: Achievement[]; slots: (string|null)[]; runs: Run[] }
interface Build { projectId:string; versionId:string; directory:string; manifest:Manifest; log:string; createdAt:number }
interface State { builds?:Record<string,Build>; version:1; projects: Record<string,ProjectRecord>; receipts: Record<string,{ fingerprint:string; result:unknown }> }
const validId = (value: unknown): value is string => typeof value === 'string' && /^[\w-]{1,160}$/.test(value) && !['__proto__','constructor','prototype'].includes(value)
export const inject = ['workspaceRegistry','webServer','sessions']
export function apply(ctx: Context) {
  ctx.inject(['systemPrompt'], c => c.effect(() => c.systemPrompt.section({ name:'creation-island:partner', order:50, text:'You are 阿启 (Aqi), the making partner in Creation Island. Work on real files in the current project using the available tools and actual permissions. Read existing files before editing. Do not claim a task result is verified without running checks. Never claim a URL is a verified preview: the host checks previews separately. User-confirmed saved achievements are separate from finishing a turn. Favor simple runnable Web projects for new ideas, retain existing project structure when editing. Do not run persistent preview servers yourself: provide a package.json dev/start script honoring PORT and HOST, or static index.html, for the host to run. Do not install dependencies or access outside the project by bypassing runtime approval. Shiye and Adu are local management interfaces, not additional agents. Respond in the user’s language.' }), 'creation-island persona'))
  const home = resolve(process.env.DSH_HOME ?? '.creation-island-home', 'open-projects')
  const objects = resolve(home,'objects'), store = resolve(home,'state.json')
  const previews = new Previews()
  let state: State = { version:1, projects:{}, receipts:{} }
  const initialized = (async () => {
    try { state = JSON.parse(await readFile(store,'utf8')); if (state.version !== 1 || !state.projects || !state.receipts) throw new Error('corrupt') }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e }
    let interrupted = false
    for (const p of Object.values(state.projects)) for (const run of p.runs) if (run.state === 'running') { run.state='interrupted'; interrupted=true }
    if (interrupted) await atomic(store,state)
  })()
  let tail: Promise<unknown> = initialized
  const serial = <T>(fn:()=>Promise<T>) => { const result=tail.then(fn); tail=result.catch(()=>{}); return result }
  const project = (id: string) => {
    if (!validId(id)) throw new Error('project')
    const workspace = ctx.workspaceRegistry.get(WorkspaceId(id)); if (!workspace) throw new Error('project'); return workspace
  }
  const record = (id:string) => state.projects[id] ??= { revision:0, achievements:[], slots:Array(6).fill(null), runs:[] }
  let owner: { sessionId: string; projectId: string; run: Run } | undefined
  let maintenance = false
  const finish = (sessionId:string) => {
    if (!owner || owner.sessionId !== sessionId) return
    const current=owner
    void serial(async () => {
      current.run = record(current.projectId).runs.find(r=>r.id===current.run.id) ?? current.run
      try { current.run.after = await scan(project(current.projectId).path,objects); current.run.state='finished'; const events=ctx.sessions.get(sessionId as import('@deepseek-ai/dsh-session').SessionId)?.snapshotEvents(); const ended=[...(events??[])].reverse().find(e=>e.type==='turn/end'); if(ended?.type==='turn/end' && ended.data.reason.kind!=='completed') current.run.state=ended.data.reason.kind==='error'?'failed':'interrupted' }
      catch (e) { current.run.state='failed'; current.run.error=(e as Error).message }
      await atomic(store,state)
    }).catch(() => { current.run.state='failed'; current.run.error='storage' }).finally(() => { if (owner === current) owner=undefined })
  }
  ctx.on('agent/pre-step', async ({agent,turn,signal},next) => {
    await initialized
    const sessionId=agent.session.id
    const workspace=ctx.workspaceRegistry.list().find(p=>p.sessionIds.includes(sessionId))
    if (!workspace) return next()
    if (maintenance || owner && owner.sessionId!==sessionId) throw new Error('Creation Island: another project is working. Please retry when it finishes. / 另一个项目正在工作，请稍后重试。')
    if (!owner) {
      const run: Run = { id:randomUUID(),projectId:workspace.id,sessionId,turn,state:'running',startedAt:Date.now() }
      owner={ sessionId,projectId:workspace.id,run }
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
    const fingerprint=JSON.stringify({...cmd,requestId:undefined})
    const previous=state.receipts[cmd.requestId]
    if(previous) { if(previous.fingerprint!==fingerprint) throw new Error('conflict'); return previous.result }
    const id=String(cmd.projectId ?? '')
    if(cmd.op!=='create') project(id)
    let result:unknown
    switch(cmd.op) {
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
          const a:Achievement={id:randomUUID(),projectId:id,title:cmd.title.trim(),note:String(cmd.note??''),createdAt:Date.now(),manifest}
          record(id).achievements.push(a); record(id).revision++; result=a
        } finally { maintenance=false }
        break
      }
      case 'showcase': {
        if(cmd.revision!==record(id).revision || !Number.isInteger(cmd.slot) || cmd.slot<0 || cmd.slot>5) throw new Error('conflict')
        if(cmd.versionId!==null) achievement(id,cmd.versionId)
        record(id).slots[cmd.slot]=cmd.versionId; record(id).revision++; result={ok:true}; break
      }
      case 'restore': {
        checkIdle(); const a=achievement(id,cmd.versionId)
        const target=resolve(home,'workspaces',`restored-${cmd.requestId}`); await mkdir(target,{recursive:true}); await materialize(a.manifest,objects,target)
        const p=await ctx.workspaceRegistry.create(target,`${project(id).title} — ${a.title}`); result={id:p.id,path:p.path}; break
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
        const instructions = `# ${a.title}\n\nSaved: ${new Date(a.createdAt).toISOString()}\nVersion: ${a.id}\n\n${a.note}\n\nSource snapshot. Dependencies, credentials and Git history are not included.\n源码快照，不包含依赖、凭据和 Git 历史。\n\n${(await recipes(source)).map(r=>r.command).join('\n') || 'No verified startup recipe. / 未检测到已验证的启动方式。'}\n\nFor Node projects install the lockfile-matched dependencies first; inspect package.json scripts and configure required services.\nNode 项目需按锁文件安装依赖，核对脚本并配置所需服务。\n\nExcluded / 排除项:\n${exported.excluded.join('\n')}\n`
        await writeFile(resolve(target,'RUNNING.md'),instructions)
        await writeFile(resolve(target,'manifest.json'),JSON.stringify(exported,null,2))
        let name='source.tar.gz'
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
    state.receipts[cmd.requestId]={fingerprint,result}
    await atomic(store,state)
    return result
  }
  ctx.effect(()=>ctx.webServer.register({kind:'prefix',path:'/creation/projects/',handler:async(req,res)=> {
    const reply=(code:number,value:unknown)=> {res.writeHead(code,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value))}
    if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress??'') || !/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(req.headers.host??'') || req.headers['x-creation-projects']!=='1' || req.headers.origin && req.headers.origin!==`http://${req.headers.host}`) {reply(403,{error:'origin'});return}
    try {
      await initialized
      const url=new URL(req.url??'/', 'http://localhost'), id=url.searchParams.get('project')??''
      if(req.method==='POST') {
        let body='';for await(const chunk of req) {body+=chunk;if(body.length>1024*1024) throw new Error('size')}
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
        if(!validId(exportId) || !['source.tar.gz','index.html'].includes(name) || !state.receipts[exportId]) throw new Error('export')
        const bytes=await readFile(resolve(home,'exports',exportId,name));res.writeHead(200,{'content-type':'application/octet-stream','content-disposition':`attachment; filename="${name}"`});res.end(bytes);return
      }
      project(id)
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
