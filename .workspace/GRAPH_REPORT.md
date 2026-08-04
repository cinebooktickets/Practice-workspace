# Graph Report - .  (2026-08-04)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 850 nodes · 1796 edges · 77 communities (44 shown, 33 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fd762e76`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 68 edges
2. `react` - 55 edges
3. `cn()` - 34 edges
4. `Button` - 27 edges
5. `allow` - 24 edges
6. `ApiException` - 23 edges
7. `Badge()` - 20 edges
8. `Skeleton()` - 20 edges
9. `deny` - 18 edges
10. `Card` - 17 edges

## Surprising Connections (you probably didn't know these)
- `CallbackPage()` --references--> `react`  [EXTRACTED]
  frontend/src/app/callback/page.tsx → frontend/package.json
- `ToolDocsButton()` --references--> `react`  [EXTRACTED]
  frontend/src/app/dashboard/agents/[id]/_tabs/integrations-tab.tsx → frontend/package.json
- `LoginPage()` --references--> `react`  [EXTRACTED]
  frontend/src/app/login/page.tsx → frontend/package.json
- `RegisterPage()` --references--> `react`  [EXTRACTED]
  frontend/src/app/register/page.tsx → frontend/package.json
- `SettingsPageContent()` --calls--> `useAuth()`  [EXTRACTED]
  frontend/src/app/dashboard/settings/page.tsx → frontend/src/context/auth.tsx

## Import Cycles
- None detected.

## Communities (77 total, 33 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (91): AcceptInviteRequest, AcceptInviteResponse, agentAnalyticsApi, AgentAnalyticsResponse, AgentAPIKeyCreateRequest, AgentAPIKeyCreateResponse, AgentAPIKeyResponse, agentApiKeysApi (+83 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (36): OverviewStats, StatCardProps, metadata, Props, DashboardShell(), NAV_ITEMS, NavItem, NavLinkProps (+28 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (43): autoprefixer, devDependencies, autoprefixer, jsdom, postcss, tailwindcss, tailwindcss-animate, @testing-library/dom (+35 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (40): AgentToolCallsSectionProps, AUTH_TYPE_LABELS, BODY_TEMPLATE_MODES, CreateErrors, CreateForm, CreateSheetProps, EditErrors, EditForm (+32 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (29): ConfigErrors, ConfigForm, EmbeddingForm, Props, PROVIDER_LABELS, ProviderForm, PreviewProps, Props (+21 more)

### Community 5 - "Community 5"
Cohesion: 0.14
Nodes (27): CreateErrors, CreateForm, Props, MessageThreadDialogProps, Props, ROLE_CLASS, ROLE_ICON, STATUS_LABELS (+19 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (21): NotificationsPage(), timeAgo(), IndustryPage(), Props, FeatureCard, features, FeaturesSection(), HeroSection() (+13 more)

### Community 7 - "Community 7"
Cohesion: 0.17
Nodes (27): addMessage(), addStreamingMessage(), addThinking(), _appendDecorations(), applyBranding(), applyWidgetConfig(), closeAuthModal(), escapeHtml() (+19 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (25): CommFormState, DAY_LABELS, ModelFormState, ModelSectionProps, PendingTabProps, SettingsPageContent(), SettingsTab, TABS (+17 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (26): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+18 more)

### Community 10 - "Community 10"
Cohesion: 0.09
Nodes (9): block(), is_copilot_cli(), jget(), _pb_bare_field(), _pb_first_field(), _pb_get_field(), common.sh script, trace() (+1 more)

### Community 11 - "Community 11"
Cohesion: 0.14
Nodes (26): react, MessageThreadDialog(), CreateIntegrationSheet(), ManageIntegrationSheet(), ToolSheet(), ToolsSection(), ToolTestDialog(), AgentsPage() (+18 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (24): allow, Bash(bash .workspace/bin/doctor.sh*), Bash(bash .workspace/bin/env-protection.sh *), Bash(bash .workspace/bin/install-copilot-hooks.sh*), Bash(bash .workspace/bin/set-mode.sh *), Bash(bash .workspace/bin/sync-graph.sh *), Bash(docker build *), Bash(docker compose *) (+16 more)

### Community 13 - "Community 13"
Cohesion: 0.18
Nodes (15): Props, FieldErrors, ProfileForm, ERROR_MESSAGES, PageState, Avatar, AvatarFallback, AvatarImage (+7 more)

### Community 14 - "Community 14"
Cohesion: 0.13
Nodes (15): EmptyStateProps, formatWaitTime(), InProgressRow(), InProgressRowProps, PendingRow(), PendingRowProps, ReplyDialogProps, ResolveDialogProps (+7 more)

### Community 15 - "Community 15"
Cohesion: 0.11
Nodes (18): deny, Bash(curl * | bash), Bash(curl * | sh), Bash(git push -f *), Bash(git push --force *), Bash(rm -rf /*), Bash(wget * | bash), Bash(wget * | sh) (+10 more)

### Community 16 - "Community 16"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 17 - "Community 17"
Cohesion: 0.22
Nodes (17): addComment(), AUTH, createWorkItem(), fmt(), fs, getWorkItem(), https, IDS_FILE (+9 more)

### Community 18 - "Community 18"
Cohesion: 0.20
Nodes (12): IngestRow(), IngestProgress(), Milestone, MILESTONES, Props, STAGE_ORDER, stageIndex(), IngestProgressState (+4 more)

### Community 19 - "Community 19"
Cohesion: 0.15
Nodes (12): AgentDetailPage(), TABS, TabValue, ApiKeysTab(), formatDate(), ConfigTab(), ConversationsTab(), formatDate() (+4 more)

### Community 20 - "Community 20"
Cohesion: 0.17
Nodes (11): Props, ResolveDialogState, ROLE_CLASS, ROLE_ICON, STATUS_VARIANT, ThreadDialogState, Label, labelVariants (+3 more)

### Community 21 - "Community 21"
Cohesion: 0.21
Nodes (10): ACTION_VARIANTS, ActionVariant, Alert, AlertDescription, AlertProps, AlertTitle, alertVariants, Input (+2 more)

### Community 22 - "Community 22"
Cohesion: 0.26
Nodes (8): MarketingNav(), Button, buttonVariants, Props, Checkbox, Props, Skeleton(), cn()

### Community 23 - "Community 23"
Cohesion: 0.20
Nodes (10): AgentCard(), AgentCardProps, CreateErrors, CreateForm, formatDate(), formatProvider(), ImportEmbeddingForm, PROVIDER_LABELS (+2 more)

### Community 24 - "Community 24"
Cohesion: 0.20
Nodes (7): BubbleProps, ChatPage(), LocalMessage, Role, Props, ProtectedRoute(), dashboardChatApi

### Community 25 - "Community 25"
Cohesion: 0.20
Nodes (9): DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut(), DropdownMenuSubContent (+1 more)

### Community 26 - "Community 26"
Cohesion: 0.22
Nodes (8): env, CLAUDE_CODE_GIT_BASH_PATH, hooks, PreToolUse, SessionStart, Stop, permissions, $schema

### Community 27 - "Community 27"
Cohesion: 0.22
Nodes (8): SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay, SheetTitle, sheetVariants

### Community 28 - "Community 28"
Cohesion: 0.25
Nodes (5): BubbleProps, LocalMessage, Role, SandboxPage(), sandboxChatApi

### Community 29 - "Community 29"
Cohesion: 0.54
Nodes (7): doctor.sh script, bad(), hdr(), note(), ok(), probe(), warn()

### Community 30 - "Community 30"
Cohesion: 0.29
Nodes (7): @auth0/auth0-react, dependencies, @auth0/auth0-react, @radix-ui/react-avatar, @radix-ui/react-slot, @radix-ui/react-avatar, @radix-ui/react-slot

### Community 31 - "Community 31"
Cohesion: 0.38
Nodes (3): Bad(), Ok(), Probe()

### Community 32 - "Community 32"
Cohesion: 0.50
Nodes (5): AgentToolCallsSection(), formatDate(), formatMs(), ToolLogsDialog(), ToolVersionsDialog()

### Community 33 - "Community 33"
Cohesion: 0.40
Nodes (5): formatBytes(), formatDate(), KnowledgeBaseTab(), statusLabel(), statusVariant()

### Community 34 - "Community 34"
Cohesion: 0.60
Nodes (3): entry(), install-copilot-hooks.sh script, usage()

### Community 35 - "Community 35"
Cohesion: 0.90
Nodes (4): pull(), refresh(), restore(), sync-graph.sh script

### Community 37 - "Community 37"
Cohesion: 0.83
Nodes (3): deny_rule(), in_container(), block-dangerous-bash.sh script

### Community 38 - "Community 38"
Cohesion: 1.00
Nodes (3): check_target(), is_test_scope(), enforce-test-mode.sh script

### Community 40 - "Community 40"
Cohesion: 0.67
Nodes (3): AnalyticsTab(), formatDate(), toInputDate()

### Community 41 - "Community 41"
Cohesion: 0.67
Nodes (3): actionBadgeVariant(), AuditPage(), formatDateTime()

### Community 42 - "Community 42"
Cohesion: 0.67
Nodes (3): formatDate(), getInitials(), TeamPage()

## Knowledge Gaps
- **360 isolated node(s):** `$schema`, `CLAUDE_CODE_GIT_BASH_PATH`, `Read(./secrets/**)`, `Read(./**/.env)`, `Read(./**/.env.local)` (+355 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **33 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Community 11` to `Community 32`, `Community 33`, `Community 1`, `Community 3`, `Community 36`, `Community 68`, `Community 6`, `Community 40`, `Community 41`, `Community 42`, `Community 18`, `Community 19`, `Community 22`, `Community 24`, `Community 28`, `Community 30`?**
  _High betweenness centrality (0.158) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Community 30` to `Community 2`, `Community 11`, `Community 45`, `Community 46`, `Community 48`, `Community 49`, `Community 50`, `Community 51`, `Community 52`, `Community 53`, `Community 54`, `Community 55`, `Community 56`, `Community 57`, `Community 58`, `Community 59`, `Community 60`, `Community 61`, `Community 62`, `Community 63`, `Community 64`, `Community 65`, `Community 66`, `Community 67`?**
  _High betweenness centrality (0.148) - this node is a cross-community bridge._
- **Why does `useAuth()` connect `Community 11` to `Community 1`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 8`, `Community 13`, `Community 14`, `Community 19`, `Community 20`, `Community 21`, `Community 23`, `Community 24`, `Community 28`, `Community 32`, `Community 33`, `Community 40`, `Community 41`, `Community 42`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **What connects `$schema`, `CLAUDE_CODE_GIT_BASH_PATH`, `Read(./secrets/**)` to the rest of the system?**
  _360 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.02127659574468085 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.052244897959183675 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.04756871035940803 - nodes in this community are weakly interconnected._