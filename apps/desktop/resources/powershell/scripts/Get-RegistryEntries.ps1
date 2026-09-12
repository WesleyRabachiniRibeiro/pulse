$ErrorActionPreference = 'SilentlyContinue'

# As três chaves onde o Windows cadastra desinstalação: a do usuário, a da
# máquina, e a de 32 bits num Windows de 64.
$keys = @(
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\SOFTWARE\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
)

$entries = @(
  foreach ($key in $keys) {
    foreach ($item in Get-ItemProperty $key) {
      $name = [string]$item.DisplayName
      if ([string]::IsNullOrWhiteSpace($name)) { continue }

      # SystemComponent e ParentKeyName marcam peça de outro programa, não
      # programa que a pessoa instalou.
      $system = ($item.SystemComponent -eq 1) -or (-not [string]::IsNullOrWhiteSpace([string]$item.ParentKeyName))

      [pscustomobject]@{
        key       = [string]$item.PSChildName
        name      = $name
        publisher = [string]$item.Publisher
        version   = [string]$item.DisplayVersion
        system    = [bool]$system
        location  = [string]$item.InstallLocation
        icon      = [string]$item.DisplayIcon
        uninstall = [string]$item.QuietUninstallString
      }
    }
  }
)

# QuietUninstallString nem sempre existe; UninstallString é o que a maioria tem.
$entries = @(
  foreach ($entry in $entries) {
    if ([string]::IsNullOrWhiteSpace($entry.uninstall)) {
      $found = Get-ItemProperty $keys | Where-Object { $_.PSChildName -eq $entry.key } | Select-Object -First 1
      if ($found) { $entry.uninstall = [string]$found.UninstallString }
    }
    $entry
  }
)

[pscustomobject]@{ entries = $entries } | ConvertTo-Json -Compress -Depth 3
