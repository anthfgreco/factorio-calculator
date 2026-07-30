param(
    [string]$FactorioExe = "",
    [string]$UserDataDir = (Join-Path $env:APPDATA "Factorio"),
    [string]$OutputZip = (Join-Path $PWD "factorio-2.1.12-space-age-dump.zip"),
    [int]$TimeoutMinutes = 30
)

$ErrorActionPreference = "Stop"

function Test-FactorioRunning {
    return @(Get-Process -Name "factorio" -ErrorAction SilentlyContinue).Count -gt 0
}

function Get-RecentOutputFile {
    param(
        [Parameter(Mandatory)]
        [string]$Directory,
        [Parameter(Mandatory)]
        [datetime]$SinceUtc
    )

    if (-not (Test-Path $Directory)) {
        return $null
    }

    return Get-ChildItem -Path $Directory -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTimeUtc -ge $SinceUtc } |
        Select-Object -First 1
}

function Wait-ForFactorioDump {
    param(
        [Parameter(Mandatory)]
        [datetime]$StartedUtc,
        [Parameter(Mandatory)]
        [string]$Label
    )

    $deadline = (Get-Date).AddMinutes($TimeoutMinutes)
    $sawFactorio = $false
    $sawOutput = $false
    $idleSince = $null

    while ((Get-Date) -lt $deadline) {
        $running = Test-FactorioRunning

        if ($running) {
            $sawFactorio = $true
            $idleSince = $null
        }

        if (-not $sawOutput) {
            $recentFile = Get-RecentOutputFile -Directory $scriptOutput -SinceUtc $StartedUtc
            if ($null -ne $recentFile) {
                $sawOutput = $true
                Write-Host "Output detected: $($recentFile.FullName)"
            }
        }

        if ($sawOutput -and -not $running) {
            if ($null -eq $idleSince) {
                $idleSince = Get-Date
            }

            if (((Get-Date) - $idleSince).TotalSeconds -ge 3) {
                Write-Host "$Label completed." -ForegroundColor Green
                return
            }
        }

        Start-Sleep -Milliseconds 500
    }

    throw @"
Timed out waiting for $Label.
Saw Factorio process: $sawFactorio
Saw new output: $sawOutput
Check: $UserDataDir\factorio-current.log
"@
}

function Invoke-FactorioDump {
    param(
        [Parameter(Mandatory)]
        [string]$Argument,
        [Parameter(Mandatory)]
        [string]$Label
    )

    if (Test-FactorioRunning) {
        throw "Factorio is already running. Close it and rerun this script."
    }

    Write-Host "`nRunning $Label..." -ForegroundColor Cyan

    $startedUtc = [datetime]::UtcNow.AddSeconds(-1)

    & $FactorioExe --mod-directory $modsDir --disable-audio $Argument

    Wait-ForFactorioDump -StartedUtc $startedUtc -Label $Label
}

if (-not $FactorioExe) {
    $candidates = @(
        (Join-Path ${env:ProgramFiles(x86)} "Steam\steamapps\common\Factorio\bin\x64\factorio.exe"),
        (Join-Path $env:ProgramFiles "Factorio\bin\x64\factorio.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Factorio\bin\x64\factorio.exe")
    ) | Where-Object { $_ -and (Test-Path $_) }

    $FactorioExe = $candidates | Select-Object -First 1
}

if (-not $FactorioExe -or -not (Test-Path $FactorioExe)) {
    throw @"
Could not find factorio.exe.

Run this script again with the full path, for example:
  .\dump-factorio-2.1.12-v2.ps1 -FactorioExe "D:\SteamLibrary\steamapps\common\Factorio\bin\x64\factorio.exe"
"@
}

if (-not (Test-Path $UserDataDir)) {
    throw "Factorio user-data directory does not exist: $UserDataDir"
}

if (Test-FactorioRunning) {
    throw "Factorio is already running. Close it before running this script."
}

$versionText = (& $FactorioExe --version 2>&1 | Out-String).Trim()
Write-Host $versionText

if ($versionText -notmatch '(?m)\b2\.1\.12\b') {
    throw "This script requires Factorio 2.1.12. The detected version was:`n$versionText"
}

$versionDeadline = (Get-Date).AddSeconds(30)
while (Test-FactorioRunning -and (Get-Date) -lt $versionDeadline) {
    Start-Sleep -Milliseconds 500
}
if (Test-FactorioRunning) {
    throw "Factorio remained running after the version check. Close it and rerun."
}

$tempRoot = Join-Path $env:TEMP ("factorio-2.1.12-dump-" + [guid]::NewGuid().ToString("N"))
$modsDir = Join-Path $tempRoot "mods"
$scriptOutput = Join-Path $UserDataDir "script-output"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupOutput = Join-Path $UserDataDir "script-output.backup-$timestamp"

New-Item -ItemType Directory -Path $modsDir -Force | Out-Null

$modList = @{
    mods = @(
        @{ name = "base"; enabled = $true },
        @{ name = "elevated-rails"; enabled = $true },
        @{ name = "quality"; enabled = $true },
        @{ name = "recycler"; enabled = $true },
        @{ name = "space-age"; enabled = $true }
    )
}

$modList |
    ConvertTo-Json -Depth 5 |
    Set-Content -Path (Join-Path $modsDir "mod-list.json") -Encoding utf8

if (Test-Path $scriptOutput) {
    Write-Host "Temporarily backing up existing script-output to:`n$backupOutput"
    Move-Item -Path $scriptOutput -Destination $backupOutput
}

New-Item -ItemType Directory -Path $scriptOutput -Force | Out-Null

$completedSuccessfully = $false

try {
    Invoke-FactorioDump -Argument "--dump-data" -Label "prototype data export"

    $rawDump = Join-Path $scriptOutput "data-raw-dump.json"
    if (-not (Test-Path $rawDump)) {
        throw "The data export completed, but data-raw-dump.json was not created."
    }

    Invoke-FactorioDump -Argument "--dump-prototype-locale" -Label "prototype locale export"

    $localeFiles = Get-ChildItem -Path $scriptOutput -Filter "*-locale.json" -File -ErrorAction SilentlyContinue
    if (@($localeFiles).Count -eq 0) {
        throw "The locale export completed, but no *-locale.json files were created."
    }

    Invoke-FactorioDump -Argument "--dump-icon-sprites" -Label "prototype icon export"

    $iconFiles = Get-ChildItem -Path $scriptOutput -Recurse -Filter "*.png" -File -ErrorAction SilentlyContinue
    if (@($iconFiles).Count -eq 0) {
        throw "The icon export completed, but no PNG icon files were created."
    }

    $versionText | Set-Content -Path (Join-Path $scriptOutput "factorio-version.txt") -Encoding utf8
    Copy-Item (Join-Path $modsDir "mod-list.json") (Join-Path $scriptOutput "mod-list.json")

    if (Test-Path $OutputZip) {
        Remove-Item $OutputZip -Force
    }

    Write-Host "`nCreating archive..." -ForegroundColor Cyan
    Compress-Archive `
        -Path (Join-Path $scriptOutput "*") `
        -DestinationPath $OutputZip `
        -CompressionLevel Optimal

    $completedSuccessfully = $true
    Write-Host "`nCreated:`n$OutputZip" -ForegroundColor Green
}
finally {
    $cleanupDeadline = (Get-Date).AddMinutes(2)
    while (Test-FactorioRunning -and (Get-Date) -lt $cleanupDeadline) {
        Start-Sleep -Milliseconds 500
    }

    if (Test-FactorioRunning) {
        Write-Warning "Factorio is still running. Temporary output was not removed to avoid data loss."
    }
    else {
        if (Test-Path $scriptOutput) {
            Remove-Item $scriptOutput -Recurse -Force
        }

        if (Test-Path $backupOutput) {
            Move-Item -Path $backupOutput -Destination $scriptOutput
            Write-Host "Restored your original script-output folder."
        }

        if (Test-Path $tempRoot) {
            Remove-Item $tempRoot -Recurse -Force
        }
    }

    if (-not $completedSuccessfully) {
        Write-Warning "The export did not complete. See $UserDataDir\factorio-current.log."
    }
}
