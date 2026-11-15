# Start the YOLO photo checker on http://localhost:8001 for local development.
# Reads YOLO_KEY from ../server/.env so the key always matches what the API server sends.
#   .\run.ps1            (from the yolo folder)
#   .\run.ps1 -Port 8002
param([int]$Port = 8001)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$envFile = Join-Path $PSScriptRoot '..\server\.env'
if (Test-Path -LiteralPath $envFile) {
    $line = Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^YOLO_KEY=' } | Select-Object -First 1
    if ($line) { $env:YOLO_KEY = $line.Substring('YOLO_KEY='.Length).Trim() }
}
if (-not $env:YOLO_KEY) { Write-Warning 'YOLO_KEY not found in server/.env: requests are not checked for a key.' }

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    throw 'uv is not installed. Run: winget install astral-sh.uv'
}
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot '.venv'))) {
    Write-Host 'First run: creating .venv and installing (PyTorch is large, this takes a few minutes)...'
    uv venv
    uv pip install -r requirements.txt -r requirements-dev.txt
}

uv run uvicorn main:app --port $Port
