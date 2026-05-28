$ErrorActionPreference = "Stop"

$srcDir = $PSScriptRoot
$outDir = Join-Path $srcDir "figures"
$iconsDir = Join-Path $srcDir "icons"
$puppeteerConfig = Join-Path $srcDir "puppeteer-config.json"
$mermaidConfig = Join-Path $srcDir "mermaid-config.json"
$tempDir = Join-Path $srcDir ".render-tmp"

if (!(Test-Path $outDir)) {
  New-Item -ItemType Directory -Path $outDir | Out-Null
}
if (!(Test-Path $tempDir)) {
  New-Item -ItemType Directory -Path $tempDir | Out-Null
}

function Get-IconDataUri([string]$fileName) {
  $path = Join-Path $iconsDir $fileName
  if (!(Test-Path $path)) {
    throw "Missing icon file: $path"
  }
  $ext = [IO.Path]::GetExtension($fileName).ToLowerInvariant()
  $mime = switch ($ext) {
    ".svg" { "image/svg+xml" }
    ".png" { "image/png" }
    ".ico" { "image/x-icon" }
    default { "application/octet-stream" }
  }
  $bytes = [System.IO.File]::ReadAllBytes($path)
  $b64 = [Convert]::ToBase64String($bytes)
  return "data:$mime;base64,$b64"
}

function New-IconNodeHtml([string]$dataUri, [string]$title, [string]$subtitle = "") {
  $sub = if ($subtitle) {
    "<div style='font-size:12px;color:#64748b;margin-top:2px'>$subtitle</div>"
  } else { "" }
  return "<div style='text-align:center;min-width:88px;padding:6px 10px'>" +
    "<img src='$dataUri' width='48' height='48' alt='$title' " +
    "style='width:48px;height:48px;max-width:48px;max-height:48px;display:block;margin:0 auto;object-fit:contain'/>" +
    "<div style='font-weight:600;margin-top:6px'>$title</div>" +
    $sub +
    "</div>"
}

$iconNext = Get-IconDataUri "nextjs.svg"
$iconNest = Get-IconDataUri "nestjs.svg"
$iconMongo = Get-IconDataUri "mongodb.svg"
$iconJikan = Get-IconDataUri "jikan.svg"
$iconBgm = Get-IconDataUri "bangumi.ico"
$iconReact = Get-IconDataUri "react.svg"
$iconTs = Get-IconDataUri "typescript.svg"
$iconTailwind = Get-IconDataUri "tailwind.svg"
$iconNode = Get-IconDataUri "nodejs.svg"

$iconNodes = @{
  "ICON_NODE_NEXTJS"      = (New-IconNodeHtml $iconNext "Next.js" ":3000")
  "ICON_NODE_NESTJS"      = (New-IconNodeHtml $iconNest "NestJS" ":3001")
  "ICON_NODE_MONGODB"     = (New-IconNodeHtml $iconMongo "MongoDB" "Atlas")
  "ICON_NODE_JIKAN"       = (New-IconNodeHtml $iconJikan "Jikan" "MAL API")
  "ICON_NODE_BANGUMI"     = (New-IconNodeHtml $iconBgm "Bangumi" "api.bgm.tv")
  "ICON_NODE_BANGUMI_SVC" = (New-IconNodeHtml $iconBgm "BangumiService" "api.bgm.tv")
  "ICON_NODE_NEXTJS_UI"   = (New-IconNodeHtml $iconNext "Next.js UI" "")
  "ICON_NODE_REACT"       = (New-IconNodeHtml $iconReact "React" "19")
  "ICON_NODE_TYPESCRIPT"  = (New-IconNodeHtml $iconTs "TypeScript" "5")
  "ICON_NODE_TAILWIND"    = (New-IconNodeHtml $iconTailwind "Tailwind CSS" "4")
  "ICON_NODE_NODEJS"      = (New-IconNodeHtml $iconNode "Node.js" "runtime")
}

function Expand-DiagramPlaceholders([string]$content) {
  foreach ($key in $iconNodes.Keys) {
    $content = $content.Replace($key, $iconNodes[$key])
  }
  return $content
}

function Repair-SvgIconSizing([string]$svgPath) {
  if (!(Test-Path $svgPath)) { return }
  $svg = [System.IO.File]::ReadAllText($svgPath)
  $svg = [regex]::Replace(
    $svg,
    '<img([^>]*?)style="[^"]*"',
    '<img$1style="width:48px;height:48px;max-width:48px;max-height:48px;display:block;margin:0 auto;object-fit:contain"'
  )
  $svg = $svg.Replace("color:#64748bmargin", "color:#64748b;margin")
  [System.IO.File]::WriteAllText($svgPath, $svg, $utf8NoBom)
}

$files = Get-ChildItem -Path $srcDir -Filter "*.mmd"
if ($files.Count -eq 0) {
  Write-Host "No .mmd files found in $srcDir"
  exit 0
}

Write-Host "Rendering Mermaid diagrams to: $outDir"
$env:PUPPETEER_SKIP_DOWNLOAD = "true"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

foreach ($f in $files) {
  $name = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)
  $outSvg = Join-Path $outDir "$name.svg"
  $outPng = Join-Path $outDir "$name.png"
  $tempMmd = Join-Path $tempDir "$name.render.mmd"
  $relTemp = Join-Path ".render-tmp" "$name.render.mmd"

  $content = Expand-DiagramPlaceholders (Get-Content $f.FullName -Raw -Encoding UTF8)
  [System.IO.File]::WriteAllText($tempMmd, $content, $utf8NoBom)

  Write-Host " - $($f.Name) -> figures/$name.svg + $name.png"

  Push-Location $srcDir
  try {
    npx -y @mermaid-js/mermaid-cli@11.4.0 -i $relTemp -o $outPng -b white -p $puppeteerConfig -c $mermaidConfig -s 2
    npx -y @mermaid-js/mermaid-cli@11.4.0 -i $relTemp -o $outSvg -b transparent -p $puppeteerConfig -c $mermaidConfig -s 2
    Repair-SvgIconSizing $outSvg
  } finally {
    Pop-Location
  }
}

Write-Host "Done."
