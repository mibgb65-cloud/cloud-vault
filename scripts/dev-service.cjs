const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const [, , name, ...command] = process.argv

if (!name || command.length === 0) {
  console.error('Usage: node scripts/dev-service.cjs <name> <command...>')
  process.exit(1)
}

const root = path.resolve(__dirname, '..')
const log = fs.openSync(path.join(root, `${name}.log`), 'a')
const err = fs.openSync(path.join(root, `${name}.err.log`), 'a')

const child = spawn(command[0], command.slice(1), {
  cwd: root,
  env: {
    ...process.env,
    WRANGLER_REGISTRY_PATH: path.join(root, '.wrangler-config', 'registry'),
    WRANGLER_LOG_PATH: path.join(root, '.wrangler-config', 'logs')
  },
  stdio: ['pipe', log, err],
  windowsHide: true
})

child.on('exit', (code, signal) => {
  fs.writeSync(log, `[${new Date().toISOString()}] ${name} exited code=${code} signal=${signal}\n`)
  process.exit(code ?? 1)
})

process.on('SIGTERM', () => child.kill('SIGTERM'))
process.on('SIGINT', () => child.kill('SIGINT'))

setInterval(() => {
  if (!child.killed) {
    child.stdin.write('\n')
  }
}, 30_000)
