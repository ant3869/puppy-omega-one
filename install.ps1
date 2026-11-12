#Requires -Version 5.1
<#
.SYNOPSIS
  Install Puppy Omega One (Code Puppy edition) into a target project.
.DESCRIPTION
  Copies templates/ into the target project (AGENTS.md, .code_puppy/agents,
  skills/reflect, docs memory files, .claude settings + commands).
  Existing files are skipped unless -Force is passed. The user's global Code
  Puppy configuration is never changed by a project installer.
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

# Code Puppy stores puppy.cfg in the user's config directory, not the project.
# Never silently modify global model or compaction settings during installation.

Write-Host ""
Write-Host "Puppy Omega One installed into $TargetFull"
Write-Host "  copied:  $($copied.Count) files"
if ($skipped.Count -gt 0) {
    Write-Host "  skipped (already exist, use -Force to overwrite):"
    $skipped | ForEach-Object { Write-Host "    - $_" }
}
Write-Host ""
Write-Host "MANUAL STEPS (do these before your first real run):"
Write-Host "  1. In your Code Puppy installation, run /model and note the real Opus / Sonnet /"
Write-Host "     Haiku alias strings. Swap them into .code_puppy/agents/*.json"
Write-Host "     (the `"model`" field, one string per file). Aliases are PLACEHOLDERS:"
Write-Host "     claude-opus-5-5 / claude-sonnet-5-5 / claude-haiku-5-5."
Write-Host "  2. Optional: in Code Puppy, use /set compaction_threshold 0.5 and"
Write-Host "     /set summarization_model <your real Haiku alias>. These are GLOBAL"
Write-Host "     settings, not project settings. Check your existing values first."
Write-Host "  3. Select the omega-orchestrator agent and confirm its Opus model."
Write-Host "  4. Connect to any network required by your model provider."
Write-Host ""
Write-Host "Then open Code Puppy GUI in this project and run a job — see README.md"
Write-Host "'Run a job' for the walkthrough."
