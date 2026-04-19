"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "outline" | "ghost";
type ButtonSize = "default" | "sm" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  default: "linear-primary-button",
  outline: "linear-ghost-button",
  ghost: "border border-transparent bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-button-subtle)]"
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-10 rounded-md px-4 py-2 text-[16px] font-[400] leading-[1.5]",
  sm: "h-9 rounded-md px-3 py-2 text-[14px] font-[400] leading-[1.5]",
  icon: "h-10 w-10 rounded-full p-0"
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "linear-focus inline-flex items-center justify-center whitespace-nowrap transition-opacity disabled:cursor-not-allowed disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button };

