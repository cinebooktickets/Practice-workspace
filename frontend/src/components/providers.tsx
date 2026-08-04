"use client"
import React from "react"
import { Auth0Provider } from "@auth0/auth0-react"
import { useRouter } from "next/navigation"
import { Toaster } from "sonner"
import { ThemeProvider } from "@/context/theme"
import { AuthProvider } from "@/context/auth"

type Props = {
  children: React.ReactNode
}

export function Providers({ children }: Props) {
  const router = useRouter()

  const domain   = process.env.NEXT_PUBLIC_AUTH0_DOMAIN!
  const clientId = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID!
  const audience = process.env.NEXT_PUBLIC_AUTH0_AUDIENCE

  const onRedirectCallback = (appState?: { returnTo?: string }) => {
    router.push(appState?.returnTo ?? "/dashboard")
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: typeof window !== "undefined"
          ? `${window.location.origin}/callback`
          : "",
        audience,
      }}
      onRedirectCallback={onRedirectCallback}
    >
      <AuthProvider>
        <ThemeProvider>
          {children}
          <Toaster richColors closeButton position="bottom-right" style={{ zIndex: 9999 }} />
        </ThemeProvider>
      </AuthProvider>
    </Auth0Provider>
  )
}
