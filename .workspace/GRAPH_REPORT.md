# Graph Report - .  (2026-08-04)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 923 nodes · 1930 edges · 87 communities (53 shown, 34 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e6d99b2f`
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
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 68 edges
2. `react` - 55 edges
3. `cn()` - 34 edges
4. `Button` - 27 edges
5. `allow` - 24 edges
6. `ApiException` - 24 edges
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

## Communities (87 total, 34 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (87): AcceptInviteRequest, AcceptInviteResponse, agentAnalyticsApi, AgentAnalyticsResponse, AgentAPIKeyCreateRequest, AgentAPIKeyCreateResponse, AgentAPIKeyResponse, agentApiKeysApi (+79 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (32): metadata, Props, NAV_ITEMS, NavItem, NavLinkProps, Props, SidebarContentProps, NotificationBell() (+24 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (43): autoprefixer, devDependencies, autoprefixer, jsdom, postcss, tailwindcss, tailwindcss-animate, @testing-library/dom (+35 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (35): AgentToolCallsSectionProps, AUTH_TYPE_LABELS, BODY_TEMPLATE_MODES, CreateErrors, CreateForm, CreateSheetProps, EditErrors, EditForm (+27 more)

### Community 4 - "Community 4"
Cohesion: 0.17
Nodes (25): CreateErrors, CreateForm, Props, IngestRowProps, Props, CreateTeamForm, InviteErrors, InviteForm (+17 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (15): DashboardPage(), OverviewStats, StatCardProps, agentExportImportApi, agentsApi, creditsApi, handoffApi, mockUseAuth (+7 more)

### Community 6 - "Community 6"
Cohesion: 0.17
Nodes (27): addMessage(), addStreamingMessage(), addThinking(), _appendDecorations(), applyBranding(), applyWidgetConfig(), closeAuthModal(), escapeHtml() (+19 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (26): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+18 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (9): block(), is_copilot_cli(), jget(), _pb_bare_field(), _pb_first_field(), _pb_get_field(), common.sh script, trace() (+1 more)

### Community 9 - "Community 9"
Cohesion: 0.14
Nodes (19): Props, ACTION_VARIANTS, ActionVariant, ERROR_MESSAGES, PageState, Alert, AlertDescription, AlertProps (+11 more)

### Community 10 - "Community 10"
Cohesion: 0.12
Nodes (16): IndustryPage(), Props, FeatureCard, features, FeaturesSection(), HeroSection(), CTASection(), HowItWorksSection() (+8 more)

### Community 11 - "Community 11"
Cohesion: 0.10
Nodes (19): ConfigErrors, ConfigForm, EmbeddingForm, Props, PROVIDER_LABELS, ProviderForm, PreviewProps, Props (+11 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (24): allow, Bash(bash .workspace/bin/doctor.sh*), Bash(bash .workspace/bin/env-protection.sh *), Bash(bash .workspace/bin/install-copilot-hooks.sh*), Bash(bash .workspace/bin/set-mode.sh *), Bash(bash .workspace/bin/sync-graph.sh *), Bash(docker build *), Bash(docker compose *) (+16 more)

### Community 13 - "Community 13"
Cohesion: 0.16
Nodes (23): react, MessageThreadDialog(), CreateIntegrationSheet(), ManageIntegrationSheet(), ToolSheet(), ToolsSection(), ToolTestDialog(), AgentsPage() (+15 more)

### Community 14 - "Community 14"
Cohesion: 0.09
Nodes (20): CommFormState, DAY_LABELS, ModelFormState, ModelSectionProps, PendingTabProps, SettingsPageContent(), SettingsTab, TABS (+12 more)

### Community 15 - "Community 15"
Cohesion: 0.11
Nodes (16): SettingsPage(), alertConfigApi, communicationApi, embeddingSettingsApi, llmSettingsApi, reportScheduleApi, adminAuth, EMB_DATA (+8 more)

### Community 16 - "Community 16"
Cohesion: 0.15
Nodes (14): IngestProgress(), Milestone, MILESTONES, Props, STAGE_ORDER, stageIndex(), Badge(), badgeVariants (+6 more)

### Community 17 - "Community 17"
Cohesion: 0.11
Nodes (18): deny, Bash(curl * | bash), Bash(curl * | sh), Bash(git push -f *), Bash(git push --force *), Bash(rm -rf /*), Bash(wget * | bash), Bash(wget * | sh) (+10 more)

### Community 18 - "Community 18"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 19 - "Community 19"
Cohesion: 0.22
Nodes (17): addComment(), AUTH, createWorkItem(), fmt(), fs, getWorkItem(), https, IDS_FILE (+9 more)

### Community 20 - "Community 20"
Cohesion: 0.14
Nodes (15): AgentDetailPage(), TABS, TabValue, ApiKeysTab(), formatDate(), ConfigTab(), ConversationsTab(), formatDate() (+7 more)

### Community 21 - "Community 21"
Cohesion: 0.15
Nodes (9): IngestRow(), IngestProgressState, IngestStage, stageToProgress(), useIngestProgress(), documentsApi, ESListener, HookHarness() (+1 more)

### Community 22 - "Community 22"
Cohesion: 0.17
Nodes (10): FieldErrors, getInitials(), ProfileForm, ProfilePage(), Avatar, AvatarFallback, AvatarImage, profileApi (+2 more)

### Community 23 - "Community 23"
Cohesion: 0.16
Nodes (13): MessageThreadDialogProps, Props, ROLE_CLASS, ROLE_ICON, STATUS_LABELS, STATUS_VARIANT, SelectContent, SelectItem (+5 more)

### Community 24 - "Community 24"
Cohesion: 0.18
Nodes (11): AgentCard(), AgentCardProps, CreateErrors, CreateForm, formatDate(), formatProvider(), ImportEmbeddingForm, PROVIDER_LABELS (+3 more)

### Community 25 - "Community 25"
Cohesion: 0.16
Nodes (10): EmptyStateProps, formatWaitTime(), InProgressRow(), InProgressRowProps, PendingRow(), PendingRowProps, ReplyDialogProps, ResolveDialogProps (+2 more)

### Community 26 - "Community 26"
Cohesion: 0.20
Nodes (7): BubbleProps, LocalMessage, Role, SandboxPage(), Props, ProtectedRoute(), sandboxChatApi

### Community 27 - "Community 27"
Cohesion: 0.20
Nodes (9): Props, ResolveDialogState, ROLE_CLASS, ROLE_ICON, STATUS_VARIANT, ThreadDialogState, Label, labelVariants (+1 more)

### Community 28 - "Community 28"
Cohesion: 0.24
Nodes (5): BubbleProps, ChatPage(), LocalMessage, Role, dashboardChatApi

### Community 29 - "Community 29"
Cohesion: 0.20
Nodes (9): DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut(), DropdownMenuSubContent (+1 more)

### Community 30 - "Community 30"
Cohesion: 0.22
Nodes (8): env, CLAUDE_CODE_GIT_BASH_PATH, hooks, PreToolUse, SessionStart, Stop, permissions, $schema

### Community 31 - "Community 31"
Cohesion: 0.22
Nodes (8): SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay, SheetTitle, sheetVariants

### Community 32 - "Community 32"
Cohesion: 0.22
Nodes (7): agentToolCallsApi, IntegrationResponse, integrationsApi, IntegrationToolResponse, integrationToolsApi, INTEGRATION, TOOL

### Community 33 - "Community 33"
Cohesion: 0.22
Nodes (7): ConversationItem, conversationsApi, ConversationSearchResult, MessageOut, CONVERSATIONS, MESSAGES, SEARCH_RESULTS

### Community 34 - "Community 34"
Cohesion: 0.54
Nodes (7): doctor.sh script, bad(), hdr(), note(), ok(), probe(), warn()

### Community 35 - "Community 35"
Cohesion: 0.29
Nodes (7): @auth0/auth0-react, clsx, dependencies, @auth0/auth0-react, clsx, @radix-ui/react-slot, @radix-ui/react-slot

### Community 36 - "Community 36"
Cohesion: 0.38
Nodes (3): Bad(), Ok(), Probe()

### Community 37 - "Community 37"
Cohesion: 0.50
Nodes (5): AgentToolCallsSection(), formatDate(), formatMs(), ToolLogsDialog(), ToolVersionsDialog()

### Community 38 - "Community 38"
Cohesion: 0.40
Nodes (5): formatBytes(), formatDate(), KnowledgeBaseTab(), statusLabel(), statusVariant()

### Community 39 - "Community 39"
Cohesion: 0.50
Nodes (4): NotificationsPage(), timeAgo(), DashboardShell(), NotificationItem

### Community 40 - "Community 40"
Cohesion: 0.40
Nodes (3): feedbackApi, FeedbackItem, FEEDBACK_ITEMS

### Community 41 - "Community 41"
Cohesion: 0.60
Nodes (3): entry(), install-copilot-hooks.sh script, usage()

### Community 42 - "Community 42"
Cohesion: 0.90
Nodes (4): pull(), refresh(), restore(), sync-graph.sh script

### Community 43 - "Community 43"
Cohesion: 0.83
Nodes (3): deny_rule(), in_container(), block-dangerous-bash.sh script

### Community 44 - "Community 44"
Cohesion: 1.00
Nodes (3): check_target(), is_test_scope(), enforce-test-mode.sh script

### Community 46 - "Community 46"
Cohesion: 0.67
Nodes (3): AnalyticsTab(), formatDate(), toInputDate()

### Community 47 - "Community 47"
Cohesion: 0.67
Nodes (3): actionBadgeVariant(), AuditPage(), formatDateTime()

### Community 48 - "Community 48"
Cohesion: 0.67
Nodes (3): formatDate(), getInitials(), TeamPage()

## Knowledge Gaps
- **387 isolated node(s):** `$schema`, `CLAUDE_CODE_GIT_BASH_PATH`, `Read(./secrets/**)`, `Read(./**/.env)`, `Read(./**/.env.local)` (+382 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Community 13` to `Community 1`, `Community 3`, `Community 5`, `Community 10`, `Community 20`, `Community 21`, `Community 22`, `Community 26`, `Community 28`, `Community 35`, `Community 37`, `Community 38`, `Community 39`, `Community 46`, `Community 47`, `Community 48`, `Community 74`, `Community 75`, `Community 76`?**
  _High betweenness centrality (0.156) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Community 35` to `Community 2`, `Community 13`, `Community 51`, `Community 53`, `Community 54`, `Community 55`, `Community 56`, `Community 57`, `Community 58`, `Community 59`, `Community 60`, `Community 61`, `Community 62`, `Community 63`, `Community 64`, `Community 65`, `Community 66`, `Community 67`, `Community 68`, `Community 69`, `Community 70`, `Community 71`, `Community 72`, `Community 73`?**
  _High betweenness centrality (0.141) - this node is a cross-community bridge._
- **Why does `useAuth()` connect `Community 13` to `Community 1`, `Community 3`, `Community 4`, `Community 5`, `Community 9`, `Community 11`, `Community 14`, `Community 20`, `Community 22`, `Community 23`, `Community 24`, `Community 25`, `Community 26`, `Community 27`, `Community 28`, `Community 37`, `Community 38`, `Community 39`, `Community 46`, `Community 47`, `Community 48`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **What connects `$schema`, `CLAUDE_CODE_GIT_BASH_PATH`, `Read(./secrets/**)` to the rest of the system?**
  _387 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.022222222222222223 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.057971014492753624 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.04756871035940803 - nodes in this community are weakly interconnected._