$signature = @'
[DllImport("shell32.dll")]
public static extern void SHChangeNotify(int eventId, uint flags, IntPtr item1, IntPtr item2);
'@
$shell = Add-Type -MemberDefinition $signature -Name 'PulseShell' -Namespace 'Pulse' -PassThru
$shell::SHChangeNotify(0x8000000, 0x1000, [IntPtr]::Zero, [IntPtr]::Zero)
