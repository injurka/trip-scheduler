import { dirname, relative, resolve } from 'node:path'

const root = resolve(import.meta.dir, '..')
const result = Bun.spawnSync(['bunx', 'tsc', '--emitDeclarationOnly', '--incremental', 'false', '--composite', 'false'], { cwd: root, stdout: 'inherit', stderr: 'inherit' })
if (result.exitCode !== 0)
  process.exit(result.exitCode)

// Declarations are consumed by the browser project, where ~ points at client
// sources. Keep the server's aliases relative to the emitted declaration file.
for await (const name of new Bun.Glob('**/*.d.ts').scan(resolve(root, '.types'))) {
  const path = resolve(root, '.types', name)
  const file = Bun.file(path)
  const source = await file.text()
  const rewritten = source.replace(/(['"])(~\/|db\/)([^'"]+)\1/g, (_match, quote: string, prefix: string, suffix: string) => {
    const target = resolve(root, '.types', prefix === '~/' ? 'src' : 'db', suffix)
    const path = relative(dirname(file.name!), target).replaceAll('\\', '/')
    return `${quote}${path.startsWith('.') ? path : `./${path}`}${quote}`
  })
  if (rewritten !== source)
    await Bun.write(file, rewritten)
}
