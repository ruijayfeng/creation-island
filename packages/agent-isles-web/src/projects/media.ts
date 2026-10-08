import type { AttachmentStore } from '@deepseek-ai/dsh-attachment'
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { digest } from './files.js'
import type { Capture, GrowthMetadata } from './metadata.js'

/** Private presentation media; never a source file or a runtime-owned attachment. */
export class ProjectMedia {
  private lastCollection=0
  constructor(readonly root:string,private attachments:AttachmentStore){}
  async read(captures:Record<string,Capture>,hash:string){
    if(!/^[a-f0-9]{64}$/.test(hash)||!Object.values(captures).some(c=>c.hash===hash||c.thumbnailHash===hash))throw new Error('media')
    const bytes=await readFile(resolve(this.root,hash));if(digest(bytes)!==hash)throw new Error('corrupt');return bytes
  }
  private async decode(value:unknown,thumbnail=false){
    if(typeof value!=='string'||value.length>12*1024*1024)throw new Error('invalid-media')
    const bytes=Buffer.from(value,'base64')
    if(bytes.toString('base64')!==value||bytes.length>(thumbnail?256*1024:8*1024*1024))throw new Error('invalid-media')
    await this.attachments.validateImage({data:bytes,mediaType:'image/png'})
    if(bytes.length<24||bytes.readUInt32BE(0)!==0x89504e47)throw new Error('invalid-media')
    const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20)
    if(!width||!height||width>4096||height>4096||width*height>16000000||(thumbnail&&(width!==640||height!==360)))throw new Error('invalid-media')
    return{bytes,width,height,hash:digest(bytes)}
  }
  async save(projectId:string,input:Record<string,any>,parent?:Capture):Promise<Capture>{
    if(!['preview','upload'].includes(input.source))throw new Error('invalid-media')
    const image=await this.decode(input.data),thumb=input.thumbnail?await this.decode(input.thumbnail,true):undefined
    if(input.capturedAt!==undefined&&(typeof input.capturedAt!=='number'||!Number.isFinite(input.capturedAt)||input.capturedAt<0||input.capturedAt>Date.now()+1000))throw new Error('invalid-media')
    await mkdir(this.root,{recursive:true,mode:0o700})
    for(const item of [image,thumb])if(item)await writeFile(resolve(this.root,item.hash),item.bytes,{mode:0o600})
    return{id:input.requestId,projectId,sessionId:input.sessionId,versionId:input.versionId,previewId:input.previewId,source:input.source,hash:image.hash,thumbnailHash:thumb?.hash,width:image.width,height:image.height,createdAt:Date.now(),capturedAt:input.capturedAt,derivedFrom:parent?.id}
  }
  async collect(projects:GrowthMetadata[]){
    if(Date.now()-this.lastCollection<60000)return
    this.lastCollection=Date.now();const cutoff=Date.now()-7*86400000,hashes=new Set<string>()
    for(const r of projects){
      const used=new Set([...Object.values(r.covers).map(c=>c.captureId),...Object.values(r.feedback).flatMap(d=>[d.captureId,d.delivery?.imageCaptureId].filter(Boolean))])
      for(const [id,c] of Object.entries(r.captures)){
        if(!used.has(id)&&c.createdAt<cutoff)delete r.captures[id]
        else {hashes.add(c.hash);if(c.thumbnailHash)hashes.add(c.thumbnailHash)}
      }
    }
    try{for(const name of await readdir(this.root))if(/^[a-f0-9]{64}$/.test(name)&&!hashes.has(name)&&(await stat(resolve(this.root,name))).mtimeMs<cutoff)await rm(resolve(this.root,name))}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}
  }
}
