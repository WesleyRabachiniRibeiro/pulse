$ErrorActionPreference = 'SilentlyContinue'

$keys = @(
  'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
$names = @(Get-ItemProperty $keys | Where-Object { $_.DisplayName } | ForEach-Object { [string]$_.DisplayName })
$names += @(try { Get-StartApps | ForEach-Object { [string]$_.Name } } catch { @() })

[pscustomobject]@{ names = @($names | Sort-Object -Unique) } | ConvertTo-Json -Compress -Depth 3
