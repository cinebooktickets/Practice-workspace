"use client"
import React from "react"
import { useAuth0 } from "@auth0/auth0-react"
import { useRouter } from "next/navigation"

// Auth0 redirects here after login. The SDK handles the code exchange automatically.
// This page just waits for the SDK to complete, then redirects to /dashboard.
export default function CallbackPage() {
  const { isLoading, error } = useAuth0()
  const router = useRouter()

  React.useEffect(() => {
    if (!isLoading && !error) {
      router.replace("/dashboard")
    }
  }, [isLoading, error, router])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <p className="text-destructive font-semibold">Authentication failed</p>
          <p className="text-sm text-muted-foreground">{error.message}</p>
          <a href="/" className="text-sm text-primary underline">Go home</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-sm text-muted-foreground">Signing you in…</div>
    </div>
  )
}
