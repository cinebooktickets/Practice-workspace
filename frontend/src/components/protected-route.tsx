"use client"
import React from "react"
import { useAuth } from "@/context/auth"

type Props = {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: Props) {
  const { isAuthenticated, isLoading, login } = useAuth()

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      login()
    }
  }, [isLoading, isAuthenticated, login])

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          {/* Animated skeleton blocks */}
          <div className="h-10 w-40 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-56 animate-pulse rounded bg-muted" />
          <div className="h-4 w-44 animate-pulse rounded bg-muted" />
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    // Redirecting via login() — render nothing while Auth0 redirect happens
    return null
  }

  return <>{children}</>
}
