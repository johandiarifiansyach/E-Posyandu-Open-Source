// Copyright (C) 2026 Johandi Arifiansyach

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"
import { cn } from "@/lib/utils"

const GlassSwitch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full",
      "border border-white/50 transition-all duration-300",
      "bg-white/55 backdrop-blur-xl",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-cyan-500/70 data-[state=checked]:to-blue-500/70",
      "data-[state=checked]:border-blue-400/50",
      "data-[state=checked]:shadow-[0_0_12px_rgba(59,130,246,0.24)]",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full",
        "bg-white shadow-[0_2px_8px_rgba(0,0,0,0.3)]",
        "transition-transform duration-300",
        "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5",
      )}
    />
  </SwitchPrimitive.Root>
))
GlassSwitch.displayName = SwitchPrimitive.Root.displayName

export { GlassSwitch }
