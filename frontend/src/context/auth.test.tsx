import React from "react"
import { renderHook, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { useAuth0 } from "@auth0/auth0-react"
import { authApi } from "@/lib/api"
import { AuthProvider, useAuth } from "./auth"

vi.mock("@auth0/auth0-react", () => ({
  useAuth0: vi.fn(),
}))

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, authApi: { me: vi.fn() } }
})

const baseAuth0 = {
  isLoading: false,
  isAuthenticated: false,
  user: undefined,
  getAccessTokenSilently: vi.fn().mockResolvedValue("token"),
  loginWithRedirect: vi.fn(),
  logout: vi.fn(),
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

describe("useAuth", () => {
  it("outsideProvider_throws", () => {
    expect(() => renderHook(() => useAuth())).toThrow("useAuth must be used inside AuthProvider")
  })
})

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.mocked(useAuth0).mockReturnValue({ ...baseAuth0 } as any)
    vi.mocked(authApi.me).mockResolvedValue({} as any)
  })

  it("unauthenticated_userIsNull", () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it("authenticated_buildsUserFromAuth0AndBackendProfile", async () => {
    vi.mocked(useAuth0).mockReturnValue({
      ...baseAuth0,
      isAuthenticated: true,
      user: { sub: "auth0|abc", email: "alice@example.com", name: "Alice" },
      getAccessTokenSilently: vi.fn().mockResolvedValue("token-abc"),
    } as any)
    vi.mocked(authApi.me).mockResolvedValue({
      id: "backend-uuid",
      org_id: "org-uuid",
      role: "admin",
      phone_number: null,
    } as any)

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.user?.id).toBe("backend-uuid"))
    expect(result.current.user?.role).toBe("admin")
    expect(result.current.user?.orgId).toBe("org-uuid")
    expect(result.current.user?.email).toBe("alice@example.com")
    expect(result.current.user?.auth0Subject).toBe("auth0|abc")
  })

  it("bootstrapFails_userStillPresentWithViewerRole", async () => {
    const getToken = vi.fn().mockResolvedValue("token-abc")
    vi.mocked(useAuth0).mockReturnValue({
      ...baseAuth0,
      isAuthenticated: true,
      user: { sub: "auth0|abc", email: "alice@example.com", name: "Alice" },
      getAccessTokenSilently: getToken,
    } as any)
    vi.mocked(authApi.me).mockRejectedValue(new Error("Network error"))

    const { result } = renderHook(() => useAuth(), { wrapper })

    // accessToken is set before me() is called; wait for that to confirm bootstrap ran
    await waitFor(() => expect(result.current.accessToken).toBe("token-abc"))
    expect(result.current.user?.email).toBe("alice@example.com")
    expect(result.current.user?.role).toBe("viewer")
  })

  it("bootstrapFails_roleFromAuth0ClaimWhenPresent", async () => {
    vi.mocked(useAuth0).mockReturnValue({
      ...baseAuth0,
      isAuthenticated: true,
      user: {
        sub: "auth0|abc",
        email: "bob@example.com",
        name: "Bob",
        "https://primeassist.com/roles": ["editor"],
      },
      getAccessTokenSilently: vi.fn().mockResolvedValue("token-bob"),
    } as any)
    vi.mocked(authApi.me).mockRejectedValue(new Error("Backend down"))

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.accessToken).toBe("token-bob"))
    expect(result.current.user?.role).toBe("editor")
  })

  it("backendIdOverridesAuth0Sub", async () => {
    vi.mocked(useAuth0).mockReturnValue({
      ...baseAuth0,
      isAuthenticated: true,
      user: { sub: "auth0|original-sub", email: "user@example.com", name: "User" },
      getAccessTokenSilently: vi.fn().mockResolvedValue("token"),
    } as any)
    vi.mocked(authApi.me).mockResolvedValue({
      id: "real-backend-id",
      org_id: "org-1",
      role: "viewer",
      phone_number: null,
    } as any)

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.user?.id).toBe("real-backend-id"))
    expect(result.current.user?.auth0Subject).toBe("auth0|original-sub")
  })
})
