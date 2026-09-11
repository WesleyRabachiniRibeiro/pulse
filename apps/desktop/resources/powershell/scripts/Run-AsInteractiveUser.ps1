param([string]$ParamsJson)

$ErrorActionPreference = 'Stop'
$p = $ParamsJson | ConvertFrom-Json

$exe = [string]$p.exe
$targetArgs = @($p.args)
$timeoutMs = [int]$p.timeoutMs

function ConvertTo-Win32CommandLine {
  param([string[]]$Parts)

  $quoted = foreach ($part in $Parts) {
    if ($part -eq '') {
      '""'
    } elseif ($part -notmatch '[\s"]') {
      $part
    } else {
      $sb = New-Object System.Text.StringBuilder
      [void]$sb.Append('"')
      $chars = $part.ToCharArray()
      $i = 0
      while ($i -lt $chars.Length) {
        $backslashes = 0
        while ($i -lt $chars.Length -and $chars[$i] -eq '\') { $backslashes++; $i++ }
        if ($i -eq $chars.Length) {
          [void]$sb.Append('\' * ($backslashes * 2))
          break
        } elseif ($chars[$i] -eq '"') {
          [void]$sb.Append('\' * ($backslashes * 2 + 1))
          [void]$sb.Append('"')
          $i++
        } else {
          [void]$sb.Append('\' * $backslashes)
          [void]$sb.Append($chars[$i])
          $i++
        }
      }
      [void]$sb.Append('"')
      $sb.ToString()
    }
  }

  return ($quoted -join ' ')
}

$outputFile = Join-Path $env:TEMP ("pulse-" + [guid]::NewGuid().ToString() + ".txt")
$targetCommandLine = ConvertTo-Win32CommandLine -Parts (@($exe) + $targetArgs)

# O cmd cuida do redirecionamento porque não há como ler a saída de um processo
# criado por CreateProcessWithTokenW. O /s faz o cmd tratar tudo entre as
# aspas externas como uma única linha literal, sem reprocessar & | etc. dentro
# dela — só o comando alvo (winget) é montado a partir do array de args, nunca
# uma string vinda de fora já pronta.
$inner = "cmd.exe /s /c `"$targetCommandLine > `"$outputFile`" 2>&1`""

$runner = @'
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
'@

$UAC_DISABLED = -1006

# Sem UAC o Windows não divide o token, então todo processo da conta roda
# elevado, inclusive o explorer. Nesse caso não existe para onde rebaixar.
$uacPath = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System'
$uacValue = (Get-ItemProperty -Path $uacPath -Name EnableLUA -ErrorAction SilentlyContinue).EnableLUA
if ($null -ne $uacValue -and $uacValue -eq 0) {
  [pscustomobject]@{ code = $UAC_DISABLED; text = '' } | ConvertTo-Json -Compress
  return
}

Add-Type -TypeDefinition $runner
$code = [PulseUserRunner]::Run($inner, $env:TEMP, $timeoutMs)

$text = ''
if (Test-Path $outputFile) {
  $text = Get-Content -Raw -Path $outputFile -ErrorAction SilentlyContinue
  Remove-Item -Path $outputFile -Force -ErrorAction SilentlyContinue
}
if (-not $text) { $text = '' }

[pscustomobject]@{ code = $code; text = $text } | ConvertTo-Json -Compress
