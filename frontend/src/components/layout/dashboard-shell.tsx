"use client"
import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Bot,
  Headphones,
  Bell,
  CreditCard,
  Users,
  UserCircle,
  ScrollText,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronRight,
} from "lucide-react"
import { useAuth } from "@/context/auth"
import { useTheme } from "@/context/theme"
import { NotificationBell } from "@/components/layout/NotificationBell"

// ─── Nav item definition ──────────────────────────────────────────────────────

type NavItem = {
  label:     string
  href:      string
  icon:      React.ElementType
  adminOnly: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: "Overview",      href: "/dashboard",             icon: LayoutDashboard, adminOnly: false },
  { label: "Agents",        href: "/dashboard/agents",      icon: Bot,             adminOnly: false },
  { label: "Live Support",  href: "/dashboard/live-support",icon: Headphones,      adminOnly: false },
  { label: "Notifications", href: "/dashboard/notifications",icon: Bell,           adminOnly: false },
  { label: "Usage",         href: "/dashboard/usage",       icon: CreditCard,      adminOnly: false },
  { label: "Team",          href: "/dashboard/team",        icon: Users,           adminOnly: false },
  { label: "Profile",       href: "/dashboard/profile",     icon: UserCircle,      adminOnly: false },
  { label: "Audit",         href: "/dashboard/audit",       icon: ScrollText,      adminOnly: true  },
  { label: "Settings",      href: "/dashboard/settings",    icon: Settings,        adminOnly: true  },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

type NavLinkProps = {
  item:    NavItem
  active:  boolean
  allowed: boolean
  onClick: () => void
}

function NavLink({ item, active, allowed, onClick }: NavLinkProps) {
  const Icon = item.icon

  const base =
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors w-full"

  if (!allowed) {
    return (
      <div
        className={`${base} opacity-40 cursor-not-allowed text-sidebar-foreground`}
        title="Admin only"
        aria-disabled="true"
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{item.label}</span>
      </div>
    )
  }

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={
        active
          ? `${base} bg-sidebar-accent text-sidebar-accent-foreground font-medium`
          : `${base} text-sidebar-foreground hover:bg-white/5`
      }
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{item.label}</span>
      {active && <ChevronRight className="ml-auto h-3 w-3 opacity-60" aria-hidden="true" />}
    </Link>
  )
}

// ─── Sidebar content (reused in desktop + mobile) ────────────────────────────

type SidebarContentProps = {
  pathname: string
  isAdmin:  boolean
  onNav:    () => void
  onLogout: () => void
}

function SidebarContent({ pathname, isAdmin, onNav, onLogout }: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <span className="text-base font-bold text-sidebar-foreground tracking-tight">
          Prime<span className="text-sidebar-accent">Assist</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href)
            }
            allowed={!item.adminOnly || isAdmin}
            onClick={onNav}
          />
        ))}
      </nav>

      {/* Logout */}
      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-muted-foreground hover:bg-white/5 hover:text-sidebar-foreground transition-colors"
          aria-label="Log out"
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Log out</span>
        </button>
      </div>
    </div>
  )
}

// ─── DashboardShell ───────────────────────────────────────────────────────────

type Props = {
  children: React.ReactNode
}

export function DashboardShell({ children }: Props) {
  const pathname              = usePathname()
  const { user, logout }      = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const isAdmin = user?.role === "admin"

  const handleNav    = () => setMobileOpen(false)
  const handleLogout = () => { logout() }

  // Close mobile menu on route change
  React.useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex md:w-60 md:flex-col bg-sidebar border-r border-sidebar-border shrink-0">
        <SidebarContent
          pathname={pathname}
          isAdmin={isAdmin}
          onNav={handleNav}
          onLogout={handleLogout}
        />
      </aside>

      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transform transition-transform duration-200 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Mobile navigation"
      >
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
          <span className="text-base font-bold text-sidebar-foreground">
            Prime<span className="text-sidebar-accent">Assist</span>
          </span>
          <button
            onClick={() => setMobileOpen(false)}
            className="text-sidebar-muted-foreground hover:text-sidebar-foreground"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarContent
            pathname={pathname}
            isAdmin={isAdmin}
            onNav={handleNav}
            onLogout={handleLogout}
          />
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Top header */}
        <header className="flex h-14 items-center gap-4 border-b border-border bg-background px-4 md:px-6 shrink-0">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden text-muted-foreground hover:text-foreground"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          {/* Page title via breadcrumb-style path */}
          <div className="flex-1" />

          {/* Notification bell */}
          <NotificationBell />

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
            )}
          </button>

          {/* User avatar */}
          {user && (
            <Link
              href="/dashboard/profile"
              className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-muted transition-colors"
              aria-label="Go to profile"
            >
              {user.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.picture}
                  alt={user.name}
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden") }}
                />
              ) : null}
              <div className={`flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold${user.picture ? " hidden" : ""}`}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:block text-sm font-medium text-foreground max-w-[120px] truncate">
                {user.name}
              </span>
            </Link>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>

      </div>
    </div>
  )
}
