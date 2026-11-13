#Requires -Version 5.1
<#
.SYNOPSIS
  Install Puppy Omega One templates in a user project.
.DESCRIPTION
  Never updates the Code Puppy installation, Python environment, or user-global
  configuration. Refuses protected targets and any reparse-point redirects.
.PARAMETER Target
  Existing project directory (default: current directory).
.PARAMETER Force
  Explicitly overwrite existing project template files only.
#>
param(
    [string]$Target = ".",
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$TemplatesDir = Join-Path $ScriptDir "templates"
if (-not (Test-Path -LiteralPath $TemplatesDir -PathType Container)) {
    throw "templates/ not found next to this script."
}

$TargetItem = Get-Item -LiteralPath $Target -Force
if (-not $TargetItem.PSIsContainer) { throw "Target must be an existing project directory." }
$TargetFull = [IO.Path]::GetFullPath($TargetItem.FullName).TrimEnd('\', '/')
$HomeFull = [IO.Path]::GetFullPath([Environment]::GetFolderPath('UserProfile')).TrimEnd('\', '/')
$Comparison = [StringComparison]::OrdinalIgnoreCase

function Test-InOrAbove([string]$Candidate, [string]$Guarded) {
    $a = [IO.Path]::GetFullPath($Candidate).TrimEnd('\', '/')
    $b = [IO.Path]::GetFullPath($Guarded).TrimEnd('\', '/')
    return $a.Equals($b, $Comparison) -or
        $a.StartsWith($b + '\', $Comparison) -or
        $b.StartsWith($a + '\', $Comparison)
}

function Assert-NoReparsePoint([string]$PathToCheck) {
    $current = [IO.Path]::GetFullPath($PathToCheck)
    while ($current) {
        if (Test-Path -LiteralPath $current) {
            $item = Get-Item -LiteralPath $current -Force
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "Refusing junction or symlink path: $current"
            }
        }
        $parent = [IO.Path]::GetDirectoryName($current)
        if (-not $parent -or $parent -eq $current) { break }
        $current = $parent
    }
}

# Home itself is not a project: installing there would collide with global
# ~/.code_puppy/agents. A project *under* home is allowed.
if ($TargetFull.Equals($HomeFull, $Comparison) -or $HomeFull.StartsWith($TargetFull + '\', $Comparison)) {
    throw "Refusing install into or above the user profile: $TargetFull"
}
$protected = @(
    (Join-Path $HomeFull '.code_puppy'),
    (Join-Path $HomeFull '.code-puppy-venv'),
    (Join-Path $HomeFull '.config\code_puppy'),
    (Join-Path $HomeFull '.config\code-puppy'),
    (Join-Path $HomeFull 'AppData\Roaming\code_puppy'),
    (Join-Path $HomeFull 'puppy_gui'),
    (Join-Path $HomeFull 'projects\puppy_gui')
)
if ($env:XDG_CONFIG_HOME) {
    $protected += (Join-Path $env:XDG_CONFIG_HOME 'code_puppy')
}
if ($env:CODE_PUPPY_PYTHON -and [IO.Path]::IsPathRooted($env:CODE_PUPPY_PYTHON)) {
    $pythonBin = Split-Path -Parent $env:CODE_PUPPY_PYTHON
    $binName = Split-Path -Leaf $pythonBin
    $candidateRoot = Split-Path -Parent $pythonBin
    if (($binName -ieq 'Scripts' -or $binName -ieq 'bin') -and
        (Test-Path -LiteralPath (Join-Path $candidateRoot 'pyvenv.cfg') -PathType Leaf)) {
        $protected += $candidateRoot
    } else {
        $protected += $pythonBin
    }
}
if ($env:PUPPY_GUI_LAUNCH -and [IO.Path]::IsPathRooted($env:PUPPY_GUI_LAUNCH)) {
    $protected += (Split-Path -Parent $env:PUPPY_GUI_LAUNCH)
}
if ($env:PUPPY_GUI_DIR -and [IO.Path]::IsPathRooted($env:PUPPY_GUI_DIR)) {
    $protected += $env:PUPPY_GUI_DIR
}
foreach ($guarded in $protected) {
    if (Test-InOrAbove $TargetFull $guarded) {
        throw "Refusing protected Code Puppy install/config path: $TargetFull"
    }
}
Assert-NoReparsePoint $TargetFull

$files = @(Get-ChildItem -LiteralPath $TemplatesDir -Recurse -File -Force)
foreach ($file in $files) {
    if (($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Refusing template symlink: $($file.FullName)"
    }
    $relative = $file.FullName.Substring($TemplatesDir.Length + 1)
    $dest = Join-Path $TargetFull $relative
    Assert-NoReparsePoint $dest
}

$copied = @()
$skipped = @()
foreach ($file in $files) {
    $relative = $file.FullName.Substring($TemplatesDir.Length + 1)
    $dest = Join-Path $TargetFull $relative
    if ((Test-Path -LiteralPath $dest) -and -not $Force) {
        $skipped += $relative
        continue
    }
    $destDir = Split-Path -Parent $dest
    if (-not (Test-Path -LiteralPath $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    Copy-Item -LiteralPath $file.FullName -Destination $dest -Force
    $copied += $relative
}

Write-Host "Puppy Omega One installed into $TargetFull"
Write-Host "  copied: $($copied.Count) files, skipped: $($skipped.Count)"
Write-Host "Only project templates were copied. No global Code Puppy files were edited."
Write-Host "Verify available models via /model and update this project's agent JSON as needed."
Write-Host "Starting Puppy GUI is a separate, explicit action in the desktop app."
