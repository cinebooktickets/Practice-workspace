import React from "react"
import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { ProtectedRoute } from "./protected-route"
import { useAuth } from "@/context/auth"

vi.mock("@/context/auth", () => ({
  useAuth: vi.fn(),
}))

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReset()
  })

  it("loading_rendersSkeletonNotChildren", () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      login: vi.fn(),
    } as any)

    render(<ProtectedRoute><div>Protected content</div></ProtectedRoute>)

    expect(screen.queryByText("Protected content")).not.toBeInTheDocument()
  })

  it("loading_doesNotCallLogin", () => {
    const login = vi.fn()
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      login,
    } as any)

    render(<ProtectedRoute><div>Protected content</div></ProtectedRoute>)

    expect(login).not.toHaveBeenCalled()
  })

  it("unauthenticated_callsLoginAndRendersNothing", () => {
    const login = vi.fn()
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      login,
    } as any)

    const { container } = render(<ProtectedRoute><div>Protected content</div></ProtectedRoute>)

    expect(login).toHaveBeenCalledOnce()
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument()
    expect(container.firstChild).toBeNull()
  })

  it("authenticated_rendersChildren", () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
    } as any)

    render(<ProtectedRoute><div>Protected content</div></ProtectedRoute>)

    expect(screen.getByText("Protected content")).toBeInTheDocument()
  })

  it("authenticated_doesNotCallLogin", () => {
    const login = vi.fn()
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      login,
    } as any)

    render(<ProtectedRoute><div>Protected content</div></ProtectedRoute>)

    expect(login).not.toHaveBeenCalled()
  })
})
