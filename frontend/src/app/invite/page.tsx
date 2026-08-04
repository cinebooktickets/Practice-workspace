"use client"
import React from "react"
import { Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useAuth } from "@/context/auth"
import { inviteApi } from "@/lib/api"
import { ApiException } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type PageState = "idle" | "loading" | "success" | "error"

const ERROR_MESSAGES: Record<string, string> = {
  invite_expired:      "This invite link has expired. Ask an admin to send a new one.",
  invite_already_used: "This invite has already been accepted.",
  invite_not_found:    "This invite link is invalid or does not exist.",
}

function InvitePageContent() {
  const searchParams        = useSearchParams()
  const router              = useRouter()
  const { getAccessTokenSilently, isAuthenticated, isLoading: authLoading, login } = useAuth()

  const token = searchParams.get("token")

  const [state,   setState]   = React.useState<PageState>("idle")
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  // Redirect to login if not authenticated, preserving the invite token in sessionStorage
  React.useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      if (token) sessionStorage.setItem("inviteToken", token)
      login()
    }
  }, [authLoading, isAuthenticated, token, login])

  const handleAccept = async () => {
    if (!token) {
      setErrorMsg("No invite token found in the URL. Please use the link from your invitation email.")
      setState("error")
      return
    }

    setState("loading")
    setErrorMsg(null)

    try {
      const accessToken = await getAccessTokenSilently()
      await inviteApi.accept(accessToken, { token })
      setState("success")
      setTimeout(() => router.push("/dashboard"), 1500)
    } catch (err) {
      setState("error")
      if (err instanceof ApiException) {
        setErrorMsg(ERROR_MESSAGES[err.code] ?? err.message)
      } else {
        setErrorMsg("Something went wrong. Please try again.")
      }
    }
  }

  if (authLoading || !isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Accept Invitation</CardTitle>
          <CardDescription>
            You have been invited to join an organisation on PrimeAssist.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {state === "success" && (
            <p className="text-sm text-green-600">
              Invitation accepted! Redirecting to your dashboard…
            </p>
          )}

          {state === "error" && errorMsg && (
            <p className="text-sm text-destructive">{errorMsg}</p>
          )}

          {!token && state === "idle" && (
            <p className="text-sm text-destructive">
              No invite token found in the URL. Please use the link from your invitation email.
            </p>
          )}

          {state !== "success" && (
            <Button
              className="w-full"
              onClick={handleAccept}
              disabled={state === "loading" || !token}
            >
              {state === "loading" ? "Accepting…" : "Accept Invitation"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground text-sm">Loading…</p></div>}>
      <InvitePageContent />
    </Suspense>
  )
}
