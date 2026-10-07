import type { IncomingMessage,ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import { mkdirSync,writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { ZodError } from 'zod'
import type { Context } from '@deepseek-ai/cordis'
import type { ModelTestServices } from '../model-test.js'
import { Store,Problem } from './store.js'
import { Generator } from './generation.js'
import { render } from './player.js'
import { complete } from './content.js'
export function installCreation(ctx:Context&ModelTestServices,home:string){
  const store=new Store(resolve(home,'creation-library.json')),generator=new Generator(store,ctx)
  const exports=new Map<string,string>()
  const handler=async(req:IncomingMessage,res:ServerResponse)=>{
    const reply=(status:number,data:unknown)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data))}
    const hosts=['127.0.0.1','localhost','[::1]'].map(h=>`${h}:${ctx.webServer.port}`)
    if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress??'')||!hosts.includes(req.headers.host??'')||req.headers['x-creation-island']!=='1'){reply(403,{error:'forbidden'});return}
    try{
      if(req.method==='GET'){reply(200,{works:store.state.works,jobs:store.state.jobs,showcase:store.state.showcase,showcaseRevision:store.state.showcaseRevision});return}
      if(req.method!=='POST'){reply(405,{error:'method'});return}
      if(req.headers.origin!==`http://${req.headers.host}`||req.headers['content-type']!=='application/json'){reply(403,{error:'forbidden'});return}
      let size=0;const parts:Buffer[]=[]
      for await(const chunk of req){size+=chunk.length;if(size>2*1024*1024)throw new Problem('tooLarge',413);parts.push(chunk)}
      const p=JSON.parse(Buffer.concat(parts).toString()) as Record<string,unknown>
      if(!p||typeof p!=='object')throw new Problem('format')
      if(p.op==='reveal'||p.op==='openExport'){const file=exports.get(String(p.exportId));if(!file)throw new Problem('notFound',404);if(process.platform!=='darwin')throw new Problem('format');await new Promise<void>((done,reject)=>{const child=spawn('/usr/bin/open',p.op==='reveal'?['-R',file]:[file],{stdio:'ignore'});child.on('error',reject);child.on('exit',code=>code===0?done():reject(new Problem('format')))});reply(200,{ok:true});return}
      if(p.op==='export'){
        const w=store.work(store.state,String(p.id)),v=w.versions.find(v=>v.id===p.versionId)
        if(w.deleted||!v)throw new Problem('notFound',404)
        complete(v.data)
        const filename=`${v.data.title.replace(/[^\p{L}\p{N}_-]/gu,'_')||'work'}.${p.format==='html'?'html':'isle.json'}`
        const body=p.format==='html'?render(v.data,p.en===true):JSON.stringify({format:'creation-island',version:1,rendererVersion:1,data:v.data},null,2)
        const exportId=randomUUID(),folder=resolve(home,'exports',exportId)
        mkdirSync(folder,{recursive:true,mode:0o700});const file=resolve(folder,filename);writeFileSync(file,body,{mode:0o600});exports.set(exportId,file)
        reply(200,{filename,body,exportId});return
      }
      const {requestId,...payload}=p
      const result=store.command(String(requestId),payload)
      generator.cancelInactive();generator.kick();reply(200,result)
    }catch(e){reply(e instanceof Problem?e.status:e instanceof ZodError||e instanceof SyntaxError?400:500,{error:e instanceof Problem?e.code:e instanceof ZodError||e instanceof SyntaxError?'format':'storage'})}
  }
  ctx.effect(()=>ctx.webServer.register({kind:'exact',path:'/creation/api',handler}),'creation-island: works')
}
