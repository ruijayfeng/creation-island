// 桌面发行：把 Web 插件、世界资源与 node_modules 打进安装根目录（Win/Mac 共用）。
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

export const root = fileURLToPath(new URL('../../', import.meta.url))

export function requireBuiltArtifacts() {
  for (const file of ['packages/agent-isles-web/lib/client.js', 'games/mosslight/build/web/index.pck']) {
    if (!existsSync(path.join(root, file))) throw new Error(`缺少 ${file}，请先构建 Web 和世界`)
  }
}

/** @returns {{ excludedFiles: number }} */
export function materializeAppTree(app) {
  mkdirSync(app, { recursive: true })
  let excludedFiles = 0
  function copy(source, destination) {
    cpSync(path.join(root, source), path.join(app, destination ?? source), {
      recursive: true,
      dereference: true,
      filter: file => {
        // Keep executable sources, package metadata and all licenses. Only omit
        // type declarations and JS debugging maps, never entire source folders.
        if (/\.(?:[cm]?js\.map|d\.[cm]?ts(?:\.map)?)$/i.test(file)) {
          excludedFiles++
          return false
        }
        return true
      },
    })
  }
  // Preserve the installed dynamic plugin dependency tree. Workspace junctions are materialized separately.
  for (const item of readdirSync(path.join(root, 'node_modules'), { withFileTypes: true })) {
    if (item.name === '.bin' || item.name === '@agent-isles' || item.name === '.yarn-state.yml') continue
    copy(`node_modules/${item.name}`)
  }
  for (const file of ['package.json', 'cordis.patch.yml', 'lib']) {
    copy(`packages/agent-isles-web/${file}`, `node_modules/@agent-isles/web-plugin/${file}`)
  }
  copy('packages/agent-isles-web/cordis.patch.yml')
  copy('apps/web/src/launch.mjs')
  copy('apps/web/src/supervise.mjs')
  copy('apps/desktop/boot.mjs')
  copy('LICENSE')
  copy('THIRD_PARTY_NOTICES.md')
  copy('THIRD_PARTY_NOTICES.en.md')
  copy('docs/user-guide.md')
  copy('docs/user-guide.en.md')
  copy('docs/godot-licenses.txt')
  copy('games/mosslight/assets/fonts/NOTICE.md', 'licenses/font-NOTICE.md')
  copy('games/mosslight/assets/fonts/OFL.txt', 'licenses/font-OFL.txt')
  copy('games/mosslight/assets/xi4u-LICENSE.txt', 'licenses/world-MIT.txt')
  copy('games/mosslight/build/web')
  const web = JSON.parse(readFileSync(path.join(root, 'apps/web/package.json'), 'utf8'))
  writeFileSync(
    path.join(app, 'package.json'),
    JSON.stringify({ name: 'agent-isles-installed', private: true, type: 'module', dependencies: web.dependencies }, null, 2),
  )
  return { excludedFiles }
}

export async function embedNodeRuntime(app, { binaryName }) {
  const version = process.version
  const archiveName = `node-${version}-darwin-${process.arch}.tar.gz`
  const cache = path.join(root, 'dist', 'node-runtime')
  mkdirSync(cache, { recursive: true })
  const archive = path.join(cache, archiveName)
  const checksums = path.join(cache, `${version}-SHASUMS256.txt`)
  for (const [url, target] of [
    [`https://nodejs.org/dist/${version}/SHASUMS256.txt`, checksums],
    [`https://nodejs.org/dist/${version}/${archiveName}`, archive],
  ]) {
    if (!existsSync(target)) {
      const result = spawnSync('curl', ['--fail', '--location', '--retry', '2', '--max-time', '120', url, '-o', target], { stdio: 'inherit' })
      if (result.status !== 0) throw new Error('Official Node runtime download failed')
    }
  }
  const expected = readFileSync(checksums, 'utf8').split('\n').find(line => line.endsWith(`  ${archiveName}`))?.split(' ')[0]
  const actual = createHash('sha256').update(readFileSync(archive)).digest('hex')
  if (!expected || actual !== expected) throw new Error('Node checksum mismatch')
  if (spawnSync('tar', ['-xzf', archive, '-C', cache]).status !== 0) throw new Error('Node extraction failed')
  const extracted = path.join(cache, archiveName.replace(/\.tar\.gz$/, ''))
  mkdirSync(path.join(app, 'runtime'), { recursive: true })
  cpSync(path.join(extracted, 'bin/node'), path.join(app, 'runtime', binaryName))
  cpSync(path.join(extracted, 'LICENSE'), path.join(app, 'runtime/LICENSE'))
  writeFileSync(path.join(app, 'runtime/SOURCE.json'), JSON.stringify({ version, arch: process.arch, url: `https://nodejs.org/dist/${version}/${archiveName}`, sha256: actual }, null, 2))
}
