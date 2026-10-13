import test from 'node:test'
import assert from 'node:assert/strict'
import {capturePreview} from '../packages/agent-isles-web/lib/types/client/projects/capture.js'
function browser({cropFailure=false,late=false}={}){
 const events=[],controller=new AbortController();let stop=0,resolveShare
 class Element {
  style={cssText:''};attrs=new Map();width=0;height=0
  setAttribute(k,v){this.attrs.set(k,v)}getAttribute(k){return this.attrs.get(k)??null}removeAttribute(k){this.attrs.delete(k)}
  append(){}remove(){events.push('remove-toolbar')}showPopover(){events.push('show')}hidePopover(){events.push('hide')}
  matches(){return true}getBoundingClientRect(){return{width:800,height:400,top:16,left:100,right:900,bottom:416}}
  getContext(){return{drawImage(){events.push('encode')}}}toDataURL(){return'data:image/png;base64,real-frame'}
 }
 const element=new Element();element.setAttribute('style','height:100%')
 const track={stop(){stop++},async cropTo(){events.push('crop');if(cropFailure)throw Error('wrong source')}}
 const stream={getVideoTracks:()=>[track],getTracks:()=>[track]}
 const video={videoWidth:800,videoHeight:400,play:async()=>{},pause(){},requestVideoFrameCallback(fn){queueMicrotask(fn)}}
 const win=new EventTarget();win.CropTarget={async fromElement(){events.push('target');return{}}}
 Object.assign(globalThis,{window:win,innerWidth:1280,innerHeight:720,document:{body:{append(){}},createElement:n=>n==='video'?video:new Element()}})
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getDisplayMedia(){events.push('share');return late?new Promise(r=>{resolveShare=r}):Promise.resolve(stream)}}}})
 return{element,events,controller,stops:()=>stop,resolve:()=>resolveShare(stream)}
}
const labels={hint:'Select this tab',cancel:'Cancel'}
test('capture lifts existing preview above clipped panels and requests permission synchronously',async()=>{
 const b=browser();const p=capturePreview(b.element,b.controller.signal,labels,async()=>b.events.push('proof'))
 assert.ok(b.events.includes('share'));assert.ok(!b.events.includes('target'));assert.equal(b.element.getAttribute('popover'),'manual')
 assert.equal(await p,'data:image/png;base64,real-frame');assert.ok(b.events.indexOf('crop')<b.events.indexOf('encode'));assert.equal(b.events.filter(e=>e==='proof').length,2)
 assert.equal(b.stops(),1);assert.equal(b.element.getAttribute('style'),'height:100%');assert.equal(b.element.getAttribute('popover'),null)
})
test('wrong capture surface never encodes a frame and closes tracks',async()=>{
 const b=browser({cropFailure:true});await assert.rejects(capturePreview(b.element,b.controller.signal,labels),/captureDenied/)
 assert.ok(!b.events.includes('encode'));assert.equal(b.stops(),1)
})
test('cancel restores layout immediately and stops a late permission result',async()=>{
 const b=browser({late:true});const p=capturePreview(b.element,b.controller.signal,labels);b.controller.abort()
 await assert.rejects(p,/captureCancelled/);assert.equal(b.element.getAttribute('style'),'height:100%');b.resolve();await new Promise(r=>setImmediate(r));assert.equal(b.stops(),1);assert.ok(!b.events.includes('encode'))
})
test('changed preview identity fails before drawing and cleans up',async()=>{
 const b=browser();await assert.rejects(capturePreview(b.element,b.controller.signal,labels,async()=>{throw Error('source-changed')}),/source-changed/);assert.ok(!b.events.includes('encode'));assert.equal(b.stops(),1)
})
