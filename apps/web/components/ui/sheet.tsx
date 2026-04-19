"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetPortal = DialogPrimitive.Portal;
const SheetClose = DialogPrimitive.Close;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-[rgba(28,28,28,0.32)] backdrop-blur-[2px] data-[state=closed]:animate-[sheet-overlay-out_220ms_ease-in_forwards] data-[state=open]:animate-[sheet-overlay-in_260ms_ease-out_forwards]",
      className
    )}
    {...props}
  />
));

SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;

type SheetContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left";
  showClose?: boolean;
};

const sideClasses: Record<NonNullable<SheetContentProps["side"]>, string> = {
  top: "inset-x-0 top-0 border-b rounded-b-[28px] data-[state=closed]:animate-[sheet-top-out_220ms_ease-in_forwards] data-[state=open]:animate-[sheet-top-in_320ms_cubic-bezier(0.16,1,0.3,1)_forwards]",
  right:
    "inset-y-0 right-0 h-full w-[88vw] max-w-[360px] border-l data-[state=closed]:animate-[sheet-right-out_220ms_ease-in_forwards] data-[state=open]:animate-[sheet-right-in_320ms_cubic-bezier(0.16,1,0.3,1)_forwards]",
  bottom:
    "inset-x-0 bottom-0 max-h-[85vh] border-t rounded-t-[28px] data-[state=closed]:animate-[sheet-bottom-out_220ms_ease-in_forwards] data-[state=open]:animate-[sheet-bottom-in_320ms_cubic-bezier(0.16,1,0.3,1)_forwards]",
  left:
    "inset-y-0 left-0 h-full w-[88vw] max-w-[320px] border-r data-[state=closed]:animate-[sheet-left-out_220ms_ease-in_forwards] data-[state=open]:animate-[sheet-left-in_320ms_cubic-bezier(0.16,1,0.3,1)_forwards]"
};

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ className, children, side = "right", showClose = true, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-50 border-[var(--border-subtle)] bg-[var(--bg-panel)] p-6 shadow-[0_20px_48px_rgba(28,28,28,0.16)] focus:outline-none will-change-transform",
        sideClasses[side],
        className
      )}
      {...props}
    >
      {children}
      {showClose ? (
        <DialogPrimitive.Close
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-button-subtle)] hover:text-[var(--text-primary)] focus:outline-none"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      ) : null}
    </DialogPrimitive.Content>
  </SheetPortal>
));

SheetContent.displayName = DialogPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 pr-10", className)} {...props} />
);

SheetHeader.displayName = "SheetHeader";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-[18px] font-[600] leading-[1.3] text-[var(--text-primary)]", className)}
    {...props}
  />
));

SheetTitle.displayName = DialogPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-[14px] leading-[1.55] text-[var(--text-tertiary)]", className)}
    {...props}
  />
));

SheetDescription.displayName = DialogPrimitive.Description.displayName;

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetDescription };
