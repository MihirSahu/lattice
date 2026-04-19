"use client";

import { cn } from "@/lib/utils";

type LoadingDotsProps = {
  className?: string;
};

export function LoadingDots({ className }: LoadingDotsProps) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)} aria-label="Loading" role="status">
      <span className="loading-dot" />
      <span className="loading-dot" />
      <span className="loading-dot" />
    </span>
  );
}
