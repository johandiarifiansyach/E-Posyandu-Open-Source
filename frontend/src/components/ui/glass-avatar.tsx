// SPDX-License-Identifier: GPL-3.0-or-later


import * as React from "react"
import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cn } from "@/lib/utils"

const GlassAvatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> & {
    glowEffect?: boolean
  }
>(({ className, glowEffect = true, ...props }, ref) => (
  <div className="relative">
    {glowEffect && (
      <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 blur-md opacity-70" />
    )}
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
        "border border-white/50 bg-white/45 shadow-[0_4px_16px_rgba(15,23,42,0.12)] backdrop-blur-xl",
        className,
      )}
      {...props}
    />
  </div>
))
GlassAvatar.displayName = AvatarPrimitive.Root.displayName

const GlassAvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image ref={ref} className={cn("aspect-square h-full w-full", className)} {...props} />
))
GlassAvatarImage.displayName = AvatarPrimitive.Image.displayName

const GlassAvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full",
      "bg-white/65 backdrop-blur-xl text-slate-700 text-sm font-semibold",
      className,
    )}
    {...props}
  />
))
GlassAvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { GlassAvatar, GlassAvatarImage, GlassAvatarFallback }
