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
/** Keep the original iframe alive, but lift it out of clipping/scrolling ancestors. */
function stageCapture(element:HTMLElement, cancel:()=>void, labels:{hint:string;cancel:string}) {
  if(typeof element.showPopover!=='function')throw new Error('captureUnsupported')
  const savedStyle=element.getAttribute('style'),savedPopover=element.getAttribute('popover')
  const bounds=element.getBoundingClientRect(),toolbar=document.createElement('div')
  const restore=()=>{
    toolbar.remove();if(element.matches(':popover-open'))element.hidePopover()
    if(savedStyle===null)element.removeAttribute('style');else element.setAttribute('style',savedStyle)
    if(savedPopover===null)element.removeAttribute('popover');else element.setAttribute('popover',savedPopover)
  }
  try {
    element.setAttribute('popover','manual')
    element.style.cssText=`position:fixed;inset:16px auto auto 50%;transform:translateX(-50%);margin:0;padding:0;border:0;border-radius:0;overflow:hidden;background:white;width:${Math.min(bounds.width,innerWidth-32)}px;height:${Math.min(bounds.height,innerHeight-120)}px;max-width:none;max-height:none;`
    element.showPopover()
    toolbar.setAttribute('popover','manual');toolbar.setAttribute('role','status')
    toolbar.style.cssText='position:fixed;inset:auto 16px 16px;margin:0 auto;padding:12px;max-width:800px;border:1px solid #acbfb2;border-radius:12px;background:#fffdf6;color:#24352f;font:14px/1.5 system-ui;display:flex;align-items:center;gap:12px;'
    const message=document.createElement('span');message.textContent=labels.hint
    const button=document.createElement('button');button.type='button';button.textContent=labels.cancel;button.onclick=cancel
    button.style.cssText='flex:none;padding:8px 12px;border:1px solid #acbfb2;border-radius:8px;background:white;color:#24352f;cursor:pointer'
    toolbar.append(message,button);document.body.append(toolbar);toolbar.showPopover()
    return restore
  }catch(e){restore();throw e}
}
/** Request sharing in the original click; encode only after successful tab-region cropping. */
export async function capturePreview(element:HTMLElement,signal:AbortSignal|undefined,labels:{hint:string;cancel:string},verify?:()=>Promise<void>):Promise<string> {
  const crop=(window as Window & {CropTarget?:CropApi}).CropTarget
  if(!crop?.fromElement||!navigator.mediaDevices?.getDisplayMedia)throw new Error('captureUnsupported')
  const controller=new AbortController(),abort=()=>controller.abort(),local=controller.signal
  signal?.throwIfAborted();signal?.addEventListener('abort',abort,{once:true})
  let stream:MediaStream|undefined,restore=()=>{},finished=false,frameTimer:ReturnType<typeof setTimeout>|undefined
  const video=document.createElement('video'),timeout=setTimeout(abort,60000)
  const cancelled=new Promise<never>((_,reject)=>local.addEventListener('abort',()=>reject(new Error('captureCancelled')),{once:true}))
  // Install a handler before any synchronous browser call can fail.
  void cancelled.catch(()=>{})
  const wait=<T>(promise:Promise<T>)=>Promise.race([promise,cancelled])
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();abort()}}
  window.addEventListener('keydown',escape,true)
  try {
    restore=stageCapture(element,abort,labels)
    // Do not await identity probes or CropTarget before this call: they can consume user activation.
    const shared=navigator.mediaDevices.getDisplayMedia({video:true,audio:false,preferCurrentTab:true} as DisplayMediaStreamOptions).then(value=>{if(finished||local.aborted){value.getTracks().forEach(t=>t.stop());throw new Error('captureCancelled')}return value})
    stream=await wait(shared)
    const track=stream.getVideoTracks()[0] as RegionTrack
    if(typeof track.cropTo!=='function')throw new Error('captureUnsupported')
    await wait(track.cropTo(await wait(crop.fromElement(element))))
    if(verify)await wait(verify())
    const rect=element.getBoundingClientRect()
    if(rect.top<0||rect.left<0||rect.right>innerWidth||rect.bottom>innerHeight)throw new Error('captureDenied')
    local.throwIfAborted()
    video.srcObject=stream;video.muted=true;await wait(video.play())
    await wait(new Promise<void>((done,reject)=>{
      frameTimer=setTimeout(()=>reject(new Error('captureDenied')),5000)
      if('requestVideoFrameCallback'in video)video.requestVideoFrameCallback(()=>{clearTimeout(frameTimer);done()})
      else reject(new Error('captureUnsupported'))
    }))
    if(!video.videoWidth||!video.videoHeight)throw new Error('captureDenied')
    const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight
    if(canvas.width>4096||canvas.height>4096||canvas.width*canvas.height>16000000)throw new Error('invalid-media')
    canvas.getContext('2d')!.drawImage(video,0,0)
    local.throwIfAborted()
    if(verify)await wait(verify())
    return canvas.toDataURL('image/png')
  } catch(e){if(local.aborted)throw new Error('captureCancelled');if(e instanceof Error && ['captureUnsupported','invalid-media','source-changed'].includes(e.message))throw e;throw new Error('captureDenied')}
  finally {finished=true;clearTimeout(timeout);clearTimeout(frameTimer);signal?.removeEventListener('abort',abort);window.removeEventListener('keydown',escape,true);stream?.getTracks().forEach(t=>t.stop());video.pause();video.srcObject=null;restore()}
}
export async function imageElement(url:string):Promise<HTMLImageElement>{const img=new Image();img.src=url;await img.decode();return img}
export async function pngUpload(file:File):Promise<string>{
  if(file.size>8*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('invalid-media')
  const url=URL.createObjectURL(file)
  try{const img=await imageElement(url);if(img.width>4096||img.height>4096||img.width*img.height>16000000)throw new Error('invalid-media');const c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.getContext('2d')!.drawImage(img,0,0);return c.toDataURL('image/png')}finally{URL.revokeObjectURL(url)}
}
export async function thumbnail(dataUrl:string){const img=await imageElement(dataUrl),c=document.createElement('canvas');c.width=640;c.height=360;const g=c.getContext('2d')!;g.fillStyle='#f7f6f2';g.fillRect(0,0,640,360);const scale=Math.min(640/img.width,360/img.height);g.drawImage(img,(640-img.width*scale)/2,(360-img.height*scale)/2,img.width*scale,img.height*scale);return c.toDataURL('image/png').split(',')[1]!}
