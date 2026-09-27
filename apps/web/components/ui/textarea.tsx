"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "block w-full resize-none rounded-xl border border-transparent bg-transparent px-5 py-5 text-[18px] font-normal leading-[1.38] text-(--text-primary) outline-hidden focus:outline-hidden focus-visible:outline-hidden focus:ring-0 focus-visible:ring-0 placeholder:text-(--text-tertiary)",
        className
      )}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";

export { Textarea };
