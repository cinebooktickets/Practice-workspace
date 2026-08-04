# staged-by: workspace
<#
  doctor.ps1 - PowerShell twin of doctor.sh.

  WHY THIS EXISTS: the developers most likely to have broken guardrails are the
  ones who cannot run doctor.sh. GitHub Copilot Chat's terminal on Windows is
  PowerShell with no bash on PATH (verified live), and the most common Windows
  failure - Git installed somewhere other than C:\Program Files\Git - takes out
  every hook precisely because bash cannot be launched. A health check written
  only in bash would be unavailable exactly when it is needed most.

      powershell -File .workspace/bin/doctor.ps1

  Exits 0 when nothing is broken, 1 when at least one check FAILs.
  Written for Windows PowerShell 5.1, which is what stock Windows ships.
#>

$ErrorActionPreference = 'Continue'
Set-Location (Join-Path $PSScriptRoot '..\..')
$repo = (Get-Location).Path

$script:nOk = 0; $script:nWarn = 0; $script:nBad = 0
function Ok   ($m)      { Write-Host "  [ OK ]  $m";                                  $script:nOk++ }
function Warn ($m, $fx) { Write-Host "  [WARN]  $m"; Write-Host "          -> $fx";   $script:nWarn++ }
function Bad  ($m, $fx) { Write-Host "  [FAIL]  $m"; Write-Host "          -> $fx";   $script:nBad++ }
function Note ($m)      { Write-Host "          $m" }
function Hdr  ($m)      { Write-Host ''; Write-Host $m }

Write-Host 'Workspace doctor'
Write-Host "  repo:     $repo"
Write-Host '  platform: windows (PowerShell)'

# --- Seeding ----------------------------------------------------------------
Hdr 'Seeding'
$seeded = Test-Path '.workspace/config'
if ($seeded) {
  Ok '.workspace/config present - this repo is seeded'
} else {
  Bad '.workspace/config is missing - the TEST fence and mode system are INERT here' `
      'Either this repo was never seeded, or the file was deleted. Re-run initiate.sh from the workspace, or restore it: git checkout .workspace/config'
}

# --- Hook scripts -----------------------------------------------------------
Hdr 'Hook scripts'
$needed = @('session-start.sh','block-dangerous-bash.sh','protect-sensitive-files.sh',
            'enforce-test-mode.sh','progress-reminder.sh','lib/common.sh')
$missing = @($needed | Where-Object { -not (Test-Path ".workspace/hooks/$_") })
if ($missing.Count -gt 0) {
  Bad ("hook scripts missing: " + ($missing -join ' ')) `
      'Re-run initiate.sh from the workspace to restore .workspace/hooks/, or: git checkout .workspace/hooks'
} else {
  Ok 'all 6 hook scripts present'
}

# CRLF is the quietest way to lose every guardrail at once: bash cannot execute
# a script whose shebang ends in CR, the hook process dies, and fail-open turns
# that into "allowed" with no message anywhere. A Windows clone of a repo with
# no .gitattributes produces exactly this, which is why the check leads here.
$crlf = @()
foreach ($p in @('.workspace/hooks/*.sh', '.workspace/hooks/lib/*.sh', '.workspace/bin/*.sh')) {
  foreach ($f in (Get-ChildItem -Path $p -ErrorAction SilentlyContinue)) {
    $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
    $limit = [Math]::Min(200, $bytes.Length)
    for ($i = 0; $i -lt $limit; $i++) {
      if ($bytes[$i] -eq 13) { $crlf += $f.Name; break }
      if ($bytes[$i] -eq 10) { break }
    }
  }
}
if ($crlf.Count -gt 0) {
  Bad ("CRLF line endings in: " + (($crlf | Select-Object -Unique) -join ' ') + " - bash cannot run these, so every guardrail fails open silently") `
      'Repair with: git config core.autocrlf false; git rm --cached -r .; git reset --hard   (this repo ships a .gitattributes that prevents it on fresh clones)'
} else {
  Ok 'hook scripts have Unix line endings'
}

# --- Claude Code ------------------------------------------------------------
Hdr 'Claude Code (CLI and VS Code extension)'
if (Test-Path '.claude/settings.json') {
  if (Select-String -Path '.claude/settings.json' -Pattern '"hooks"' -Quiet) {
    Ok '.claude/settings.json wires the hooks'
  } else {
    Bad '.claude/settings.json has no "hooks" section - Claude Code enforces nothing here' `
        'Re-run initiate.sh from the workspace, or restore the file: git checkout .claude/settings.json'
  }
} else {
  Bad '.claude/settings.json missing - Claude Code enforces nothing here' `
      'Re-run initiate.sh from the workspace.'
}

# --- Copilot Chat in VS Code ------------------------------------------------
Hdr 'GitHub Copilot Chat (VS Code)'
if (Test-Path '.github/hooks/guardrails.json') {
  Ok '.github/hooks/guardrails.json present'
  try   { Get-Content '.github/hooks/guardrails.json' -Raw | ConvertFrom-Json | Out-Null }
  catch { Bad '.github/hooks/guardrails.json is not valid JSON' `
              'VS Code ignores the whole file when it cannot parse it. Restore it from the workspace.' }
} else {
  Bad '.github/hooks/guardrails.json missing - Copilot Chat enforces nothing here' `
      'Re-run initiate.sh from the workspace.'
}
Note 'Not verifiable from here: VS Code agent hooks are a Preview feature behind the'
Note 'chat.tools.hooks.enabled setting. The seeded dev container sets it at container'
Note 'scope, but VS Code may not honor a Preview flag there - if hooks stay silent,'
Note 'enable it in your User settings. When the switch is off, Copilot Chat runs with'
Note 'NO hook enforcement and says nothing about it - the instruction files in'
Note '.github/ are then the only thing holding the line.'

# --- Copilot CLI ------------------------------------------------------------
Hdr 'GitHub Copilot CLI'
$copilotHome = $env:COPILOT_HOME
if (-not $copilotHome) { $copilotHome = Join-Path $env:USERPROFILE '.copilot' }
$cdir  = Join-Path $copilotHome 'hooks'
$found = $null
if (Test-Path $cdir) {
  foreach ($f in (Get-ChildItem -Path (Join-Path $cdir '*.json') -ErrorAction SilentlyContinue)) {
    $body = Get-Content $f.FullName -Raw
    # the installed config carries this repo's absolute path, in JSON escaping
    if ($body -match [Regex]::Escape($repo.Replace('\','\\')) -or $body -match [Regex]::Escape($repo.Replace('\','/'))) {
      $found = $f.FullName; break
    }
  }
}
if ($found) {
  Ok "guardrails installed for THIS repo ($found)"
  $body = Get-Content $found -Raw
  $gone = @()
  foreach ($m in ([Regex]::Matches($body, '[A-Za-z]:[\\/][^"]*?\.workspace[\\/]hooks[\\/][a-z-]+\.sh'))) {
    $p = $m.Value -replace '\\\\', '\'
    if (-not (Test-Path $p)) { $gone += $p }
  }
  if ($gone.Count -gt 0) {
    Bad ("the installed config points at hook scripts that do not exist: " + (($gone | Select-Object -Unique) -join ' ')) `
        'Re-run: bash .workspace/bin/install-copilot-hooks.sh'
  }
} elseif (Get-Command copilot -ErrorAction SilentlyContinue) {
  Warn 'Copilot CLI is installed but has NO guardrails for this repo' `
       'The CLI reads hooks only from ~/.copilot/hooks, never from the repo, so this is a per-machine step. Run once: bash .workspace/bin/install-copilot-hooks.sh'
} else {
  Ok 'Copilot CLI is not installed - nothing to wire'
}

# --- The bash the hook configs launch ---------------------------------------
Hdr 'The bash that hook configs launch'
$bash = $env:CLAUDE_CODE_GIT_BASH_PATH
if (-not $bash) { $bash = 'C:\Program Files\Git\bin\bash.exe' }
if (Test-Path $bash) {
  Ok "$bash exists (this is what .github/hooks/*.json and Claude Code invoke)"
} else {
  $onPath = (Get-Command bash -ErrorAction SilentlyContinue)
  $where  = if ($onPath) { $onPath.Source } else { 'not on PATH either' }
  Bad "bash not found at $bash - every VS Code and Copilot CLI hook fails to launch, silently" `
      "Install Git for Windows to the default location, or point the `"windows`" command in .github/hooks/*.json and CLAUDE_CODE_GIT_BASH_PATH in .claude/settings.json at your own bash.exe (currently: $where)"
}

# --- Session mode -----------------------------------------------------------
Hdr 'Session mode'
$ttlh = 8
if ($env:WORKSPACE_MODE_TTL_HOURS -match '^\d+$') { $ttlh = [int]$env:WORKSPACE_MODE_TTL_HOURS }
$mf = '.workspace/local/mode'
if ($env:WORKSPACE_MODE) {
  switch -Regex ($env:WORKSPACE_MODE) {
    '^(?i)dev$'  { Ok 'DEV - set by the WORKSPACE_MODE environment variable';  break }
    '^(?i)test$' { Ok 'TEST - set by the WORKSPACE_MODE environment variable'; break }
    default {
      Bad "WORKSPACE_MODE='$($env:WORKSPACE_MODE)' is not a valid mode, so this session silently falls back to TEST" `
          'The only accepted values are DEV and TEST. Fix the variable, or clear it and use set-mode.ps1 instead.'
    }
  }
} elseif (Test-Path $mf) {
  $mode = ''; $ts = ''
  foreach ($line in (Get-Content $mf)) {
    if ($line -match '^mode=(.*)$') { $mode = $Matches[1].Trim().ToUpper() }
    if ($line -match '^ts=(.*)$')   { $ts   = $Matches[1].Trim() }
  }
  $now  = [int][DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  $age  = if ($ts -match '^\d+$') { $now - [int]$ts } else { [int]::MaxValue }
  if ($mode -eq 'DEV' -and $age -le ($ttlh * 3600)) {
    Ok ("DEV - full development; expires in " + [int](($ttlh * 3600 - $age) / 60) + ' min')
  } elseif ($mode -eq 'DEV') {
    Warn "TEST - the mode file asks for DEV but the grant has EXPIRED ($ttlh h limit)" `
         'This is why source edits are being blocked. Re-run: powershell -File .workspace/bin/set-mode.ps1 DEV'
  } else {
    Ok 'TEST - only test-scope files may be created or edited'
  }
} else {
  Ok 'TEST - the fail-safe default, until someone chooses a mode this session'
}

# --- Secrets policy ---------------------------------------------------------
Hdr 'Secrets policy'
if ((Test-Path '.workspace/config') -and
    (Select-String -Path '.workspace/config' -Pattern '^\s*ENV_PROTECTION\s*=\s*(false|off|0)\s*$' -Quiet)) {
  Warn 'ENV_PROTECTION is OFF - agents may read and edit .env files in this repo' `
       'Deliberate for repos that commit .env as ordinary non-sensitive config. Re-enable with: bash .workspace/bin/env-protection.sh on   (then restart the agent session - read permissions load at startup)'
} else {
  Ok 'ENV_PROTECTION on - .env files are neither readable nor editable by agents'
}

# --- Code graph -------------------------------------------------------------
Hdr 'Code graph'
if (Test-Path '.workspace/graph.json') {
  $stale = ''
  if (-not (Test-Path '.workspace/graph-stamp')) {
    $stale = 'no build stamp'
  } else {
    $stamp = (Get-Content '.workspace/graph-stamp' -Raw).Trim()
    git cat-file -e $stamp 2>$null
    if ($LASTEXITCODE -ne 0) {
      $stale = 'the commit it was built from is not in this clone'
    } else {
      $changed = @(git diff --name-only "$stamp..HEAD" 2>$null |
                   Where-Object { $_ -notmatch '^(\.workspace/|\.claude/|\.github/|\.agents/)' -and $_ -notmatch '\.md$' })
      if ($changed.Count -gt 0) { $stale = 'code has changed since it was built' }
    }
  }
  if (-not $stale) {
    Ok 'present and current'
  } elseif (Get-Command graphify -ErrorAction SilentlyContinue) {
    Warn "stale ($stale)" 'Refresh with: bash .workspace/bin/sync-graph.sh refresh'
  } elseif (Test-Path '.devcontainer') {
    Warn "stale ($stale) - graphify is not installed in this environment" `
         'This repo ships a dev container with graphify preinstalled. Reopen in Container, then: bash .workspace/bin/sync-graph.sh refresh'
  } else {
    Warn "stale ($stale), and it cannot be rebuilt here - graphify is not installed" `
         'This repo carries no dev container (seeded before containers were added). Ask the lead to re-run initiate.sh from the workspace, which now stages one. Meanwhile use the graph for orientation and confirm anything load-bearing against the source.'
  }
} else {
  Ok 'no code graph in this repo (optional)'
}

# --- Live fire --------------------------------------------------------------
# Every check above inspects configuration. This one runs the actual hooks
# against known-bad input and reads what they decide - the only check that can
# prove the chain works end to end rather than merely looking correct. It also
# exercises the exact bash-launch path VS Code uses, which is where the most
# common Windows breakage lives.
Hdr 'Live fire - do the hooks actually deny?'
function Probe ($label, $script, $payload, $envName, $envValue) {
  if (-not (Test-Path ".workspace/hooks/$script")) {
    Bad "$label - $script is missing" 'See the hook-scripts section above.'; return
  }
  if (-not (Test-Path $bash)) {
    Bad "$label - cannot run: bash was not found at $bash" 'Fix the bash path above first; until then no hook can execute at all.'; return
  }
  $saved = $null; $had = $false
  if ($envName) {
    $had = Test-Path "env:$envName"
    if ($had) { $saved = (Get-Item "env:$envName").Value }
    Set-Item "env:$envName" $envValue
  }
  $payload | & $bash ".workspace/hooks/$script" 2>$null 1>$null
  $rc = $LASTEXITCODE
  if ($envName) {
    if ($had) { Set-Item "env:$envName" $saved } else { Remove-Item "env:$envName" -ErrorAction SilentlyContinue }
  }
  if ($rc -eq 2) {
    Ok "$label - denied"
  } else {
    Bad "$label - NOT denied (the hook exited $rc)" `
        'Enforcement is not working. Fix any [FAIL] above and re-run; if there are none, the hook itself is broken - restore .workspace/hooks from the workspace.'
  }
}
Probe 'dangerous command (rm -rf /)' 'block-dangerous-bash.sh' `
      '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"}}' $null $null
Probe 'private key write (keys/id_rsa)' 'protect-sensitive-files.sh' `
      '{"tool_name":"Write","tool_input":{"file_path":"keys/id_rsa"}}' $null $null
if ($seeded) {
  Probe 'TEST-mode fence (source edit)' 'enforce-test-mode.sh' `
        '{"tool_name":"Write","tool_input":{"file_path":"src/doctor-probe.js"}}' 'WORKSPACE_MODE' 'TEST'
} else {
  Note 'TEST-mode fence not probed: this repo is not seeded, so the fence is inert by design.'
}

# --- Verdict ----------------------------------------------------------------
Write-Host ''
Write-Host '--------------------------------------------------------------'
Write-Host "$($script:nOk) OK | $($script:nWarn) warning(s) | $($script:nBad) failure(s)"
if ($script:nBad -gt 0) {
  Write-Host 'Guardrails are NOT fully working in this repo. Fix the [FAIL] items above.'
  exit 1
}
if ($script:nWarn -gt 0) {
  Write-Host 'Guardrails are working. The warnings are things to know about, not breakage.'
} else {
  Write-Host 'Guardrails are fully wired.'
}
exit 0
