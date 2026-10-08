import { useEffect, useState } from 'react'
import type { ProjectNotes } from '../../projects/notes.js'
import { command } from './api.js'
import { translator, errorText } from './words.js'
export function NotesPanel({projectId,notes,memory,remember,en,busy,refresh,organize}:{projectId:string;notes:ProjectNotes;memory?:ProjectNotes;remember(value:ProjectNotes):void;en:boolean;busy:boolean;refresh():Promise<void>;organize():Promise<void>}) {
  const t=translator(en),[draft,setDraft]=useState(()=>structuredClone(memory??notes)),[saving,setSaving]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('')
  useEffect(()=>remember(draft),[draft])
  async function save(){setSaving(true);setError('');try{const next=await command<ProjectNotes>({op:'notes-save',projectId,revision:draft.revision,notes:draft});setDraft(next);setStatus(t('notesSaved'));await refresh()}catch(e){setError(errorText(e,en))}finally{setSaving(false)}}
  return <section aria-label={t('notes')}><p className="ci-muted">{t('notesHint')}</p>
    {draft.revision!==notes.revision&&<div role="alert"><p>{t('notesConflict')}</p><button onClick={()=>{setDraft(structuredClone(notes));setStatus('')}}>{t('reloadNotes')}</button><button onClick={()=>setDraft(d=>({...d,revision:notes.revision}))}>{t('mergeNotes')}</button></div>}
    <label>{t('brief')}<textarea value={draft.brief} maxLength={2000} onChange={e=>{setStatus('');setDraft({...draft,brief:e.target.value})}}/></label>
    <label>{t('decisions')}<textarea value={draft.decisions.join('\n')} onChange={e=>{setStatus('');setDraft({...draft,decisions:e.target.value.split('\n')})}}/></label>
    <h3>{t('todos')}</h3>{draft.todos.map((todo,i)=><div key={i} className="ci-todo"><input aria-label={todo.text||t('todos')} type="checkbox" checked={todo.done} onChange={e=>setDraft({...draft,todos:draft.todos.map((v,j)=>j===i?{...v,done:e.target.checked}:v)})}/><input aria-label={`${t('todos')} ${i+1}`} value={todo.text} maxLength={300} onChange={e=>setDraft({...draft,todos:draft.todos.map((v,j)=>j===i?{...v,text:e.target.value}:v)})}/><button aria-label={`${t('removeTodo')} ${i+1}`} onClick={()=>setDraft({...draft,todos:draft.todos.filter((_,j)=>j!==i)})}>×</button></div>)}
    <button disabled={draft.todos.length>=30} onClick={()=>setDraft({...draft,todos:[...draft.todos,{text:'',done:false}]})}>{t('addTodo')}</button>
    <label className="ci-check"><input type="checkbox" checked={draft.useAsContext} onChange={e=>setDraft({...draft,useAsContext:e.target.checked})}/>{t('notesContext')}</label>
    <div className="ci-actions"><button className="ci-primary" disabled={saving} onClick={()=>void save()}>{t('saveNotes')}</button><button disabled={saving} onClick={()=>{setDraft({...draft,brief:'',decisions:[],todos:[],useAsContext:false});setStatus('')}}>{t('clearNotes')}</button><button disabled={busy||saving} onClick={()=>{setError('');void organize().catch(e=>setError(errorText(e,en)))}}>{t('organize')}</button></div>
    {status&&<p role="status">{status}</p>}{error&&<p role="alert" className="ci-error">{error}</p>}
  </section>
}
