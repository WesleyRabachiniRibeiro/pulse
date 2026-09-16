export type Tool = 'vscode' | 'git' | 'npm' | 'python'

export interface Toolchain {
  locate(tool: Tool): Promise<string | null>

  run(exe: string, args: readonly string[]): Promise<boolean>

  read(exe: string, args: readonly string[]): Promise<string>

  forgetPath(): void
}
