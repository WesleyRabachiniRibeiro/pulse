export interface SpawnResult {
  code: number
  text: string
}

export interface ProcessRunner {
  // Invocação genérica de um executável real (não script) por array de
  // argumentos, sem shell — para chamadas pontuais como `git config --get`,
  // `winget search` ou `shutdown /r`. Não interpola nada em string alguma.
  runOnce(exe: string, args: readonly string[], env?: NodeJS.ProcessEnv): Promise<SpawnResult>

  // O ambiente vem de fora porque quem sabe qual PATH a ferramenta precisa é o
  // Toolchain, e quem sabe subir processo é este adapter.
  run(exe: string, args: readonly string[], env?: NodeJS.ProcessEnv): Promise<boolean>

  runWinget(
    id: string,
    args: readonly string[],
    onLine: (line: string) => void,
    drive?: string,
  ): Promise<SpawnResult>

  killWinget(id?: string): void

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

}
