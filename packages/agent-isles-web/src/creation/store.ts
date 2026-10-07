import { mkdirSync,readFileSync,writeFileSync,renameSync,existsSync,openSync,fsyncSync,closeSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomUUID,createHash } from 'node:crypto'
import { complete,contentSchema,issues,sample,type Content,type Kind } from './content.js'
export interface Version {id:string; created:string; summary:string; rendererVersion:1; data:Content}
export interface Work {id:string;created:string;updated:string;revision:number;draft:Content;versions:Version[];deleted:boolean;history:{role:'user'|'assistant';text:string}[]}
export interface Job {id:string;workId:string;revision:number;status:'queued'|'generating'|'validating'|'ready'|'failed'|'cancelled'|'interrupted';request:string;target:string;error?:string;candidate?:Content;summary?:string;question?:string}
export interface State {works:Work[];jobs:Job[];showcase:({workId:string;versionId:string}|null)[];showcaseRevision:number;requests:Record<string,{hash:string;result:unknown}>}
export class Problem extends Error {constructor(public code:string,public status=400){super(code)}}
export class Store {
  state:State
  constructor(private file:string){
    mkdirSync(dirname(file),{recursive:true,mode:0o700})
    this.state=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{works:[],jobs:[],showcase:Array(6).fill(null),showcaseRevision:0,requests:{}}
    // A corrupt file is never replaced with an empty library.
    if(!Array.isArray(this.state.works)||!Array.isArray(this.state.jobs)||this.state.showcase?.length!==6)throw new Error('Invalid creation library; restore a backup before continuing')
    this.state.works.forEach(w=>{contentSchema.parse(w.draft);w.versions.forEach(v=>complete(v.data))})
    let interrupted=false
    this.state.jobs.forEach(j=>{if(['queued','generating','validating'].includes(j.status)){j.status='interrupted';interrupted=true}})
    if(interrupted)this.persist(this.state)
  }
  private persist(next:State){const tmp=`${this.file}.${randomUUID()}.tmp`;writeFileSync(tmp,JSON.stringify(next),{mode:0o600});const fd=openSync(tmp,'r');try{fsyncSync(fd)}finally{closeSync(fd)}renameSync(tmp,this.file)}
  change<T>(fn:(s:State)=>T):T{const next=structuredClone(this.state);const result=fn(next);this.persist(next);this.state=next;return result}
  work(s:State,id:string,revision?:number):Work {const w=s.works.find(w=>w.id===id);if(!w)throw new Problem('notFound',404);if(revision!==undefined&&w.revision!==revision)throw new Problem('conflict',409);return w}
  command(requestId:string,payload:Record<string,unknown>):unknown {
    if(!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId))throw new Problem('requestId')
    const hash=createHash('sha256').update(JSON.stringify(payload)).digest('hex'),old=this.state.requests[requestId]
    if(old){if(old.hash!==hash)throw new Problem('conflict',409);return old.result}
    return this.change(s=>{const result=this.execute(s,payload);s.requests[requestId]={hash,result};return result})
  }
  private execute(s:State,p:Record<string,unknown>):unknown {
    const now=new Date().toISOString(), uid=()=>randomUUID()
    const create=(data:Content)=>{const w:Work={id:uid(),created:now,updated:now,revision:0,draft:data,versions:[],deleted:false,history:[]};s.works.push(w);return w}
    if(p.op==='create'){if(!['quiz','card','story'].includes(String(p.kind)))throw new Problem('format');return create(sample(p.kind as Kind,p.en===true))}
    if(p.op==='import'){const pack=p.pack as {format?:string;version?:number;rendererVersion?:number;data?:unknown};if(!pack||pack.format!=='creation-island'||pack.version!==1||pack.rendererVersion!==1)throw new Problem('format');return create(complete(pack.data))}
    if(p.op==='showcase'){
      if(p.expectedRevision!==s.showcaseRevision)throw new Problem('conflict',409)
      const slot=Number(p.slot);if(!Number.isInteger(slot)||slot<0||slot>=6)throw new Problem('format')
      const w=this.work(s,String(p.id));const v=w.versions.find(v=>v.id===p.versionId);if(w.deleted||!v)throw new Problem('notFound',404)
      s.showcase[slot]={workId:w.id,versionId:v.id};s.showcaseRevision++;return true
    }
    if(typeof p.expectedRevision!=='number')throw new Problem('conflict',409)
    const w=this.work(s,String(p.id),p.expectedRevision)
    if(w.deleted&&!['restoreTrash','destroy'].includes(String(p.op)))throw new Problem('deleted',409)
    const invalidate=()=>{s.jobs.forEach(j=>{if(j.workId===w.id&&['queued','generating','validating','ready'].includes(j.status))j.status='cancelled'})}
    switch(p.op){
      case 'edit': {const data=contentSchema.parse(p.data);if(data.kind!==w.draft.kind)throw new Problem('format');w.draft=data;invalidate();break}
      case 'save': {complete(w.draft);const v:Version={id:uid(),created:now,summary:typeof p.summary==='string'?p.summary.slice(0,200):'Saved version',rendererVersion:1,data:structuredClone(w.draft)};w.versions.push(v);const slot=s.showcase.findIndex(x=>x?.workId===w.id);const empty=s.showcase.indexOf(null);if(slot>=0||empty>=0){s.showcase[slot>=0?slot:empty]={workId:w.id,versionId:v.id};s.showcaseRevision++}break}
      case 'restore': {const v=w.versions.find(v=>v.id===p.versionId);if(!v)throw new Problem('notFound',404);w.draft=structuredClone(v.data);invalidate();break}
      case 'copy':return create(structuredClone(w.draft))
      case 'trash':w.deleted=true;invalidate();s.showcase=s.showcase.map(x=>x?.workId===w.id?null:x);s.showcaseRevision++;break
      case 'restoreTrash':w.deleted=false;break
      case 'destroy':if(!w.deleted)throw new Problem('format');s.works=s.works.filter(x=>x.id!==w.id);s.jobs=s.jobs.filter(j=>j.workId!==w.id);return true
      case 'generate': {
        if(s.jobs.some(j=>j.workId===w.id&&['queued','generating','validating'].includes(j.status)))throw new Problem('busy',409)
        if(typeof p.request!=='string'||!p.request.trim()||p.request.length>6000)throw new Problem('format')
        let target=typeof p.target==='string'?p.target:'all'
        const ordinal=/第([一二三四五六七八九十]|\d+)[道个]?([题段])/.exec(p.request)??/(?:question|section)\s*(\d+)/i.exec(p.request)
        if(target==='all'&&ordinal){const n=Number(ordinal[1])||'一二三四五六七八九十'.indexOf(ordinal[1])+1;const items=w.draft.kind==='quiz'?w.draft.content.questions:w.draft.kind==='card'?w.draft.content.sections:[];if(items[n-1])target=items[n-1].id}
        const j:Job={id:uid(),workId:w.id,revision:w.revision,status:'queued',request:p.request,target};s.jobs.push(j);w.history.push({role:'user',text:j.request});w.history=w.history.slice(-20);return j
      }
      case 'cancel': {const j=s.jobs.find(j=>j.id===p.jobId&&j.workId===w.id);if(!j)throw new Problem('notFound',404);j.status='cancelled';return j}
      case 'adopt': {const j=s.jobs.find(j=>j.id===p.jobId&&j.workId===w.id);if(!j||j.status!=='ready'||j.revision!==w.revision||!j.candidate)throw new Problem('conflict',409);w.draft=complete(j.candidate);w.history.push({role:'assistant',text:j.summary??''});invalidate();break}
      case 'discard': {const j=s.jobs.find(j=>j.id===p.jobId&&j.workId===w.id);if(!j)throw new Problem('notFound',404);j.status='cancelled';return j}
      default:throw new Problem('format')
    }
    w.revision++;w.updated=now;return {...w,errors:issues(w.draft)}
  }
}
