"use client"
import React from "react"
import { useAuth0 } from "@auth0/auth0-react"

export default function RegisterPage() {
  const { loginWithRedirect, isLoading, isAuthenticated } = useAuth0()

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      loginWithRedirect({ authorizationParams: { screen_hint: "signup" } })
    }
    if (!isLoading && isAuthenticated) {
      window.location.replace("/dashboard")
    }
  }, [isLoading, isAuthenticated, loginWithRedirect])

  return null
}
