$ErrorActionPreference = 'SilentlyContinue'

$p = (Get-ItemProperty 'HKCU:\Software\Valve\Steam').SteamPath
if (-not $p) { $p = (Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\Valve\Steam').InstallPath }

$path = if ($p) { ([string]$p) -replace '/', '\' } else { $null }
[pscustomobject]@{ path = $path } | ConvertTo-Json -Compress
