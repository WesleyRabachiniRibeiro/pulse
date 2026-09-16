export interface SpawnResult {
  code: number
  text: string
}

export interface ProcessRunner {
  runOnce(exe: string, args: readonly string[], env?: NodeJS.ProcessEnv): Promise<SpawnResult>

  run(exe: string, args: readonly string[], env?: NodeJS.ProcessEnv): Promise<boolean>

  runWinget(
    id: string,
    args: readonly string[],
    onLine: (line: string) => void,
    drive?: string,
  ): Promise<SpawnResult>

  killWinget(id?: string): void

  launchDetached(exe: string, args: readonly string[]): Promise<void>

  runCommandLine(line: string): Promise<boolean>

  openUri(uri: string): Promise<boolean>

  runElevated(exe: string, args: readonly string[], timeoutMs?: number): Promise<SpawnResult>

  runAsInteractiveUser(
    exe: string,
    args: readonly string[],
    timeoutMs?: number,
  ): Promise<SpawnResult>

  isElevated(): Promise<boolean>
}
