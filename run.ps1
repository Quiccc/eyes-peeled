# Start Eyes Peeled for local development, one window per part.
#   .\run.ps1                       server + admin panel + Expo
#   .\run.ps1 -NoAdmin -NoMobile    skip parts
# Photos are checked by Claude when ANTHROPIC_API_KEY is set in server/.env, otherwise by a random stub.
param(
    [switch]$NoAdmin,
    [switch]$NoMobile
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm is not installed. Install Node.js first.' }

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

Copy-EnvExample $server '.env'
Copy-EnvExample $mobile '.env.local'

Start-Part 'Server (4000)' $server (Get-NpmCommand $server 'npm run dev')

if (-not $NoAdmin) {
    Start-Part 'Admin (5174)' $admin (Get-NpmCommand $admin 'npm run dev')
}

if (-not $NoMobile) {
    Start-Part 'Expo' $mobile (Get-NpmCommand $mobile 'npx expo start')
}

Write-Host ''
Write-Host 'API:          http://localhost:4000'
if (-not $NoAdmin) { Write-Host 'Admin panel:  http://localhost:5174/admin-panel/' }
Write-Host 'Close a window (or Ctrl+C in it) to stop that part.'
