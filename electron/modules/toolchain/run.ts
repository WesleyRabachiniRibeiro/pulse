import { spawn } from 'node:child_process'
import { toolEnv } from './environment'

function quote(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function runLine(line: string, env: NodeJS.ProcessEnv): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(process.env['ComSpec'] ?? 'cmd.exe', ['/d', '/s', '/c', `"${line}"`], {
      windowsHide: true,
      windowsVerbatimArguments: true,
      env,
    })
    child.on('error', () => resolve(false))
    child.on('close', (code) => resolve(code === 0))
  })
}

export async function runTool(exe: string, args: readonly string[]): Promise<boolean> {
  const env = await toolEnv()
  return runLine([exe, ...args].map(quote).join(' '), env)
}

export async function runCommandLine(line: string): Promise<boolean> {
  return runLine(line, await toolEnv())
}
