#Requires -Version 5.1
<#
.SYNOPSIS
  Install Puppy Omega One (Code Puppy edition) into a target project.
.DESCRIPTION
  Copies templates/ into the target project (AGENTS.md, .code_puppy/agents,
  skills/reflect, docs memory files, .claude settings + commands) and sets
  puppy.cfg compaction_threshold=0.5 and summarization_model to the Haiku
  placeholder. Existing files are skipped unless -Force is passed.
  Prints the manual steps at the end — two of them need you.
.PARAMETER Target
  Project directory to install into. Defaults to the current directory.
.PARAMETER Force
  Overwrite existing files instead of skipping them.
#>
param(
    [string]$Target = ".",
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$TemplatesDir = Join-Path $ScriptDir "templates"
$TargetFull = (Resolve-Path $Target).Path

if (-not (Test-Path $TemplatesDir)) {
    Write-Error "templates/ not found next to this script ($TemplatesDir)."
    exit 1
}

$copied = @()
$skipped = @()
Get-ChildItem -Path $TemplatesDir -Recurse -File | ForEach-Object {
    $relative = $_.FullName.Substring($TemplatesDir.Length + 1)
    $dest = Join-Path $TargetFull $relative
    $destDir = Split-Path -Parent $dest
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    if ((Test-Path $dest) -and -not $Force) {
        $skipped += $relative
    } else {
        Copy-Item -Path $_.FullName -Destination $dest -Force
        $copied += $relative
    }
}

# --- puppy.cfg: compaction_threshold=0.5, summarization_model=Haiku placeholder ---
$CfgPath = Join-Path $TargetFull "puppy.cfg"
$HaikuPlaceholder = "claude-haiku-5-5"
function Set-CfgKey {
    param([string]$Path, [string]$Key, [string]$Value)
    $lines = @()
    if (Test-Path $Path) { $lines = @(Get-Content $Path) }
    $found = $false
    $out = @()
    foreach ($line in $lines) {
        if ($line -match "^\s*$([regex]::Escape($Key))\s*=") {
            $out += "$Key=$Value"
            $found = $true
        } else {
            $out += $line
        }
    }
    if (-not $found) { $out += "$Key=$Value" }
    $out | Set-Content -Path $Path -Encoding utf8
}
Set-CfgKey -Path $CfgPath -Key "compaction_threshold" -Value "0.5"
Set-CfgKey -Path $CfgPath -Key "summarization_model" -Value $HaikuPlaceholder

Write-Host ""
Write-Host "Puppy Omega One installed into $TargetFull"
Write-Host "  copied:  $($copied.Count) files"
if ($skipped.Count -gt 0) {
    Write-Host "  skipped (already exist, use -Force to overwrite):"
    $skipped | ForEach-Object { Write-Host "    - $_" }
}
Write-Host "  puppy.cfg: compaction_threshold=0.5, summarization_model=$HaikuPlaceholder"
Write-Host ""
Write-Host "MANUAL STEPS (do these before your first real run):"
Write-Host "  1. In Code Puppy at work, run /model and note the real Opus / Sonnet /"
Write-Host "     Haiku alias strings. Swap them into .code_puppy/agents/*.json"
Write-Host "     (the `"model`" field, one string per file) and puppy.cfg"
Write-Host "     (summarization_model). The aliases in this repo are PLACEHOLDERS:"
Write-Host "     claude-opus-5-5 / claude-sonnet-5-5 / claude-haiku-5-5."
Write-Host "  2. Set the global model to your Opus alias, or start the session on"
Write-Host "     the omega-orchestrator agent."
Write-Host "  3. VPN on if your Code Puppy models need it (Walmart build)."
Write-Host ""
Write-Host "Then open Code Puppy GUI in this project and run a job — see README.md"
Write-Host "'Run a job' for the walkthrough."
