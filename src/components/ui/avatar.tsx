import * as React from "react"
import { cn } from "@/lib/utils"

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string
  alt?: string
  fallback?: React.ReactNode
  size?: "sm" | "md" | "lg" | "xl"
  status?: "online" | "offline" | "busy"
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, fallback, size = "md", status, ...props }, ref) => {
    const sizeClasses = {
      sm: "h-8 w-8 text-xs",
      md: "h-10 w-10 text-sm",
      lg: "h-12 w-12 text-base",
      xl: "h-16 w-16 text-lg",
    }

    const statusColors = {
      online: "bg-(--color-primary)",
      offline: "bg-(--color-border)",
      busy: "bg-(--color-error)",
    }

    return (
      <div className="relative inline-block">
        <div
          ref={ref}
          className={cn(
            "relative flex shrink-0 overflow-hidden rounded-full bg-(--color-elevated) items-center justify-center",
            sizeClasses[size],
            className
          )}
          {...props}
        >
          {src ? (
            <img
              src={src}
              alt={alt || "Avatar"}
              className="aspect-square h-full w-full object-cover"
            />
          ) : (
            <span className="font-medium text-(--color-text-muted)">
              {fallback}
            </span>
          )}
        </div>
        {status && (
          <span
            className={cn(
              "absolute bottom-0 right-0 block rounded-full ring-2 ring-(--color-background)",
              statusColors[status],
              size === "sm" ? "h-2 w-2" : size === "md" ? "h-2.5 w-2.5" : "h-3.w-3"
            )}
          />
        )}
      </div>
    )
  }
)
Avatar.displayName = "Avatar"

export { Avatar }
