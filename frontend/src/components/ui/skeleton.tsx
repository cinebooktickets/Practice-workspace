import * as React from "react"
import { cn } from "@/lib/utils"

type Props = React.HTMLAttributes<HTMLDivElement>

function Skeleton({ className, ...props }: Props) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />
}

export { Skeleton }
