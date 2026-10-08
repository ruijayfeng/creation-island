interface RegionTrack extends MediaStreamTrack { cropTo(target:unknown):Promise<void> }
interface CropApi { fromElement(element:Element):Promise<unknown> }
/** The static server supplies only an identity responder, never a privileged bridge. */
export async function confirmStaticPreview(frame:HTMLIFrameElement,preview:{id:string;url?:string;kind?:string}){
  if(preview.kind!=='static'||!preview.url||!frame.contentWindow)throw new Error('coverUnsupported')
  const target=frame.contentWindow,origin=new URL(preview.url).origin,challenge=crypto.randomUUID()
  await new Promise<void>((done,reject)=>{
    const clear=()=>{clearTimeout(timer);window.removeEventListener('message',receive)}
    const receive=(e:MessageEvent)=>{if(e.source===target&&e.origin===origin&&e.data?.source==='ci-preview-proof'&&e.data.previewId===preview.id&&e.data.challenge===challenge){clear();done()}}
    const timer=setTimeout(()=>{clear();reject(new Error('source-changed'))},2000)
    window.addEventListener('message',receive);target.postMessage({source:'ci-preview-probe',challenge},origin)
  })
}
/** Capture only after the browser has cropped this tab. Never sample a full-display frame. */
export async function capturePreview(element:HTMLElement,signal?:AbortSignal):Promise<string> {
  const crop=(window as Window & {CropTarget?:CropApi}).CropTarget
  if(!crop?.fromElement||!navigator.mediaDevices?.getDisplayMedia)throw new Error('captureUnsupported')
  let stream:MediaStream|undefined
  let abort:()=>void=()=>{}
  const video=document.createElement('video')
  try {
    const target=await crop.fromElement(element)
    signal?.throwIfAborted()
    const cancelled=new Promise<never>((_,reject)=>{abort=()=>reject(new Error('captureCancelled'));signal?.addEventListener('abort',abort,{once:true})})
    const shared=navigator.mediaDevices.getDisplayMedia({video:true,audio:false,preferCurrentTab:true} as DisplayMediaStreamOptions).then(value=>{if(signal?.aborted){value.getTracks().forEach(t=>t.stop());throw new Error('captureCancelled')}return value})
    stream=await Promise.race([shared,cancelled])
    const track=stream.getVideoTracks()[0] as RegionTrack
    if(typeof track.cropTo!=='function')throw new Error('captureUnsupported')
    await track.cropTo(target) // Rejects capture of another tab/window/screen.
    signal?.throwIfAborted()
    video.srcObject=stream;video.muted=true;await video.play()
    await new Promise<void>((done,reject)=>{
      const timer=setTimeout(()=>reject(new Error('captureDenied')),5000)
      if('requestVideoFrameCallback'in video)video.requestVideoFrameCallback(()=>{clearTimeout(timer);done()})
      else {clearTimeout(timer);reject(new Error('captureUnsupported'))}
    })
    if(!video.videoWidth||!video.videoHeight)throw new Error('captureDenied')
    const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight
    if(canvas.width>4096||canvas.height>4096||canvas.width*canvas.height>16000000)throw new Error('invalid-media')
    canvas.getContext('2d')!.drawImage(video,0,0)
    signal?.throwIfAborted()
    return canvas.toDataURL('image/png')
  } catch(e){if(signal?.aborted)throw new Error('captureCancelled');if(e instanceof Error && ['captureUnsupported','invalid-media'].includes(e.message))throw e;throw new Error('captureDenied')}
  finally {signal?.removeEventListener('abort',abort);stream?.getTracks().forEach(t=>t.stop());video.pause();video.srcObject=null}
}
export async function imageElement(url:string):Promise<HTMLImageElement>{const img=new Image();img.src=url;await img.decode();return img}
export async function pngUpload(file:File):Promise<string>{
  if(file.size>8*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('invalid-media')
  const url=URL.createObjectURL(file)
  try{const img=await imageElement(url);if(img.width>4096||img.height>4096||img.width*img.height>16000000)throw new Error('invalid-media');const c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.getContext('2d')!.drawImage(img,0,0);return c.toDataURL('image/png')}finally{URL.revokeObjectURL(url)}
}
export async function thumbnail(dataUrl:string){const img=await imageElement(dataUrl),c=document.createElement('canvas');c.width=640;c.height=360;const g=c.getContext('2d')!;g.fillStyle='#f7f6f2';g.fillRect(0,0,640,360);const scale=Math.min(640/img.width,360/img.height);g.drawImage(img,(640-img.width*scale)/2,(360-img.height*scale)/2,img.width*scale,img.height*scale);return c.toDataURL('image/png').split(',')[1]!}
