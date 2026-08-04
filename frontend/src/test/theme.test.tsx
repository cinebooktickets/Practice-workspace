import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"
import { ThemeProvider, useTheme } from "@/context/theme"

// ─── Minimal consumer component for testing the hook ─────────────────────────

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={toggleTheme}>toggle</button>
    </div>
  )
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ThemeProvider / useTheme", () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove("dark")
    // Default: no system preference
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  it("defaults to light theme when no preference stored", () => {
    render(<ThemeToggle />, { wrapper: Wrapper })
    expect(screen.getByTestId("theme").textContent).toBe("light")
  })

  it("restores dark theme from localStorage", () => {
    localStorage.setItem("pa_theme", "dark")
    render(<ThemeToggle />, { wrapper: Wrapper })
    expect(screen.getByTestId("theme").textContent).toBe("dark")
  })

  it("toggles from light to dark", async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />, { wrapper: Wrapper })
    await user.click(screen.getByRole("button", { name: "toggle" }))
    expect(screen.getByTestId("theme").textContent).toBe("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })

  it("toggles back from dark to light", async () => {
    localStorage.setItem("pa_theme", "dark")
    const user = userEvent.setup()
    render(<ThemeToggle />, { wrapper: Wrapper })
    await user.click(screen.getByRole("button", { name: "toggle" }))
    expect(screen.getByTestId("theme").textContent).toBe("light")
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })

  it("persists theme choice to localStorage", async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />, { wrapper: Wrapper })
    await user.click(screen.getByRole("button", { name: "toggle" }))
    expect(localStorage.getItem("pa_theme")).toBe("dark")
  })

  it("throws when used outside ThemeProvider", () => {
    // Suppress expected console.error from React error boundary
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => render(<ThemeToggle />)).toThrow("useTheme must be used inside ThemeProvider")
    spy.mockRestore()
  })
})
