"use client"
import React from "react"
import { useAuth0 } from "@auth0/auth0-react"
import { authApi, type UserRole } from "@/lib/api"

const ROLE_CLAIM = "https://primeassist.com/roles"

export type { UserRole }

export type User = {
  id:            string    // backend UUID from /api/v1/auth/me
  auth0Subject:  string    // auth0|... identifier
  email:         string
  name:          string
  picture?:      string
  role:          UserRole
  orgId?:        string    // backend org UUID from /api/v1/auth/me
  phone_number?: string | null
}

type AuthContextValue = {
  user:                      User | null
  isAuthenticated:           boolean
  isLoading:                 boolean
  accessToken:               string | null
  getAccessTokenSilently:    () => Promise<string>
  login:                     () => void
  logout:                    () => void
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

type Props = {
  children: React.ReactNode
}

export function AuthProvider({ children }: Props) {
  const {
    user: auth0User,
    isAuthenticated,
    isLoading,
    getAccessTokenSilently: auth0GetToken,
    loginWithRedirect,
    logout: auth0Logout,
  } = useAuth0()

  // Cached access token — populated once after authentication
  const [accessToken, setAccessToken] = React.useState<string | null>(null)
  // Backend-assigned fields from /api/v1/auth/me
  const [backendProfile, setBackendProfile] = React.useState<{
    id: string; orgId: string; role: UserRole; phone_number?: string | null
  } | null>(null)

  React.useEffect(() => {
    if (!isAuthenticated || isLoading) return

    const bootstrap = async () => {
      try {
        const token = await auth0GetToken()
        setAccessToken(token)
        const me = await authApi.me(token)
        setBackendProfile({ id: me.id, orgId: me.org_id, role: me.role, phone_number: me.phone_number })
      } catch (err) {
        // Bootstrap failure is non-fatal — Auth0 identity still works,
        // but API calls needing backend UUID will fail gracefully.
        if (process.env.NODE_ENV === "development") {
          console.error("[AuthProvider] Failed to bootstrap backend user:", err)
        }
      }
    }

    bootstrap()
  // auth0GetToken identity is stable — safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isLoading])

  const user: User | null = React.useMemo(() => {
    if (!auth0User) return null
    const roles: string[] = auth0User[ROLE_CLAIM] ?? []
    return {
      id:            backendProfile?.id ?? auth0User.sub ?? "",
      auth0Subject:  auth0User.sub ?? "",
      email:         auth0User.email ?? "",
      name:          auth0User.name ?? auth0User.email ?? "",
      picture:       auth0User.picture,
      role:          backendProfile?.role ?? (roles[0] as UserRole) ?? "viewer",
      orgId:         backendProfile?.orgId ?? (auth0User["https://primeassist/org_id"] as string | undefined),
      phone_number:  backendProfile?.phone_number,
    }
  }, [auth0User, backendProfile])

  const getAccessTokenSilently = async (): Promise<string> => {
    const token = await auth0GetToken()
    setAccessToken(token)
    return token
  }

  const login = () => {
    loginWithRedirect()
  }

  const logout = () => {
    setAccessToken(null)
    setBackendProfile(null)
    auth0Logout({ logoutParams: { returnTo: window.location.origin } })
  }

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated, isLoading, accessToken, getAccessTokenSilently, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
