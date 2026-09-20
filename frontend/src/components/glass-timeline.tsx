// SPDX-License-Identifier: GPL-3.0-or-later


import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface TimelineItem {
  id: string
  title: string
  description?: React.ReactNode
  date?: string
  icon?: React.ReactNode
  status?: "completed" | "current" | "upcoming"
}

interface GlassTimelineProps extends React.HTMLAttributes<HTMLDivElement> {
  items: TimelineItem[]
  orientation?: "vertical" | "horizontal"
}

const GlassTimeline = React.forwardRef<HTMLDivElement, GlassTimelineProps>(
  ({ className, items, orientation = "vertical", ...props }, ref) => {
    if (orientation === "horizontal") {
      return (
        <div ref={ref} className={cn("w-full overflow-x-auto", className)} {...props}>
          <div className="flex items-start gap-4 min-w-max px-4">
            {items.map((item, index) => (
              <div key={item.id} className="flex flex-col items-center">
                <div className="flex items-center">
                  {/* Node */}
                  <GlassTimelineNode status={item.status} icon={item.icon} />

                  {/* Connector */}
                  {index < items.length - 1 && (
                    <div
                      className={cn(
                        "w-24 h-0.5 mx-2",
                        item.status === "completed" ? "bg-gradient-to-r from-cyan-500 to-blue-500" : "bg-slate-300/70",
                      )}
                    />
                  )}
                </div>

                {/* Content */}
                <div className="mt-4 max-w-[9.375rem] text-center">
                  <h4 className="text-sm font-medium text-slate-800">{item.title}</h4>
                  {item.date && <p className="mt-1 text-xs text-slate-500">{item.date}</p>}
                  {item.description && <div className="mt-2 text-xs text-slate-600">{item.description}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    }

    return (
      <div ref={ref} className={cn("relative", className)} {...props}>
        {items.map((item, index) => (
          <div key={item.id} className="flex gap-4 pb-8 last:pb-0">
            {/* Node and line */}
            <div className="flex flex-col items-center">
              <GlassTimelineNode status={item.status} icon={item.icon} />
              {index < items.length - 1 && (
                <div
                  className={cn(
                    "w-0.5 flex-1 mt-2",
                    item.status === "completed" ? "bg-gradient-to-b from-cyan-500 to-blue-500" : "bg-slate-300/70",
                  )}
                />
              )}
            </div>

            {/* Content card */}
            <div className="flex-1 pb-2">
              <GlassTimelineCard item={item} />
            </div>
          </div>
        ))}
      </div>
    )
  },
)
GlassTimeline.displayName = "GlassTimeline"

function GlassTimelineNode({ status, icon }: { status?: TimelineItem["status"]; icon?: React.ReactNode }) {
  return (
    <div className="relative">
      {/* Glow for current */}
      {status === "current" && (
        <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-cyan-500/50 to-blue-500/50 blur-md animate-pulse" />
      )}

      <div
        className={cn(
          "relative w-10 h-10 rounded-full flex items-center justify-center",
          "border-2 transition-all duration-300",
          status === "completed" && "bg-gradient-to-br from-cyan-500 to-blue-500 border-cyan-300/70",
          status === "current" && "bg-white/75 backdrop-blur-xl border-blue-400/70 shadow-sm",
          status === "upcoming" && "bg-white/55 backdrop-blur-xl border-slate-300/70",
          !status && "bg-white/60 backdrop-blur-xl border-slate-300/70",
        )}
      >
        {status === "completed" ? (
          <Check className="h-5 w-5 text-white" />
        ) : icon ? (
          <span className={cn("text-slate-600", status === "current" && "text-blue-600")}>{icon}</span>
        ) : (
          <div className={cn("h-3 w-3 rounded-full", status === "current" ? "bg-blue-500" : "bg-slate-300")} />
        )}
      </div>
    </div>
  )
}

function GlassTimelineCard({ item }: { item: TimelineItem }) {
  const isCurrent = item.status === "current"

  return (
    <div className="relative">
      {isCurrent && (
        <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-cyan-500/25 to-blue-500/25 blur-lg opacity-70" />
      )}

      <div
        className={cn(
          "relative rounded-xl border p-4",
          "backdrop-blur-xl transition-all duration-300",
          isCurrent ? "bg-white/75 border-blue-200/70" : "bg-white/55 border-white/60 hover:bg-white/70",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-slate-800">{item.title}</h4>
          {item.date && <span className="shrink-0 text-xs text-slate-500">{item.date}</span>}
        </div>
        {item.description && <div className="mt-2 text-sm text-slate-600">{item.description}</div>}
      </div>
    </div>
  )
}

export { GlassTimeline }
export type { TimelineItem }
