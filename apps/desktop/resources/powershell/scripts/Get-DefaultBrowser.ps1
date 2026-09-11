$ErrorActionPreference = 'SilentlyContinue'

$k = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice'
[pscustomobject]@{ progId = if ($k.ProgId) { [string]$k.ProgId } else { $null } } | ConvertTo-Json -Compress
