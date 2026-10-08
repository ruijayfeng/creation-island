export async function api<T = any>(route='state', project?:string, params:Record<string,string>={}) :Promise<T> {
  const query=new URLSearchParams({...params,...project?{project}:{}})
  const response=await fetch(`/creation/projects/${route}?${query}`,{headers:{'x-creation-projects':'1'},signal:AbortSignal.timeout(30000)})
  const result=await response.json();if(!response.ok) throw new Error(result.error);return result
}
export async function command<T = any>(body:Record<string,unknown>):Promise<T> {
  const response=await fetch('/creation/projects/command',{method:'POST',headers:{'x-creation-projects':'1','content-type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),...body})})
  const result=await response.json();if(!response.ok) throw new Error(result.error);return result
}
export async function mediaUrl(projectId:string,hash:string) {
  const response=await fetch(`/creation/projects/media?${new URLSearchParams({project:projectId,hash})}`,{headers:{'x-creation-projects':'1'}})
  if(!response.ok)throw new Error('media')
  const blob=await response.blob()
  return new Promise<string>((done,reject)=>{const reader=new FileReader();reader.onload=()=>done(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob)})
}
export async function download(exportId:string,name:string) {
  const response=await fetch(`/creation/projects/download?${new URLSearchParams({export:exportId,name})}`,{headers:{'x-creation-projects':'1'}})
  if(!response.ok) throw new Error('export')
  const url=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000)
}
