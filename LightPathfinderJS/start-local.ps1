$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath($PSScriptRoot)
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse('127.0.0.1'), 8011)
$mime = @{
  '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8';
  '.css'='text/css; charset=utf-8'; '.json'='application/json; charset=utf-8';
  '.png'='image/png'; '.jpg'='image/jpeg'; '.ogg'='audio/ogg'
}

try {
  $listener.Start()
  $url='http://127.0.0.1:8011/'
  Write-Host "Light Pathfinder JS slice: $url"
  Write-Host 'Keep this window open while playing. Press Ctrl+C to stop the local server.'
  Start-Process $url
  while ($true) {
    $client=$listener.AcceptTcpClient()
    try {
      $stream=$client.GetStream()
      $reader=[System.IO.StreamReader]::new($stream,[System.Text.Encoding]::ASCII,$false,1024,$true)
      $requestLine=$reader.ReadLine()
      while (($headerLine=$reader.ReadLine()) -and $headerLine.Length -gt 0) { }
      $status='200 OK'; $body=[byte[]]@(); $contentType='text/plain; charset=utf-8'
      try {
        if (-not $requestLine) { throw 'Empty request' }
        $parts=$requestLine.Split(' ')
        if ($parts.Count -lt 2 -or $parts[0] -ne 'GET') { throw 'Only GET requests are supported' }
        $requestPath=[System.Uri]::UnescapeDataString(($parts[1] -split '\?',2)[0])
        if ($requestPath -eq '/') { $requestPath='/index.html' }
        $relative=$requestPath.TrimStart('/').Replace('/',[System.IO.Path]::DirectorySeparatorChar)
        $file=[System.IO.Path]::GetFullPath((Join-Path $root $relative))
        if (-not $file.StartsWith($root+[System.IO.Path]::DirectorySeparatorChar,[System.StringComparison]::OrdinalIgnoreCase)) { throw 'Path is outside the project folder' }
        if (-not [System.IO.File]::Exists($file)) { $status='404 Not Found'; $body=[System.Text.Encoding]::UTF8.GetBytes('Not found') }
        else {
          $body=[System.IO.File]::ReadAllBytes($file)
          $extension=[System.IO.Path]::GetExtension($file).ToLowerInvariant()
          if ($mime.ContainsKey($extension)) { $contentType=$mime[$extension] } else { $contentType='application/octet-stream' }
        }
      } catch {
        if ($status -eq '200 OK') { $status='400 Bad Request' }
        $body=[System.Text.Encoding]::UTF8.GetBytes($_.Exception.Message)
      }
      $header="HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
      $headerBytes=[System.Text.Encoding]::ASCII.GetBytes($header)
      $stream.Write($headerBytes,0,$headerBytes.Length)
      if ($body.Length -gt 0) { $stream.Write($body,0,$body.Length) }
      $stream.Flush(); $reader.Dispose()
    } finally { $client.Close() }
  }
} finally { $listener.Stop() }
