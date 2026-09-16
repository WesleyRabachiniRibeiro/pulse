$ErrorActionPreference = 'SilentlyContinue'

$id = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($id)
$elevated = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

[pscustomobject]@{ elevated = [bool]$elevated } | ConvertTo-Json -Compress
