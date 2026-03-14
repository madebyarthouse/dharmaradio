import * as React from "react";
import { cn } from "~/lib/cn";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "pressed" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-full font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40",
          {
            "neumorphic-button": variant === "default",
            "neumorphic-card-pressed": variant === "pressed",
            "text-text-secondary hover:text-text-primary hover:bg-white/40":
              variant === "ghost",
          },
          {
            "h-10 px-5 py-2 text-sm": size === "default",
            "h-8 px-4 py-1.5 text-xs": size === "sm",
            "h-12 px-6 py-3 text-base": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
