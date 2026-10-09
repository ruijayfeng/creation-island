import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,readFile,symlink,rm,truncate} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createServer} from 'node:http';
import {scan,same,materialize,diff,safePath} from '../packages/agent-isles-web/lib/types/projects/files.js';
import {Previews,recipes} from '../packages/agent-isles-web/lib/types/projects/preview.js';
test('snapshot, diff and restore preserve original files and exclude credentials/links',async()=>{
 const root=await mkdtemp(join(tmpdir(),'creation-files-'));try{
 const project=join(root,'project'),objects=join(root,'objects'),restored=join(root,'restored');await mkdir(project);await mkdir(restored);
 await writeFile(join(project,'index.html'),'<h1>one</h1>');await writeFile(join(project,'.env'),'secret');await mkdir(join(project,'.git'));await writeFile(join(project,'.git','index'),'untouched');await symlink(root,join(project,'outside'));await symlink(join(project,'.env'),join(project,'alias'));
 const before=await scan(project,objects);assert.deepEqual(Object.keys(before.files),['index.html']);assert.deepEqual(before.excluded.sort(),['.env','.git','alias','outside'].sort());await assert.rejects(safePath(project,'outside/objects'));await assert.rejects(safePath(project,'.env'));await assert.rejects(safePath(project,'alias'));
 await writeFile(join(project,'index.html'),'<h1>two</h1>');await writeFile(join(project,'new.txt'),'new');const after=await scan(project,objects);assert.equal(same(before,after),false);assert.deepEqual(diff(before,after).map(c=>c.kind),['modified','added']);
 await materialize(before,objects,restored);assert.equal(await readFile(join(restored,'index.html'),'utf8'),'<h1>one</h1>');assert.equal(await readFile(join(project,'index.html'),'utf8'),'<h1>two</h1>');assert.equal(await readFile(join(project,'.git','index'),'utf8'),'untouched');await assert.rejects(materialize(before,objects,restored));
 }finally{await rm(root,{recursive:true,force:true})}
});
test('preview readiness belongs to its owned HTTP service and stops cleanly',async()=>{
 const root=await mkdtemp(join(tmpdir(),'creation-preview-')),p=new Previews();try{
 await writeFile(join(root,'index.html'),'<title>owned-preview</title>');await writeFile(join(root,'.env'),'secret');const recipe=(await recipes(root))[0];const result=await p.start('project',root,recipe,'version');assert.equal(result.state,'ready');assert.equal(result.versionId,'version');assert.match(await fetch(result.url).then(r=>r.text()),/owned-preview/);assert.equal((await fetch(new URL('.env',result.url))).status,404);const url=result.url;await p.stop(result.id);assert.equal(result.state,'stopped');await assert.rejects(fetch(url));
 }finally{await p.close();await rm(root,{recursive:true,force:true})}
});

test('oversized files fail without producing a truncated manifest',async()=>{const root=await mkdtemp(join(tmpdir(),'creation-limit-'));try{const file=join(root,'large.bin');await writeFile(file,'');await truncate(file,65*1024*1024);await assert.rejects(scan(root),/size/)}finally{await rm(root,{recursive:true,force:true})}});
test('Node previews check actual HTTP and stop their owned process; failed start stays failed',async()=>{const root=await mkdtemp(join(tmpdir(),'creation-node-')),p=new Previews();try{await writeFile(join(root,'package.json'),JSON.stringify({scripts:{dev:'node server.cjs',start:'node missing.cjs'}}));await writeFile(join(root,'server.cjs'),"require('http').createServer((q,r)=>r.end('node preview')).listen(Number(process.env.PORT),process.env.HOST)");const rs=await recipes(root),r=await p.start('node',root,rs.find(r=>r.script==='dev'));assert.equal(r.state,'ready');assert.match(await fetch(r.url).then(r=>r.text()),/node preview/);await p.stop(r.id);await assert.rejects(fetch(r.url));const failed=await p.start('bad',root,rs.find(r=>r.script==='start'));assert.equal(failed.state,'failed');assert.equal(failed.url,undefined)}finally{await p.close();await rm(root,{recursive:true,force:true})}});

test('preview origins survive service recreation, isolate saved versions and fail on occupied addresses',async()=>{
 const root=await mkdtemp(join(tmpdir(),'creation-origins-')),store=join(root,'origins.json');let p=new Previews(store);const blocker=createServer((q,r)=>r.end('unowned'));
 try{
  await writeFile(join(root,'index.html'),'<h1>stable origin</h1>');const recipe=(await recipes(root))[0];
  const current=await p.start('project',root,recipe);assert.equal(current.state,'ready');await p.close();
  p=new Previews(store);const restarted=await p.start('project',root,recipe);assert.equal(restarted.url,current.url);await p.close();
  const historical=await p.start('project',root,recipe,'saved-version');assert.equal(historical.state,'ready');assert.notEqual(historical.url,current.url);await p.close();
  const another=await p.start('another-project',root,recipe);assert.notEqual(another.url,current.url);assert.notEqual(another.url,historical.url);await p.close();
  await new Promise((done,reject)=>{blocker.once('error',reject);blocker.listen(Number(new URL(current.url).port),'127.0.0.1',done)});
  const failed=await p.start('project',root,recipe);assert.equal(failed.state,'failed');assert.equal(failed.url,undefined);assert.equal(failed.log,'preview-origin-busy');assert.equal(await fetch(current.url).then(r=>r.text()),'unowned');
  await new Promise(done=>blocker.close(done));const retry=await p.start('project',root,recipe);assert.equal(retry.url,current.url);assert.match(await fetch(retry.url).then(r=>r.text()),/stable origin/);
 }finally{await p.close();if(blocker.listening)await new Promise(done=>blocker.close(done));await rm(root,{recursive:true,force:true})}
});
