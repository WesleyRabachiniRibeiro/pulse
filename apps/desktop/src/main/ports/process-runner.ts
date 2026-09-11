export interface SpawnResult {
  code: number
  text: string
}

export interface ProcessRunner {
  // Invocação genérica de um executável real (não script) por array de
  // argumentos, sem shell — para chamadas pontuais como `git config --get`,
  // `winget search` ou `shutdown /r`. Não interpola nada em string alguma.
  runOnce(exe: string, args: readonly string[]): Promise<SpawnResult>

  runWinget(
    id: string,
    args: readonly string[],
    onLine: (line: string) => void,
    drive?: string,
  ): Promise<SpawnResult>

  killWinget(id?: string): void

  run(exe: string, args: readonly string[]): Promise<boolean>

  // Sobe o processo destacado e retorna sem esperar ele terminar — usado para
  // abrir um navegador de verdade (não uma URI), diferente de run()/runOnce().
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

  locateVsCode(): Promise<string | null>

  locateGit(): Promise<string | null>

  forgetPathCache(): void
}
