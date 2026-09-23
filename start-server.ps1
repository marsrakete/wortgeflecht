param(
  [int]$Port = 4173
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")

try {
  $listener.Start()
} catch [System.Net.HttpListenerException] {
  Write-Error "Port $Port ist bereits belegt. Bitte einen anderen Port verwenden, zum Beispiel: .\start-server.ps1 -Port 4174"
  $listener.Close()
  exit 1
}

Write-Host "Wortgeflecht laeuft auf http://localhost:$Port/"
Write-Host "Zum Beenden Strg+C druecken."

$contentTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".webmanifest" = "application/manifest+json; charset=utf-8"
  ".svg" = "image/svg+xml"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
}

try {
  while ($listener.IsListening) {
    $pendingContext = $listener.BeginGetContext($null, $null)
    while ($listener.IsListening -and -not $pendingContext.AsyncWaitHandle.WaitOne(200)) { }
    if (-not $listener.IsListening) { break }
    $context = $listener.EndGetContext($pendingContext)
    $requestPath = $context.Request.Url.AbsolutePath.TrimStart("/")
    if ([string]::IsNullOrWhiteSpace($requestPath)) { $requestPath = "index.html" }
    $filePath = Join-Path $root ($requestPath.Replace("/", "\"))
    if (-not (Test-Path $filePath -PathType Leaf)) {
      $context.Response.StatusCode = 404
      $bytes = [Text.Encoding]::UTF8.GetBytes("404 - Datei nicht gefunden")
      $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      $context.Response.Close()
      continue
    }
    $contentType = $contentTypes[[IO.Path]::GetExtension($filePath).ToLowerInvariant()]
    if (-not $contentType) { $contentType = "application/octet-stream" }
    $bytes = [IO.File]::ReadAllBytes($filePath)
    $context.Response.ContentType = $contentType
    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $context.Response.Close()
  }
} finally {
  if ($listener.IsListening) { $listener.Stop() }
  $listener.Close()
}
