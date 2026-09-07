import { randomUUID } from 'node:crypto'
import { readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { powershellOut } from './tools'

export interface UserRunOutput {
  code: number
  text: string
}

const ELEVATION_SCRIPT = `
$id = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($id)
if ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { 'sim' } else { 'nao' }
`

let elevated: boolean | null = null

export async function isElevated(): Promise<boolean> {
  if (elevated === null) elevated = (await powershellOut(ELEVATION_SCRIPT)).includes('sim')
  return elevated
}

const UAC_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$path = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System'
$v = (Get-ItemProperty $path -Name EnableLUA).EnableLUA
if ($v -eq 0) { 'nao' } else { 'sim' }
`

let uac: boolean | null = null

/**
 * Sem UAC o Windows não divide o token, então todo processo da conta roda
 * elevado, inclusive o explorer. Nesse caso não existe para onde rebaixar.
 */
export async function uacEnabled(): Promise<boolean> {
  if (uac === null) uac = !(await powershellOut(UAC_SCRIPT)).includes('nao')
  return uac
}

const RUNNER = `
using System;
using System.Runtime.InteropServices;

public static class PulseUserRunner
{
  [DllImport("user32.dll")] private static extern IntPtr GetShellWindow();
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);
  [DllImport("kernel32.dll", SetLastError = true)] private static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
  [DllImport("advapi32.dll", SetLastError = true)] private static extern bool OpenProcessToken(IntPtr process, uint access, out IntPtr token);
  [DllImport("advapi32.dll", SetLastError = true)] private static extern bool DuplicateTokenEx(IntPtr token, uint access, IntPtr attributes, int level, int type, out IntPtr copy);
  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)] private static extern bool CreateProcessWithTokenW(IntPtr token, uint logon, string application, string commandLine, uint flags, IntPtr environment, string directory, ref StartupInfo startup, out ProcessInformation info);
  [DllImport("kernel32.dll", SetLastError = true)] private static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
  [DllImport("kernel32.dll", SetLastError = true)] private static extern bool GetExitCodeProcess(IntPtr handle, out uint code);
  [DllImport("kernel32.dll", SetLastError = true)] private static extern bool CloseHandle(IntPtr handle);

  [StructLayout(LayoutKind.Sequential)]
  private struct ProcessInformation { public IntPtr Process; public IntPtr Thread; public uint ProcessId; public uint ThreadId; }

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  private struct StartupInfo
  {
    public int Size;
    public string Reserved; public string Desktop; public string Title;
    public int X; public int Y; public int XSize; public int YSize;
    public int XCountChars; public int YCountChars; public int FillAttribute; public int Flags;
    public short ShowWindow; public short Reserved2Length;
    public IntPtr Reserved2; public IntPtr StdInput; public IntPtr StdOutput; public IntPtr StdError;
  }

  public static int Run(string commandLine, string directory, int timeoutMs)
  {
    IntPtr shell = GetShellWindow();
    if (shell == IntPtr.Zero) return -1001;

    uint pid;
    GetWindowThreadProcessId(shell, out pid);
    if (pid == 0) return -1002;

    IntPtr process = OpenProcess(0x0400, false, pid);
    if (process == IntPtr.Zero) return -1003;

    IntPtr token;
    if (!OpenProcessToken(process, 0x0002, out token)) { CloseHandle(process); return -1004; }

    IntPtr copy;
    if (!DuplicateTokenEx(token, 0x02000000, IntPtr.Zero, 2, 1, out copy))
    {
      CloseHandle(token); CloseHandle(process); return -1005;
    }

    StartupInfo startup = new StartupInfo();
    startup.Size = Marshal.SizeOf(typeof(StartupInfo));
    startup.Desktop = "winsta0" + ((char)92) + "default";

    ProcessInformation info;
    bool started = CreateProcessWithTokenW(copy, 0, null, commandLine, 0x08000000, IntPtr.Zero, directory, ref startup, out info);
    if (!started)
    {
      int reason = Marshal.GetLastWin32Error();
      CloseHandle(copy); CloseHandle(token); CloseHandle(process);
      return -2000 - reason;
    }

    uint waited = WaitForSingleObject(info.Process, (uint)timeoutMs);

    uint code;
    if (!GetExitCodeProcess(info.Process, out code)) code = 0xFFFFFFFF;

    CloseHandle(info.Process); CloseHandle(info.Thread);
    CloseHandle(copy); CloseHandle(token); CloseHandle(process);
    if (waited != 0) return -1007;
    return unchecked((int)code);
  }
}
`

/** Texto literal para o PowerShell: aspas simples, dobrando as internas. */
function literal(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

/**
 * Roda um comando com o token do usuário interativo, sem a elevação do Pulse.
 *
 * O winget se recusa a desinstalar pacote de escopo de usuário quando o
 * processo está elevado, e o Pulse está. A saída é pegar emprestado o token do
 * explorer.exe, que roda como a pessoa logada em integridade média, e criar o
 * processo com ele.
 */
export async function runAsInteractiveUser(
  commandLine: string,
  timeoutMs = 10 * 60_000,
): Promise<UserRunOutput> {
  if (!(await uacEnabled())) return { code: -1006, text: '' }

  const outputFile = join(tmpdir(), `pulse-${randomUUID()}.txt`)

  // O cmd cuida do redirecionamento, porque não há como ler a saída de um
  // processo criado por CreateProcessWithTokenW. O /s faz o cmd tirar só as
  // aspas das pontas e deixar as de dentro em paz.
  const inner = `cmd.exe /s /c "${commandLine} > "${outputFile}" 2>&1"`

  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
${RUNNER}
'@
[PulseUserRunner]::Run(${literal(inner)}, ${literal(tmpdir())}, ${timeoutMs})
`

  // O Add-Type às vezes imprime avisos antes do retorno, então vale a última
  // linha que seja só um número.
  const raw = await powershellOut(script, timeoutMs + 30_000)
  const numbers = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^-?\d+$/.test(line))
  const code = Number.parseInt(numbers[numbers.length - 1] ?? '', 10)

  const text = await readFile(outputFile, 'utf8').catch(() => '')
  await rm(outputFile, { force: true }).catch(() => {})

  return { code: Number.isNaN(code) ? -1 : code, text }
}

const CREATE_PROCESS_BASE = -2000
const CREATE_PROCESS_FLOOR = CREATE_PROCESS_BASE - 0xffff

/**
 * Traduz as falhas do próprio mecanismo, que não vêm do comando pedido.
 *
 * O código de saída do winget é um HRESULT como 0x8A150030, que vira um inteiro
 * bem negativo. Por isso a faixa da falha de criação é fechada nos dois lados:
 * sem isso todo erro do winget virava "o Windows recusou criar o processo".
 */
export function runnerFailure(code: number): string | null {
  if (code === -1007) {
    return 'o comando passou do tempo e não terminou'
  }
  if (code === -1006) {
    return 'o Controle de Conta de Usuário está desligado neste Windows, e sem ele todo processo da sua conta roda como administrador'
  }
  if (code === -1001 || code === -1002) {
    return 'não foi possível encontrar a sessão aberta do usuário no Windows'
  }
  if (code >= -1005 && code <= -1003) {
    return 'não foi possível usar as credenciais da sessão do usuário'
  }
  if (code <= CREATE_PROCESS_BASE && code >= CREATE_PROCESS_FLOOR) {
    return `o Windows recusou criar o processo sem elevação, erro ${CREATE_PROCESS_BASE - code}`
  }
  return null
}
