import type { ProjectNotes } from './notes.js'
export interface Annotation { x:number; y:number; w:number; h:number; text:string }
export interface Capture {
  id:string; projectId:string; sessionId?:string; versionId?:string; previewId?:string
  source:'preview'|'upload'; hash:string; thumbnailHash?:string; width:number; height:number; createdAt:number; capturedAt?:number; derivedFrom?:string
}
export interface FeedbackDraft {
  revision:number; sessionId:string; captureId:string; annotations:Annotation[]; text:string
  requestId?:string; submission?:'pending'|'accepted'; route?:string
  delivery?:{text:string;imageCaptureId?:string}
}
export interface Cover { captureId:string; manifestHash:string; revision:number }
export interface GrowthMetadata {
  notes:ProjectNotes
  showcaseRevision:number
  captures:Record<string,Capture>
  feedback:Record<string,FeedbackDraft>
  covers:Record<string,Cover>
  starter?:{id:string;version:string;manifestHash:string}
}
export function validateAnnotations(value:unknown):Annotation[] {
  if(!Array.isArray(value)||value.length>12)throw new Error('feedback-invalid')
  return value.map(a=>{
    if(!a || [a.x,a.y,a.w,a.h].some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>1)
      || a.x+a.w>1.001||a.y+a.h>1.001||typeof a.text!=='string'||a.text.length>1000)throw new Error('feedback-invalid')
    return {x:a.x,y:a.y,w:a.w,h:a.h,text:a.text}
  })
}
