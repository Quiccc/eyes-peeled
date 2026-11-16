# Start Eyes Peeled for local development, one window per part.
#   .\run.ps1                       YOLO + server + admin panel + Expo
#   .\run.ps1 -NoYolo -NoMobile     skip parts (without YOLO the server uses its photo stub)
param(
    [switch]$NoYolo,
    [switch]$NoAdmin,
    [switch]$NoMobile
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm is not installed. Install Node.js first.' }
if (-not $NoYolo -and -not (Get-Command uv -ErrorAction SilentlyContinue)) {
    throw 'uv is not installed. Run: winget install astral-sh.uv   (or use -NoYolo)'
}

# Copy .env files from their examples on first run.
function Copy-EnvExample([string]$dir, [string]$name) {
    $target = Join-Path $dir $name
    $example = Join-Path $dir '.env.example'
    if (-not (Test-Path -LiteralPath $target) -and (Test-Path -LiteralPath $example)) {
        Copy-Item -LiteralPath $example -Destination $target
        Write-Host "Created $target from .env.example"
    }
}

# Open a new PowerShell window titled $title in $dir and run $command there.
function Start-Part([string]$title, [string]$dir, [string]$command) {
    $script = "`$Host.UI.RawUI.WindowTitle = 'Eyes Peeled: $title'; $command"
    Start-Process powershell -WorkingDirectory $dir -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $script
    Write-Host "Started $title"
}

# npm install first if node_modules is missing, then the dev command.
function Get-NpmCommand([string]$dir, [string]$run) {
    if (Test-Path -LiteralPath (Join-Path $dir 'node_modules')) { return $run }
    return "npm install; if (`$?) { $run }"
}

$server = Join-Path $root 'server'
$admin = Join-Path $server 'admin'
$mobile = Join-Path $root 'mobile'
$yolo = Join-Path $root 'yolo'

Copy-EnvExample $server '.env'
Copy-EnvExample $mobile '.env.local'

if (-not $NoYolo) {
    Start-Part 'YOLO (8001)' $yolo '.\run.ps1'
}

$serverCmd = Get-NpmCommand $server 'npm run dev'
if (-not $NoYolo) { $serverCmd = "`$env:YOLO_URL = 'http://localhost:8001'; $serverCmd" }
Start-Part 'Server (4000)' $server $serverCmd

if (-not $NoAdmin) {
    Start-Part 'Admin (5174)' $admin (Get-NpmCommand $admin 'npm run dev')
}

if (-not $NoMobile) {
    Start-Part 'Expo' $mobile (Get-NpmCommand $mobile 'npx expo start')
}

Write-Host ''
Write-Host 'API:          http://localhost:4000'
if (-not $NoAdmin) { Write-Host 'Admin panel:  http://localhost:5174/admin-panel/' }
if (-not $NoYolo) { Write-Host 'YOLO:         http://localhost:8001/health' }
Write-Host 'Close a window (or Ctrl+C in it) to stop that part.'
