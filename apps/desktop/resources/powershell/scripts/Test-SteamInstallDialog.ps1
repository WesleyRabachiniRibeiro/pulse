$ErrorActionPreference = 'SilentlyContinue'

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class SteamEye {
  public delegate bool Callback(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumWindows(Callback cb, IntPtr p);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
}
"@

function Emit([bool]$open) {
  [pscustomobject]@{ open = $open } | ConvertTo-Json -Compress
  exit
}

$pids = @(Get-Process | Where-Object { $_.ProcessName -like 'steam*' } | ForEach-Object { $_.Id })
if (-not $pids) { Emit $false }

$found = $false
$cb = [SteamEye+Callback]{
  param($h, $p)
  if (-not [SteamEye]::IsWindowVisible($h)) { return $true }
  $owner = 0
  [void][SteamEye]::GetWindowThreadProcessId($h, [ref]$owner)
  if ($pids -notcontains $owner) { return $true }
  $sb = New-Object Text.StringBuilder 512
  [void][SteamEye]::GetWindowTextW($h, $sb, 512)
  $t = $sb.ToString()
  if ($t -like 'Instalar*' -or $t -like 'Install*') { $script:found = $true; return $false }
  return $true
}
[void][SteamEye]::EnumWindows($cb, [IntPtr]::Zero)

Emit $found
