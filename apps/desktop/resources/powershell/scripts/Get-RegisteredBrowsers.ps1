$ErrorActionPreference = 'SilentlyContinue'

@(foreach ($raiz in @('HKLM:\SOFTWARE\Clients\StartMenuInternet', 'HKCU:\SOFTWARE\Clients\StartMenuInternet')) {
  Get-ChildItem $raiz | ForEach-Object {
    [pscustomobject]@{
      key    = [string]$_.PSChildName
      exe    = [string](Get-ItemProperty "$($_.PSPath)\shell\open\command").'(default)'
      progId = [string](Get-ItemProperty "$($_.PSPath)\Capabilities\URLAssociations").http
    }
  }
}) | ConvertTo-Json -Compress
