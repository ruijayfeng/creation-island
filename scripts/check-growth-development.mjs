// Local feature connection checks. Uses disposable projects in the supplied DSH_HOME.
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import {randomUUID} from 'node:crypto'
const home=resolve(process.env.DSH_HOME??'tmp/growth-development-home')
const origin=new URL(await readFile(resolve(home,'browser-url.txt'),'utf8')).origin
const headers={'x-creation-projects':'1','content-type':'application/json',origin}
async function get(route,params={}){const r=await fetch(`${origin}/creation/projects/${route}?${new URLSearchParams(params)}`,{headers});const b=await r.json();assert.equal(r.status,200,JSON.stringify(b));return b}
async function cmd(body,status=200){const r=await fetch(`${origin}/creation/projects/command`,{method:'POST',headers,body:JSON.stringify({requestId:randomUUID(),...body})});const b=await r.json();assert.equal(r.status,status,JSON.stringify(b));return b}
const results=[],starters=await get('starters');assert.equal(starters.length,4)
for(const s of starters){const p=await cmd({op:'starter-preview',starterId:s.id});assert.equal(p.state,'ready');const html=await fetch(p.url).then(r=>r.text());assert.match(html,/app.js/);assert.ok((await fetch(new URL('app.js',p.url))).ok);await cmd({op:'starter-stop',previewId:p.id});await assert.rejects(fetch(p.url))}
results.push('Four independent starter previews respond; owned servers stop')
const requestId=randomUUID(),body={op:'starter-copy',starterId:'reading-tool',title:'Development reading copy',requestId}
const p=await cmd(body),again=await cmd(body);assert.equal(p.id,again.id);assert.equal(await readFile(resolve(p.path,'app.js'),'utf8'),await readFile('packages/agent-isles-web/assets/starters/reading-tool/app.js','utf8'))
results.push('Starter copy creates exact real files and deduplicates the same request')
let state=await get('state',{project:p.id});assert.equal(state.notes.revision,0)
const notes={brief:'Reading tracker; keep {{literal}} as data',decisions:['No external service'],todos:[{text:'Add a rating',done:false}],useAsContext:true}
await cmd({op:'notes-save',projectId:p.id,revision:0,notes});await cmd({op:'notes-save',projectId:p.id,revision:0,notes},409)
state=await get('state',{project:p.id});assert.equal(state.notes.revision,1)
const version=await cmd({op:'save',projectId:p.id,title:'First readable version',revision:state.revision});assert.equal(version.notes.brief,notes.brief)
await cmd({op:'notes-save',projectId:p.id,revision:1,notes:{...notes,brief:'Changed today'}})
const restored=await cmd({op:'restore',projectId:p.id,versionId:version.id});const restoredState=await get('state',{project:restored.id});assert.equal(restoredState.notes.brief,notes.brief)
assert.equal((await get('state',{project:p.id})).notes.brief,'Changed today')
results.push('Notes revisions conflict safely; achievement freezes notes; restore keeps original project')
await cmd({op:'showcase-set',projectId:p.id,revision:0,slots:[version.id,null,null,null,null,null]})
await cmd({op:'showcase-set',projectId:p.id,revision:1,slots:[null,version.id,null,null,null,null]})
await cmd({op:'showcase-set',projectId:p.id,revision:2,slots:[version.id,version.id,null,null,null,null]},409)
assert.deepEqual((await get('state',{project:p.id})).slots,[null,version.id,null,null,null,null])
results.push('Whole-gallery revisions, reorder and duplicate-version protection')
const exported=await cmd({op:'export',projectId:p.id,versionId:version.id,kind:'source',includeNotes:true});assert.ok(exported.exportId)
const limits=await get('image-limits');assert.ok(limits.maxImageBytes>0)
await cmd({op:'media-save',projectId:p.id,source:'upload',data:Buffer.from('not an image').toString('base64')},409)
await cmd({op:'cover-set',projectId:p.id,versionId:version.id,captureId:'missing',revision:0,confirmed:true},409)
results.push('Source export with explicit notes; runtime image limits; reject invalid images and unowned covers')
await mkdir('artifacts/growth-development',{recursive:true});await writeFile('artifacts/growth-development/connections.json',JSON.stringify({date:new Date().toISOString(),projectId:p.id,restoredId:restored.id,results},null,2));console.log(results.join('\n'))
