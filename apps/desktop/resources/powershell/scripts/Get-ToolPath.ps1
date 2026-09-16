$ErrorActionPreference = 'SilentlyContinue'

$machine = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment' -Name Path).Path
$user = (Get-ItemProperty 'HKCU:\Environment' -Name Path).Path

[pscustomobject]@{ path = @($machine, $user) -join ';' } | ConvertTo-Json -Compress
