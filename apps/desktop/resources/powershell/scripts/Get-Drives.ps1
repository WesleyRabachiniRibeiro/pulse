$ErrorActionPreference = 'SilentlyContinue'

$vols = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object {
  [pscustomobject]@{
    letter     = [string]$_.DeviceID
    label      = [string]$_.VolumeName
    media      = 'Desconhecido'
    freeBytes  = [int64]$_.FreeSpace
    totalBytes = [int64]$_.Size
    system     = ([string]$_.DeviceID -eq $env:SystemDrive)
  }
})

# Primeira resposta: rápida, sem tipo de mídia (o suficiente para o cálculo de
# espaço). A segunda, mais lenta, enriquece a mesma lista com SSD/HDD via CIM
# de armazenamento — o Node lê as duas linhas NDJSON conforme chegam.
$vols | ConvertTo-Json -Compress -Depth 3

$ns = 'root/Microsoft/Windows/Storage'

$media = @{}
foreach ($d in @(Get-CimInstance -Namespace $ns -ClassName MSFT_PhysicalDisk)) {
  $media[[int]$d.DeviceId] = switch ([int]$d.MediaType) { 3 { 'HDD' } 4 { 'SSD' } default { 'Desconhecido' } }
}

$disk = @{}
foreach ($p in @(Get-CimInstance -Namespace $ns -ClassName MSFT_Partition)) {
  if ($p.DriveLetter) { $disk[[string]$p.DriveLetter] = [int]$p.DiskNumber }
}

foreach ($v in $vols) {
  $short = $v.letter.TrimEnd(':')
  if ($disk.ContainsKey($short)) {
    $n = $disk[$short]
    if ($media.ContainsKey($n)) { $v.media = $media[$n] }
  }
}

$vols | ConvertTo-Json -Compress -Depth 3
