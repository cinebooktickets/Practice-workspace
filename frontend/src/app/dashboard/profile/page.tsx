"use client"
import React from "react"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { ProtectedRoute } from "@/components/protected-route"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/context/auth"
import { profileApi, ApiException } from "@/lib/api"
import { toast } from "sonner"

type ProfileForm = {
  phone: string
}

type FieldErrors = Partial<Record<keyof ProfileForm, string>>

function getInitials(name: string | undefined): string {
  if (!name) return "?"
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

export default function ProfilePage() {
  const { user, isLoading: authLoading, getAccessTokenSilently } = useAuth()

  const [form, setForm] = React.useState<ProfileForm>({ phone: "" })
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({})
  const [saving, setSaving] = React.useState(false)

  // Populate phone from backend user once loaded
  React.useEffect(() => {
    if (user) {
      setForm({ phone: user.phone_number ?? "" })
    }
  }, [user])

  const validate = (): boolean => {
    const errors: FieldErrors = {}
    if (form.phone && !/^\+?[\d\s\-().]{7,20}$/.test(form.phone)) {
      errors.phone = "Enter a valid phone number"
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const token = await getAccessTokenSilently()
      await profileApi.update(token, { phone_number: form.phone || null })
      toast.success("Profile updated")
    } catch (err: unknown) {
      if (err instanceof ApiException) {
        toast.error(err.message)
      } else {
        toast.error("Failed to save profile")
      }
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (fieldErrors[name as keyof ProfileForm]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  if (authLoading) {
    return (
      <ProtectedRoute>
        <DashboardShell>
          <div className="max-w-2xl space-y-6">
            <Skeleton className="h-8 w-32" aria-hidden="true" />
            <Skeleton className="h-64 w-full" aria-hidden="true" />
          </div>
        </DashboardShell>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardShell>
        <div className="max-w-2xl space-y-6">
          {/* Page header */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
            <p className="text-muted-foreground mt-1">
              Manage your personal account details.
            </p>
          </div>

          {/* Avatar section */}
          <Card>
            <CardHeader>
              <CardTitle>Photo</CardTitle>
              <CardDescription>Your avatar is sourced from Auth0.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user?.picture ?? undefined} alt={user?.name ?? "User"} />
                <AvatarFallback className="text-lg">{getInitials(user?.name)}</AvatarFallback>
              </Avatar>
              <div className="text-sm text-muted-foreground">
                To change your photo, update it on your Auth0 / social account.
              </div>
            </CardContent>
          </Card>

          {/* Profile form */}
          <Card>
            <CardHeader>
              <CardTitle>Account details</CardTitle>
              <CardDescription>Update your contact phone number.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Email — read-only */}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email ?? ""}
                  readOnly
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">
                  Email is managed by your identity provider and cannot be changed here.
                </p>
              </div>

              {/* Display name — read-only, managed via Auth0 */}
              <div className="space-y-1.5">
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  value={user?.name ?? ""}
                  readOnly
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">
                  Display name is managed via Auth0 and cannot be changed here.
                </p>
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+1 555 000 0000"
                  aria-invalid={!!fieldErrors.phone}
                />
                {fieldErrors.phone && (
                  <p className="text-xs text-destructive">{fieldErrors.phone}</p>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    </ProtectedRoute>
  )
}
