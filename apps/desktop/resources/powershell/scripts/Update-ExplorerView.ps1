# Avisa o shell que as opções de pasta mudaram. Sem isso, ligar "mostrar
# extensão" só aparece depois de reiniciar o Explorador.
$signature = @'
[DllImport("shell32.dll")]
public static extern void SHChangeNotify(int eventId, uint flags, IntPtr item1, IntPtr item2);
'@

try {
  $shell = Add-Type -MemberDefinition $signature -Name 'PulseShell' -Namespace 'Pulse' -PassThru
  $shell::SHChangeNotify(0x8000000, 0x1000, [IntPtr]::Zero, [IntPtr]::Zero)
  [pscustomobject]@{ refreshed = $true } | ConvertTo-Json -Compress
} catch {
  [pscustomobject]@{ refreshed = $false } | ConvertTo-Json -Compress
}
