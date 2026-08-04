import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { useAuth0 } from "@auth0/auth0-react"
import { AuthProvider, useAuth } from "./auth"
import { authApi } from "@/lib/api"

vi.mock("@auth0/auth0-react", () => ({
  useAuth0: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  authApi: { me: vi.fn() },
}))

const mockUseAuth0 = vi.mocked(useAuth0)
const mockAuthApiMe = vi.mocked(authApi.me)

const ROLE_CLAIM = "https://primeassist.com/roles"

function Consumer() {
  const { user, isAuthenticated, isLoading, accessToken } = useAuth()
  return (
    <div data-testid="state">
      {JSON.stringify({ user, isAuthenticated, isLoading, accessToken })}
    </div>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("useAuth", () => {
  it("throws when called outside of an AuthProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => render(<Consumer />)).toThrow(
      "useAuth must be used inside AuthProvider"
    )
    spy.mockRestore()
  })

  it("exposes unauthenticated defaults without bootstrapping the backend profile", () => {
    mockUseAuth0.mockReturnValue({
      user: undefined,
      isAuthenticated: false,
      isLoading: false,
      getAccessTokenSilently: vi.fn(),
      loginWithRedirect: vi.fn(),
      logout: vi.fn(),
    } as unknown as ReturnType<typeof useAuth0>)

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    )

    const state = JSON.parse(screen.getByTestId("state").textContent ?? "{}")
    expect(state).toEqual({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      accessToken: null,
    })
    expect(mockAuthApiMe).not.toHaveBeenCalled()
  })

  it("merges the backend profile onto the Auth0 identity once bootstrap resolves", async () => {
    mockUseAuth0.mockReturnValue({
      user: {
        sub: "auth0|123",
        email: "person@example.com",
        name: "Person Example",
        [ROLE_CLAIM]: ["viewer"],
      },
      isAuthenticated: true,
      isLoading: false,
      getAccessTokenSilently: vi.fn().mockResolvedValue("token-abc"),
      loginWithRedirect: vi.fn(),
      logout: vi.fn(),
    } as unknown as ReturnType<typeof useAuth0>)

    mockAuthApiMe.mockResolvedValue({
      id: "backend-uuid",
      org_id: "org-uuid",
      auth0_subject: "auth0|123",
      email: "person@example.com",
      role: "admin",
      phone_number: "555-1234",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    })

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    )

    await waitFor(() => {
      const state = JSON.parse(screen.getByTestId("state").textContent ?? "{}")
      expect(state.user?.id).toBe("backend-uuid")
    })

    const state = JSON.parse(screen.getByTestId("state").textContent ?? "{}")
    expect(state.user).toMatchObject({
      id: "backend-uuid",
      orgId: "org-uuid",
      role: "admin",
      phone_number: "555-1234",
      auth0Subject: "auth0|123",
    })
    expect(state.accessToken).toBe("token-abc")
  })
})
