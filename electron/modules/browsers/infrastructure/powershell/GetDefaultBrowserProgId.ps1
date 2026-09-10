$ErrorActionPreference = 'SilentlyContinue'
$k = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice'
if ($k.ProgId) { $k.ProgId } else { '' }
