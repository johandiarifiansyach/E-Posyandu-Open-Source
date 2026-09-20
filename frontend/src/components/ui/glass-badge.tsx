// Copyright (C) 2026 Johandi Arifiansyach

"use client"

import type * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const glassBadgeVariants = cva(
  cn(
    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
    "backdrop-blur-xl border transition-all duration-300",
  ),
  {
    variants: {
      variant: {
        default: "bg-white/65 border-white/55 text-slate-700",
        primary: cn("bg-gradient-to-r from-cyan-500/15 to-blue-500/15", "border-blue-300/45 text-blue-700"),
        success: cn("bg-emerald-500/12 border-emerald-300/45 text-emerald-700"),
        warning: cn("bg-amber-500/12 border-amber-300/45 text-amber-700"),
        destructive: cn("bg-red-500/12 border-red-300/45 text-red-700"),
        outline: "bg-transparent border-slate-300/60 text-slate-600",
      },
      size: {
        sm: "px-2 py-0.5 text-xs",
        md: "px-3 py-1 text-sm",
        lg: "px-4 py-2 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
)

export interface GlassBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassBadgeVariants> {}

function GlassBadge({ className, variant, size, ...props }: GlassBadgeProps) {
  return <div className={cn(glassBadgeVariants({ variant, size }), className)} {...props} />
}

export { GlassBadge, glassBadgeVariants }
