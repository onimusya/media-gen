# Create a GitHub release with the skills folder as a zip attachment.
# Usage: .\scripts\release.ps1 -Version "v1.0.0" -Title "Initial release"
# Requires: gh CLI (https://cli.github.com)
param(
    [Parameter(Mandatory=$true)]
    [string]$Version,
    [string]$Title = "media-gen-cli $Version"
)

$ErrorActionPreference = "Stop"
$ProjectDir = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectDir

# Ensure clean build
Write-Host "Building..."
npm run build
if ($LASTEXITCODE -ne 0) { exit 1 }

# Create zip of skills folder
$ZipFile = "dist\media-gen-skill-$Version.zip"
Write-Host "Creating $ZipFile..."

if (Test-Path $ZipFile) { Remove-Item $ZipFile }
Compress-Archive -Path "skills\*" -DestinationPath $ZipFile -Force

# Create git tag
Write-Host "Tagging $Version..."
git tag -a $Version -m $Title
if ($LASTEXITCODE -ne 0) { exit 1 }
git push origin $Version
if ($LASTEXITCODE -ne 0) { exit 1 }

# Create GitHub release
Write-Host "Creating GitHub release..."
gh release create $Version `
    --title $Title `
    --generate-notes `
    $ZipFile

if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host ""
Write-Host "Release $Version created!" -ForegroundColor Green
Write-Host "  https://github.com/onimusya/media-gen/releases/tag/$Version"
