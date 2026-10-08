import { createServer, type Server } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { spawn, type ChildProcess } from 'node:child_process'
import { resolve, extname, dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { safePath } from './files.js'

export interface Preview { id: string; projectId: string; versionId?: string; state: 'starting'|'ready'|'failed'|'stopped'; url?: string; command: string; log: string; startedAt: number }
export interface Recipe { kind: 'static'|'node'; command: string; script?: string; directory: string }
const mime: Record<string,string> = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.wasm':'application/wasm', '.ico':'image/x-icon' }
export async function recipes(root: string): Promise<Recipe[]> {
  const result: Recipe[] = []
  for (const dir of ['', 'dist', 'build', 'out']) {
    try { if ((await stat(await safePath(root, `${dir ? dir+'/' : ''}index.html`))).isFile()) result.push({ kind: 'static', directory: dir, command: `HTTP ${dir || '.'}` }) } catch { /* unavailable */ }
  }
  try {
    const pkg = JSON.parse(await readFile(await safePath(root, 'package.json'), 'utf8'))
    for (const script of ['dev','start','preview']) if (typeof pkg.scripts?.[script] === 'string') result.push({ kind: 'node', script, directory:'', command: `npm run ${script} — ${pkg.scripts[script]}` })
  } catch { /* no supported scripts */ }
  return result
}
export class Previews {
  records = new Map<string, Preview>()
  private owned = new Map<string, { server?: Server; child?: ChildProcess }>()
  async stop(id: string) {
    const owned = this.owned.get(id), record = this.records.get(id)
    if (record) record.state = 'stopped'
    if (owned?.server) await new Promise<void>(done => { owned.server!.closeAllConnections(); owned.server!.close(() => done()) })
    if (owned?.child?.pid) {
      const pid = owned.child.pid
      try { process.kill(-pid, 'SIGTERM') } catch { /* already ended */ }
      await Promise.race([new Promise<void>(done => owned.child!.once('exit', () => done())), new Promise<void>(done => setTimeout(done, 1000))])
      try { process.kill(-pid, 'SIGKILL') } catch { /* only our process group */ }
    }
    this.owned.delete(id)
  }
  async close() { await Promise.all([...this.owned.keys()].map(id => this.stop(id))) }
  async start(projectId: string, root: string, recipe: Recipe, versionId?: string) {
    for (const old of this.records.values()) if (old.projectId === projectId) await this.stop(old.id)
    const record: Preview = { id: randomUUID(), projectId, versionId, state:'starting', command:recipe.command, log:'', startedAt: Date.now() }
    this.records.set(record.id, record)
    try {
    const portServer = createServer()
    await new Promise<void>((done, reject) => { portServer.once('error', reject); portServer.listen(0, '127.0.0.1', done) })
    const port = (portServer.address() as {port:number}).port
    await new Promise<void>(done => portServer.close(() => done()))
    const url = `http://localhost:${port}/`
    if (recipe.kind === 'static') {
      const base = await safePath(root, recipe.directory || '.')
      const server = createServer(async (req,res) => {
        try {
          if (!['GET','HEAD'].includes(req.method ?? '') || ![`localhost:${port}`,`127.0.0.1:${port}`].includes(req.headers.host??'')) { res.writeHead(403); res.end(); return }
          const pathname = decodeURIComponent(new URL(req.url ?? '/', url).pathname)
          let file = await safePath(base, pathname.replace(/^\//,'') || 'index.html')
          if ((await stat(file)).isDirectory()) file = await safePath(base, `${pathname.replace(/^\//,'')}/index.html`)
          const bytes = await readFile(file)
          res.writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream', 'cache-control':'no-store', 'x-content-type-options':'nosniff' }); res.end(req.method === 'HEAD' ? undefined : bytes)
        } catch { res.writeHead(404); res.end('Not found') }
      })
      this.owned.set(record.id, { server })
      await new Promise<void>((done,reject) => { server.once('error',reject); server.listen(port,'127.0.0.1',done) })
    } else {
      // No model credentials or application auth are inherited by a project server.
      const env: NodeJS.ProcessEnv = { PATH: `${dirname(process.execPath)}:${process.env.PATH??''}`, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, LANG: process.env.LANG, PORT:String(port), HOST:'127.0.0.1', BROWSER:'none' }
      const pkg = JSON.parse(await readFile(resolve(root,'package.json'),'utf8'))
      const vite = /\bvite\b/.test(pkg.scripts[recipe.script!])
      const args = ['run', recipe.script!, ...(vite ? ['--','--host','127.0.0.1','--port',String(port),'--strictPort'] : [])]
      const child = spawn('npm', args, { cwd: root, env, detached:true, stdio:['ignore','pipe','pipe'] })
      this.owned.set(record.id, { child })
      const log = (bytes: Buffer) => { record.log = (record.log + bytes.toString().replace(/(token|api[_-]?key|authorization)([=: ]+)\S+/gi, '$1$2[redacted]')).slice(-16000) }
      child.stdout.on('data',log); child.stderr.on('data',log)
      child.on('error', error => { record.state='failed'; record.log=error.message })
      child.on('exit', code => { if (record.state !== 'stopped') { record.state='failed'; record.log += `\nexit ${code}` } })
    }
    for (let i=0;i<80 && record.state==='starting';i++) {
      try { const response = await fetch(`http://127.0.0.1:${port}/`, { signal:AbortSignal.timeout(500), redirect:'manual' }); if (response.status >= 200 && response.status < 400) { record.state='ready'; record.url=url; break } } catch { /* starting */ }
      await new Promise(done => setTimeout(done,250))
    }
    if (record.state === 'starting') { await this.stop(record.id); record.state='failed'; record.log += '\nHTTP check timed out. The server must use PORT / HOST, or Vite.' }
    if(record.state==='failed') { const log=record.log; await this.stop(record.id); record.state='failed'; record.log=log }
    } catch(error) { await this.stop(record.id); record.state='failed'; record.log=(error as Error).message }
    return record
  }
}
