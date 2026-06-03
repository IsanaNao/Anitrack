# Build course submission artifacts into THIS folder (5-Anitrack/).
# Run from repo root: .\5-Anitrack\build_submission.ps1

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path $PSScriptRoot -Parent
$OutDir = $PSScriptRoot

$SwaggerSrc = Join-Path $RepoRoot "anitrack\anitrack-backend\swagger.json"
$OpenApiOut = Join-Path $OutDir "openapi.json"
$ZipOut = Join-Path $OutDir "Anitrack_sourcecode.zip"

if (-not (Test-Path $SwaggerSrc)) {
    throw "swagger.json not found: $SwaggerSrc"
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Copy-Item -Path $SwaggerSrc -Destination $OpenApiOut -Force
Write-Host "Wrote $OpenApiOut"

$Staging = Join-Path $env:TEMP "Anitrack_source_staging_$(Get-Date -Format 'yyyyMMddHHmmss')"
if (Test-Path $Staging) { Remove-Item $Staging -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Staging | Out-Null

# Exclude deps/build artifacts; exclude 5-Anitrack so the zip does not contain itself
$ExcludeDirs = @(
    "node_modules", ".next", "dist", ".git", "coverage", ".vitest",
    "5-Anitrack"
)
$ExcludeFiles = @(
    ".env", ".env.local", ".env.development.local", ".env.test.local", ".env.production.local",
    "Anitrack_sourcecode.zip"
)

$ExcludeDirArgs = $ExcludeDirs | ForEach-Object { "/XD", $_ }
$ExcludeFileArgs = $ExcludeFiles | ForEach-Object { "/XF", $_ }

$null = robocopy $RepoRoot $Staging /E /NFL /NDL /NJH /NJS /NC /NS @ExcludeDirArgs @ExcludeFileArgs
if ($LASTEXITCODE -ge 8) {
    throw "robocopy failed with exit code $LASTEXITCODE"
}

if (Test-Path $ZipOut) { Remove-Item $ZipOut -Force }
Compress-Archive -Path (Join-Path $Staging "*") -DestinationPath $ZipOut -CompressionLevel Optimal
Remove-Item $Staging -Recurse -Force

$zipMb = [math]::Round((Get-Item $ZipOut).Length / 1MB, 2)
Write-Host "Wrote $ZipOut ($zipMb MB)"
Write-Host "Done. Upload: 5-Anitrack/openapi.json, 5-Anitrack/Anitrack_sourcecode.zip, and defense PDF."
