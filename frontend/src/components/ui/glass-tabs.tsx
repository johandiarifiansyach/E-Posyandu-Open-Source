// Copyright (C) 2026 Johandi Arifiansyach

"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

const GlassTabs = TabsPrimitive.Root

const GlassTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <div className="relative">
    <motion.div
      className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-r from-cyan-500/15 via-blue-500/15 to-purple-500/15 blur-lg"
      animate={{
        opacity: [0.4, 0.6, 0.4],
      }}
      transition={{
        duration: 3,
        repeat: Number.POSITIVE_INFINITY,
        ease: "easeInOut",
      }}
      aria-hidden="true"
    />
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "relative inline-flex h-12 items-center justify-center gap-1 rounded-full p-1",
        "border border-white/45 bg-white/45 backdrop-blur-xl",
        "shadow-[0_4px_16px_rgba(15,23,42,0.08)]",
        className,
      )}
      aria-label="Tab navigation"
      {...props}
    />
  </div>
))
GlassTabsList.displayName = TabsPrimitive.List.displayName

const GlassTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative inline-flex items-center justify-center whitespace-nowrap rounded-full px-4 py-2",
      "text-sm font-medium text-slate-500 transition-colors duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
      "disabled:pointer-events-none disabled:opacity-50",
      "hover:bg-white/55 hover:text-slate-800",
      "data-[state=active]:bg-white/80 data-[state=active]:text-slate-900",
      "data-[state=active]:shadow-sm",
      "data-[state=active]:before:absolute data-[state=active]:before:inset-0",
      "data-[state=active]:before:rounded-full data-[state=active]:before:bg-gradient-to-b",
      "data-[state=active]:before:from-white/45 data-[state=active]:before:to-transparent",
      "data-[state=active]:before:pointer-events-none",
      className,
    )}
    {...props}
  />
))
GlassTabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const GlassTabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50", className)}
    {...props}
  >
    <AnimatePresence mode="wait">
      <motion.div
        key={props.value}
        initial={{ opacity: 0, y: 10 }}
        animate={{
          opacity: 1,
          y: 0,
          transition: {
            type: "spring",
            visualDuration: 0.3,
            bounce: 0.2,
          },
        }}
        exit={{
          opacity: 0,
          y: -10,
          transition: { duration: 0.15 },
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  </TabsPrimitive.Content>
))
GlassTabsContent.displayName = TabsPrimitive.Content.displayName

export { GlassTabs, GlassTabsList, GlassTabsTrigger, GlassTabsContent }
