export type Tool = 'vscode' | 'git' | 'npm' | 'python'

// Achar uma ferramenta não é o mesmo que rodar um processo qualquer: o PATH da
// sessão do Pulse é o de quando ele abriu, e um programa recém-instalado ainda
// não está nele. Quem responde por isso é esta porta, não o ProcessRunner.
export interface Toolchain {
  locate(tool: Tool): Promise<string | null>

  run(exe: string, args: readonly string[]): Promise<boolean>

  // Roda e devolve a saída já aparada, para consultas como `git config --get`.
  read(exe: string, args: readonly string[]): Promise<string>

  // Depois de instalar algo, o PATH lido antes ficou velho.
  forgetPath(): void
}
