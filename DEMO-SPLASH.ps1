Add-Type -AssemblyName PresentationFramework, PresentationCore

# -----------------------------
# WPF CINEMATIC WINDOW
# -----------------------------
[xml]$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        Title="Risk Brain Boot"
        Height="520"
        Width="900"
        WindowStartupLocation="CenterScreen"
        ResizeMode="NoResize"
        WindowStyle="None"
        Background="#050505">

  <Grid>

    <Grid.RowDefinitions>
      <RowDefinition Height="*" />
      <RowDefinition Height="80" />
    </Grid.RowDefinitions>

    <!-- Center Panel -->
    <StackPanel VerticalAlignment="Center" HorizontalAlignment="Center">

      <TextBlock Text="RISK BRAIN"
                 FontSize="42"
                 Foreground="White"
                 FontWeight="Bold"
                 HorizontalAlignment="Center"/>

      <TextBlock Text="National Financial Governance Control Plane"
                 FontSize="14"
                 Foreground="#AAAAAA"
                 HorizontalAlignment="Center"
                 Margin="0,0,0,30"/>

      <Separator Margin="0,10"/>

      <TextBlock Name="statusGateway"  Text="⏳ UI Gateway Initialising…"
                 Foreground="Orange" FontSize="15" Margin="0,8"/>
      <TextBlock Name="statusProm"     Text="⏳ Prometheus Initialising…"
                 Foreground="Orange" FontSize="15" Margin="0,8"/>
      <TextBlock Name="statusGrafana"  Text="⏳ Grafana Initialising…"
                 Foreground="Orange" FontSize="15" Margin="0,8"/>
      <TextBlock Name="statusMetrics"  Text="⏳ Synthetic Metrics Engine Initialising…"
                 Foreground="Orange" FontSize="15" Margin="0,8"/>

      <Separator Margin="0,18"/>

      <ProgressBar Name="bootBar" Width="520" Height="14" />

    </StackPanel>

    <!-- Footer -->
    <TextBlock Grid.Row="1"
               Name="statusFinal"
               Text="Booting secure demo environment…"
               Foreground="#CCCCCC"
               FontSize="13"
               HorizontalAlignment="Center"
               VerticalAlignment="Center"/>

  </Grid>
</Window>
"@

# -----------------------------
# LOAD WINDOW
# -----------------------------
$reader  = New-Object System.Xml.XmlNodeReader $xaml
$window  = [Windows.Markup.XamlReader]::Load($reader)

$statusGateway = $window.FindName("statusGateway")
$statusProm    = $window.FindName("statusProm")
$statusGrafana = $window.FindName("statusGrafana")
$statusMetrics = $window.FindName("statusMetrics")
$statusFinal   = $window.FindName("statusFinal")
$bootBar       = $window.FindName("bootBar")

$window.Topmost = $true
$window.Show()

# -----------------------------
# SERVICE HEALTH CHECK
# -----------------------------
function Wait-Service($url, $label, $progressStep) {
  while ($true) {
    try {
      Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null
      $label.Text = "✅ $($label.Text.Replace('⏳', '').Trim())"
      $label.Foreground = "LightGreen"
      $bootBar.Value += $progressStep
      break
    } catch {
      Start-Sleep -Seconds 1
    }
  }
}

# -----------------------------
# HEALTH SEQUENCE
# -----------------------------
Wait-Service "http://localhost:8080/api/v1/ui/system/health" $statusGateway  25
Wait-Service "http://localhost:9090"                         $statusProm     25
Wait-Service "http://localhost:3001"                         $statusGrafana  25
Wait-Service "http://localhost:9200/mode"                    $statusMetrics  25

# -----------------------------
# FINAL TRANSITION
# -----------------------------
$statusFinal.Text = "✅ All systems live — Launching Control Plane"
$statusFinal.Foreground = "LightGreen"

for ($i = 0; $i -lt 15; $i++) {
  $window.Opacity -= 0.04
  Start-Sleep -Milliseconds 80
}

$window.Close()

Start-Process "http://localhost:3000"
