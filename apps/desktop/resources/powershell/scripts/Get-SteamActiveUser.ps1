$ErrorActionPreference = 'SilentlyContinue'

$user = (Get-ItemProperty 'HKCU:\Software\Valve\Steam\ActiveProcess' -Name ActiveUser).ActiveUser
$account = if ($user) { [int]$user } else { 0 }

$userId = if ($account -ne 0) { [string]$account } else { $null }
[pscustomobject]@{ userId = $userId } | ConvertTo-Json -Compress
