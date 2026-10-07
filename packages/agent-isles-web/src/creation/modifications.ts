import { z } from 'zod'
import { complete,question,section,storyNode,type Content } from './content.js'
export function modify(base:Content, operations:unknown, target='all'):Content {
  const ops=z.array(z.object({op:z.string(),id:z.string().optional(),value:z.unknown().optional()}).strict()).min(1).max(32).parse(operations)
  const next=structuredClone(base)
  for(const o of ops){
    if(target!=='all' && (o.id!==target||!['replaceQuestion','replaceCardSection','replaceStoryNode'].includes(o.op)))throw new Error('Modification exceeds selected scope')
    const replace=<T extends {id:string}>(items:T[],value:T)=>{const i=items.findIndex(x=>x.id===o.id);if(i<0||value.id!==o.id)throw new Error('Unknown or changed ID');items[i]=value}
    const insert=<T extends {id:string}>(items:T[],value:T)=>{if(items.some(x=>x.id===value.id))throw new Error('Duplicate ID');items.push(value)}
    const remove=<T extends {id:string}>(items:T[])=>{const i=items.findIndex(x=>x.id===o.id);if(i<0)throw new Error('Unknown ID');items.splice(i,1)}
    const reorder=<T extends {id:string}>(items:T[])=>{const ids=z.array(z.string()).parse(o.value);if(ids.length!==items.length||new Set(ids).size!==ids.length||ids.some(id=>!items.some(x=>x.id===id)))throw new Error('Invalid order');return ids.map(id=>items.find(x=>x.id===id)!)}
    if(o.op==='setTitle')next.title=z.string().max(80).parse(o.value)
    else if(o.op==='setTheme')next.theme=z.enum(['fresh','celebration','night']).parse(o.value)
    else if(o.op==='updateIntro'&&next.kind!=='card')next.content.intro=z.string().max(1000).parse(o.value)
    else if(o.op==='updateEnding'&&next.kind==='quiz')next.content.ending=z.string().max(1000).parse(o.value)
    else if(o.op==='replaceQuestion'&&next.kind==='quiz')replace(next.content.questions,question.parse(o.value))
    else if(o.op==='insertQuestion'&&next.kind==='quiz')insert(next.content.questions,question.parse(o.value))
    else if(o.op==='removeQuestion'&&next.kind==='quiz')remove(next.content.questions)
    else if(o.op==='reorderQuestions'&&next.kind==='quiz')next.content.questions=reorder(next.content.questions)
    else if(o.op==='replaceCardSection'&&next.kind==='card')replace(next.content.sections,section.parse(o.value))
    else if(o.op==='insertCardSection'&&next.kind==='card')insert(next.content.sections,section.parse(o.value))
    else if(o.op==='removeCardSection'&&next.kind==='card')remove(next.content.sections)
    else if(o.op==='reorderCardSections'&&next.kind==='card')next.content.sections=reorder(next.content.sections)
    else if(o.op==='updateCardMeta'&&next.kind==='card'){const m=z.object({recipient:z.string().max(80),signature:z.string().max(80),closing:z.string().max(1000)}).strict().parse(o.value);Object.assign(next.content,m)}
    else if(o.op==='replaceStoryNode'&&next.kind==='story')replace(next.content.nodes,storyNode.parse(o.value))
    else if(o.op==='addStoryNode'&&next.kind==='story')insert(next.content.nodes,storyNode.parse(o.value))
    else if(o.op==='removeStoryNode'&&next.kind==='story')remove(next.content.nodes)
    else if(o.op==='setStoryStart'&&next.kind==='story')next.content.startNodeId=z.string().parse(o.value)
    else throw new Error('Unsupported operation')
  }
  return complete(next)
}
export function changes(a:Content,b:Content):string[] {
  const result:string[]=[]
  if(a.title!==b.title)result.push('title')
  if(a.theme!==b.theme)result.push('theme')
  if(a.kind!==b.kind)return ['kind']
  const walk=(x:unknown,y:unknown,path:string)=>{if(JSON.stringify(x)===JSON.stringify(y))return;if(x&&y&&typeof x==='object'&&typeof y==='object'&&!Array.isArray(x)&&!Array.isArray(y)){for(const key of new Set([...Object.keys(x),...Object.keys(y)]))walk((x as Record<string,unknown>)[key],(y as Record<string,unknown>)[key],`${path}.${key}`)}else result.push(path)}
  walk(a.content,b.content,'content');return result
}
