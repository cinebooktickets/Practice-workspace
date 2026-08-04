<!-- staged-by: workspace -->
# These hooks belong to EVERY agent, not just one

This is the single copy of the guardrail scripts (dangerous commands, secrets,
TEST-mode fence, session start, progress reminder). Each agent runtime points
here from its own config:

| Runtime | Wired from |
|---|---|
| Claude Code (CLI + VS Code) | `.claude/settings.json` |
| Copilot Chat in VS Code | `.github/hooks/guardrails.json` |
| Copilot CLI | `~/.copilot/hooks/` — installed once per machine by `.workspace/bin/install-copilot-hooks.sh` (automatic inside the dev container) |

That is why deleting `.claude/` does not disarm Copilot, and deleting
`.github/` does not disarm Claude Code.

The hooks **fail open**: if one crashes, the action is allowed rather than
your session bricked — which also means a broken hook is silent. To prove
they are actually firing, run `bash .workspace/bin/doctor.sh`
(or `powershell -File .workspace/bin/doctor.ps1` on Windows without bash).
