import { spawn } from 'node:child_process'

/** Runs the API and the Vite dev server together, without adding a dependency. */
const targets = [
  { name: 'api', args: ['run', 'dev:api'] },
  { name: 'web', args: ['run', 'dev:web'] },
]

const children = targets.map(({ name, args }) => {
  const child = spawn('npm', args, { stdio: ['ignore', 'pipe', 'pipe'] })
  const prefix = `${name.padEnd(3)} | `
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding('utf8')
    stream.on('data', (chunk) => {
      for (const line of chunk.replace(/\n$/, '').split('\n')) {
        process.stdout.write(prefix + line + '\n')
      }
    })
  }
  child.on('exit', (code) => {
    if (code) process.stdout.write(`${prefix}exited with ${code}\n`)
  })
  return child
})

const shutdown = () => {
  for (const child of children) child.kill('SIGTERM')
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
