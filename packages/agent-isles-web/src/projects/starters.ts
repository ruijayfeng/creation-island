import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { digest, scan, type Manifest } from './files.js'

export interface Starter { id:string; version:string; title:[string,string]; description:[string,string]; suggestion:[string,string]; manifest:Manifest; manifestHash:string }
// tsc output is lib/types/projects; assets remain a separate, explicit packaging input.
const root = fileURLToPath(new URL('../../../assets/starters/', import.meta.url))
export async function starterList():Promise<Starter[]> {
  return JSON.parse(await readFile(resolve(root,'catalog.json'),'utf8'))
}
export async function starterSource(id: unknown, objects: string) {
  const item=(await starterList()).find(s=>s.id===id)
  if(!item) throw new Error('starter')
  const directory=resolve(root,item.id), actual=await scan(directory,objects)
  if(JSON.stringify(actual)!==JSON.stringify(item.manifest) || digest(JSON.stringify(actual))!==item.manifestHash) throw new Error('starter-corrupt')
  return {item,manifest:actual}
}
