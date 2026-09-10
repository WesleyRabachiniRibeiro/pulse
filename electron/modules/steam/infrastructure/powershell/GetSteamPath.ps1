$ErrorActionPreference = 'SilentlyContinue'
$p = (Get-ItemProperty 'HKCU:\Software\Valve\Steam').SteamPath
if (-not $p) { $p = (Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\Valve\Steam').InstallPath }
if ($p) { $p } else { '' }
