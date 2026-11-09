#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$PROJECT_ROOT/app"

for tool in powershell.exe wslpath npm; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    printf 'Required WSL tool not found: %s\n' "$tool" >&2
    exit 1
  fi
done

printf 'Building the frontend from the current WSL project...\n'
(cd -- "$APP_ROOT" && npm run build)

WINDOWS_PROJECT="$(wslpath -w "$PROJECT_ROOT")"
WINDOWS_PROJECT="$(printf '%s' "$WINDOWS_PROJECT" | sed "s/'/''/g")"

POWERSHELL_COMMAND="
\$ErrorActionPreference = 'Stop'
\$ProjectPath = '$WINDOWS_PROJECT'
\$AppPath = Join-Path \$ProjectPath 'app'
\$InstallerDir = Join-Path \$ProjectPath 'app\src-tauri\target\release\bundle\nsis'
\$Destination = 'D:\Downloads\quran-beta'
\$CliRoot = Join-Path \$env:LOCALAPPDATA 'quran-desktop-build-tools'
\$TauriCommand = Join-Path \$CliRoot 'node_modules\.bin\tauri.cmd'
\$ConfigPath = Join-Path \$env:TEMP ('quran-build-' + [guid]::NewGuid().ToString() + '.json')
\$BuildStarted = Get-Date

# Build the frontend with WSL Node above. Use CMD pushd to map the WSL UNC
# project directory to a temporary drive for Windows Rust/Tauri tools. Keep
# Windows Tauri dependencies outside the WSL node_modules tree.
Set-Location -LiteralPath \$env:TEMP
if (-not (Test-Path -LiteralPath \$TauriCommand)) {
  New-Item -ItemType Directory -Path \$CliRoot -Force | Out-Null
  Write-Host 'Installing the Windows Tauri CLI in the Windows npm cache...'
  & npm.cmd install --prefix \$CliRoot '@tauri-apps/cli@2.12.4'
  if (\$LASTEXITCODE -ne 0) { throw \"Windows Tauri CLI install failed with exit code \$LASTEXITCODE.\" }
}

\$BuildConfig = @{ build = @{ beforeBuildCommand = '' } } | ConvertTo-Json -Compress
Set-Content -LiteralPath \$ConfigPath -Value \$BuildConfig -Encoding ASCII
\$BuildCommand = 'pushd \"' + \$AppPath + '\" && call \"' + \$TauriCommand + '\" build --bundles nsis --config \"' + \$ConfigPath + '\"'
\$BuildProcess = Start-Process -FilePath \$env:ComSpec -ArgumentList @('/d', '/s', '/c', \$BuildCommand) -WorkingDirectory \$env:TEMP -Wait -PassThru -NoNewWindow
if (\$BuildProcess.ExitCode -ne 0) { throw \"Tauri build failed with exit code \$(\$BuildProcess.ExitCode).\" }
Remove-Item -LiteralPath \$ConfigPath -Force -ErrorAction SilentlyContinue

\$Installer = Get-ChildItem -Path \$InstallerDir -Filter '*-setup.exe' -File |
  Where-Object { \$_.LastWriteTime -ge \$BuildStarted } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
if (-not \$Installer) { throw \"No newly built NSIS installer was found in '\$InstallerDir'.\" }

New-Item -ItemType Directory -Path \$Destination -Force | Out-Null
\$OutputPath = Join-Path \$Destination \$Installer.Name
Copy-Item -Path \$Installer.FullName -Destination \$OutputPath -Force
Write-Host \"Windows installer copied to: \$OutputPath\"
"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$POWERSHELL_COMMAND"
