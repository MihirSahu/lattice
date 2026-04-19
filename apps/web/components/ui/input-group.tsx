"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const InputGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "lovable-search-shell rounded-[28px] border border-[var(--border-subtle)] bg-[var(--bg-input)]",
        className
      )}
      {...props}
    />
  )
);

InputGroup.displayName = "InputGroup";

const InputGroupHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("px-4 pt-4", className)} {...props} />
);

InputGroupHeader.displayName = "InputGroupHeader";

const InputGroupBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("px-2", className)} {...props} />
);

InputGroupBody.displayName = "InputGroupBody";

const InputGroupFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] px-4 py-3", className)}
      {...props}
    />
  )
);

InputGroupFooter.displayName = "InputGroupFooter";

export { InputGroup, InputGroupHeader, InputGroupBody, InputGroupFooter };
