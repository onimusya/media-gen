# Install media-gen-cli (Windows PowerShell)
# Compatible with PowerShell 5.1+ and PowerShell Core 7+
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Resolve-Path (Join-Path $ScriptDir "..\..\..") | Select-Object -ExpandProperty Path

Write-Host "Installing media-gen-cli from: $ProjectDir"

Set-Location $ProjectDir

# Check for Node.js
try {
    $nodeVersion = & node -v 2>$null
} catch {
    Write-Host "Error: Node.js is required but not installed." -ForegroundColor Red
    Write-Host "Install it from https://nodejs.org/ (v18+)"
    exit 1
}

if (-not $nodeVersion) {
    Write-Host "Error: Node.js is required but not installed." -ForegroundColor Red
    Write-Host "Install it from https://nodejs.org/ (v18+)"
    exit 1
}

$major = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
if ($major -lt 18) {
    Write-Host "Error: Node.js 18+ is required. Found: $nodeVersion" -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "Installing dependencies..."
& npm install --silent
if ($LASTEXITCODE -ne 0) { exit 1 }

# Build the CLI
Write-Host "Building CLI..."
& npm run build --silent
if ($LASTEXITCODE -ne 0) { exit 1 }

# Verify
$distPath = Join-Path $ProjectDir "dist\media-gen.mjs"
if (Test-Path $distPath) {
    Write-Host ""
    Write-Host "media-gen-cli installed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Run with:"
    Write-Host "  node $distPath --help"
    Write-Host ""
    Write-Host "Or link globally:"
    Write-Host "  npm link"
    Write-Host "  media-gen --help"
} else {
    Write-Host "Error: Build failed. dist\media-gen.mjs not found." -ForegroundColor Red
    exit 1
}
