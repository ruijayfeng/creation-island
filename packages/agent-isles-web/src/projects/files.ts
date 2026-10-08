import { constants } from 'node:fs'
import { mkdir, open, readdir, realpath, rename, rm, readFile, writeFile, lstat } from 'node:fs/promises'
import { dirname, relative, resolve, sep, isAbsolute, basename } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'

export type Manifest = { files: Record<string, { hash: string; size: number; mode: number }>; excluded: string[] }
export const digest = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex')
export function inside(root: string, target: string) { const p = relative(root, target); return !isAbsolute(p) && p !== '..' && !p.startsWith(`..${sep}`) }
export function excluded(name: string) {
  return ['.git', 'node_modules', '.yarn', '.pnpm-store', '.next', '.cache', '.DS_Store', '.ssh', '.aws', '.dsh', 'coverage'].includes(name)
    || /^\.env(?:\.|$)/i.test(name) && !/\.example$/.test(name)
    || /(?:\.(?:pem|key|p12|pfx|log)|credentials(?:\.[^.]+)?|secrets?(?:\.[^.]+)?|\.npmrc|\.netrc)$/i.test(name)
}
export async function safePath(root: string, path: string) {
  if (isAbsolute(path) || path.includes('\0') || path.split(/[\\/]/).some(excluded)) throw new Error('path')
  const target = await realpath(resolve(root, path))
  const actualRoot=await realpath(root)
  if (!inside(actualRoot, target) || relative(actualRoot,target).split(sep).some(excluded)) throw new Error('path')
  return target
}
export async function atomic(file: string, value: unknown) {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 })
  const temp = `${file}.${randomUUID()}.tmp`
  try { const fd = await open(temp, 'wx', 0o600); try { await fd.writeFile(JSON.stringify(value)); await fd.sync() } finally { await fd.close() }; await rename(temp, file) }
  finally { await rm(temp, { force: true }) }
}
/** Exact portable source set; never follows links, and never touches the user's Git index. */
export async function scan(root: string, objects?: string): Promise<Manifest> {
  root = await realpath(root)
  const manifest: Manifest = { files: {}, excluded: [] }
  let total = 0
  let count = 0
  if (objects) await mkdir(objects, { recursive: true, mode: 0o700 })
  async function walk(folder: string) {
    for (const item of (await readdir(folder, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
      const file = resolve(folder, item.name), path = relative(root, file)
      if (++count > 50000) throw new Error('size')
      if (excluded(item.name) || item.isSymbolicLink() || !item.isDirectory() && !item.isFile()) { manifest.excluded.push(path); continue }
      if (item.isDirectory()) { if (!inside(root, await realpath(file))) throw new Error('path'); await walk(file); continue }
      const fd = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW)
      try {
        const before = await fd.stat()
        if (!before.isFile() || before.size > 64 * 1024 ** 2 || (total += before.size) > 1024 ** 3) throw new Error('size')
        if (!inside(root, await realpath(file))) throw new Error('path')
        const bytes = await fd.readFile(), after = await fd.stat()
        if (bytes.length !== before.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) throw new Error('changed')
        const hash = digest(bytes)
        manifest.files[path] = { hash, size: bytes.length, mode: before.mode & 0o777 }
        if (objects) { try { await writeFile(resolve(objects, hash), bytes, { flag: 'wx', mode: 0o600 }) } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e } }
      } finally { await fd.close() }
    }
  }
  await walk(root)
  return manifest
}
export function same(a: Manifest, b: Manifest) { return JSON.stringify(a) === JSON.stringify(b) }
export async function materialize(manifest: Manifest, objects: string, target: string) {
  for (const [path, entry] of Object.entries(manifest.files)) {
    const file = resolve(target, path)
    if (!inside(target, file) || !/^[a-f0-9]{64}$/.test(entry.hash)) throw new Error('path')
    const bytes = await readFile(resolve(objects, entry.hash))
    if (digest(bytes) !== entry.hash) throw new Error('corrupt')
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, bytes, { flag: 'wx', mode: entry.mode & 0o111 ? 0o755 : 0o644 })
  }
}
export function diff(before: Manifest, after: Manifest) {
  return [...new Set([...Object.keys(before.files), ...Object.keys(after.files)])].sort().flatMap(path => {
    const a = before.files[path], b = after.files[path]
    return a?.hash === b?.hash && a?.mode === b?.mode ? [] : [{ path, kind: !a ? 'added' : !b ? 'deleted' : 'modified', before: a?.hash, after: b?.hash }]
  })
}
export async function textObject(objects: string, hash?: string) {
  if (!hash) return ''
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('path')
  const bytes = await readFile(resolve(objects, hash))
  if (bytes.length > 512 * 1024 || bytes.includes(0)) return null
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { return null }
}
