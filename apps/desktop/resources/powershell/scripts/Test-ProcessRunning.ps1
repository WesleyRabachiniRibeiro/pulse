param([string]$ParamsJson)

$ErrorActionPreference = 'SilentlyContinue'
$p = $ParamsJson | ConvertFrom-Json
$name = [string]$p.name

$found = Get-Process -Name $name -ErrorAction SilentlyContinue
[pscustomobject]@{ running = [bool]$found } | ConvertTo-Json -Compress
