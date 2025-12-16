# Windows Production Build Script for Screenshot Maker
# This script builds a production-ready Windows app

param(
    [switch]$SkipPrerequisiteCheck,
    [switch]$SkipDependencies
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting production build for Windows..." -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
if (-not $SkipPrerequisiteCheck) {
    Write-Host "Checking prerequisites..." -ForegroundColor Blue

    # Check Rust
    $rustVersion = $null
    try {
        $rustVersion = rustc --version 2>$null
    } catch {}

    if (-not $rustVersion) {
        Write-Host "Rust not found. Please install Rust from https://rustup.rs" -ForegroundColor Yellow
        Write-Host "After installation, restart your terminal and run this script again." -ForegroundColor Yellow
        exit 1
    }
    Write-Host "✓ Rust: $rustVersion" -ForegroundColor Green

    # Check Node.js
    $nodeVersion = $null
    try {
        $nodeVersion = node --version 2>$null
    } catch {}

    if (-not $nodeVersion) {
        Write-Host "Node.js not found. Please install Node.js from https://nodejs.org" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "✓ Node.js: $nodeVersion" -ForegroundColor Green

    # Check pnpm
    $pnpmVersion = $null
    try {
        $pnpmVersion = pnpm --version 2>$null
    } catch {}

    if (-not $pnpmVersion) {
        Write-Host "pnpm not found. Installing..." -ForegroundColor Yellow
        npm install -g pnpm
        $pnpmVersion = pnpm --version
    }
    Write-Host "✓ pnpm: $pnpmVersion" -ForegroundColor Green

    Write-Host "✓ Prerequisites OK" -ForegroundColor Green
    Write-Host ""
}

# Install dependencies
if (-not $SkipDependencies) {
    Write-Host "Installing dependencies..." -ForegroundColor Blue
    pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Dependencies installed" -ForegroundColor Green
    Write-Host ""
}

# Build the application
Write-Host "Building Tauri application (release mode)..." -ForegroundColor Blue
Write-Host "This may take several minutes on first build..." -ForegroundColor Gray
Write-Host ""

pnpm tauri build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Build completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Output files location:" -ForegroundColor Cyan

$bundlePath = "src-tauri\target\release\bundle"
if (Test-Path $bundlePath) {
    Write-Host "  📁 $bundlePath" -ForegroundColor White

    # List MSI files
    $msiFiles = Get-ChildItem -Path "$bundlePath\msi" -Filter "*.msi" -ErrorAction SilentlyContinue
    if ($msiFiles) {
        Write-Host ""
        Write-Host "  MSI Installers:" -ForegroundColor Cyan
        foreach ($file in $msiFiles) {
            Write-Host "    - $($file.Name)" -ForegroundColor White
        }
    }

    # List NSIS files
    $nsisFiles = Get-ChildItem -Path "$bundlePath\nsis" -Filter "*.exe" -ErrorAction SilentlyContinue
    if ($nsisFiles) {
        Write-Host ""
        Write-Host "  NSIS Installers:" -ForegroundColor Cyan
        foreach ($file in $nsisFiles) {
            Write-Host "    - $($file.Name)" -ForegroundColor White
        }
    }
}

# Also show the standalone exe
$exePath = "src-tauri\target\release\screenshot-maker.exe"
if (Test-Path $exePath) {
    Write-Host ""
    Write-Host "  Standalone executable:" -ForegroundColor Cyan
    Write-Host "    - $exePath" -ForegroundColor White
}

Write-Host ""
Write-Host "🎉 Done!" -ForegroundColor Green

