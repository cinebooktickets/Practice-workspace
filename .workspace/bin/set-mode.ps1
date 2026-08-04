# staged-by: workspace
# PowerShell twin of set-mode.sh.
#
# WHY THIS EXISTS: GitHub Copilot Chat's terminal on Windows is PowerShell with
# no `bash` on PATH. Verified live - Copilot tried `bash .workspace/bin/set-mode.sh TEST`,
# reported "bash is not available in the current Windows shell", and could not
# switch modes at all. A guardrail whose escape hatch cannot be reached on the
# platform most developers use is a guardrail that gets torn out.
#
#   powershell -File .workspace/bin/set-mode.ps1 DEV      (or TEST)
#
# Deliberately pure ASCII and PowerShell 5.1 compatible: stock Windows ships
# powershell.exe 5.1 (not pwsh), and it decodes .ps1 as the system ANSI codepage
# unless the file carries a BOM - so non-ASCII punctuation here becomes a parser
# error rather than a character. Measured, on this repo's own doctor.ps1.
param(
  [Parameter(Mandatory = $true)]
  [string]$Mode
)

$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..\..')

# A [ValidateSet] emits a full ParameterBindingValidationException stack trace
# for a typo like "DEv", which reads as a broken script rather than a mistyped
# argument. One clear line beats twenty lines of .NET exception.
$Mode = $Mode.Trim().ToUpper()
if ($Mode -ne 'DEV' -and $Mode -ne 'TEST') {
  Write-Host "usage: powershell -File .workspace/bin/set-mode.ps1 DEV|TEST"
  Write-Host "  got '$Mode' - the only accepted values are DEV and TEST"
  Write-Host "  DEV  = full development: features, bug fixes, source changes"
  Write-Host "  TEST = tests only; source stays untouched (enforced by hooks)"
  exit 1
}

$dir  = '.workspace/local'
$file = Join-Path $dir 'mode'
New-Item -ItemType Directory -Force -Path $dir | Out-Null

# Preserve the session id stamped by the session-start hook, exactly as the bash
# version does. It is provenance only - the DEV grant expires on its timestamp
# whether or not a session id is present.
$session = ''
if (Test-Path $file) {
  foreach ($line in (Get-Content $file -ErrorAction SilentlyContinue)) {
    if ($line -match '^session=(.*)$') { $session = $Matches[1].Trim() }
  }
}

# Culture-independent epoch seconds. `Get-Date -UFormat %s` renders using the
# CURRENT culture, so under a comma-decimal locale [double]::Parse reads
# "1754006400.5" as a vastly larger integer - or throws under
# $ErrorActionPreference='Stop', leaving the mode file unwritten and the
# developer staring at a type-conversion error instead of a workspace message.
$epoch = New-Object DateTime(1970, 1, 1, 0, 0, 0, [DateTimeKind]::Utc)
$ts    = [int]([DateTime]::UtcNow - $epoch).TotalSeconds

# WriteAllText, not Set-Content: Set-Content joins array elements with
# [Environment]::NewLine, i.e. CRLF on Windows. The bash hooks that READ this
# file run under MSYS sed on the host (which strips the CR) but under GNU sed in
# a container (which does not), so a CRLF mode file resolves to "DEV\r", never
# equals "DEV", and silently pins the developer in TEST while reporting DEV.
# The reader strips CR as well now; writing LF means it never arises.
$text = "mode=$Mode`nsession=$session`nts=$ts`n"
[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location).Path $file),
  $text,
  (New-Object System.Text.ASCIIEncoding))

Write-Output "Session mode: $Mode"
if ($Mode -eq 'TEST') {
  Write-Output 'TEST: only test-scope files may be created/edited; record blockers in .workspace/PROGRESS.md instead of touching source.'
} else {
  Write-Output 'DEV: full development. Secrets and dangerous-command guardrails remain active.'
}
Write-Output 'Check enforcement any time with: powershell -File .workspace/bin/doctor.ps1'
