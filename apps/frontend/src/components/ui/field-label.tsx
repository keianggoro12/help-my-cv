"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

interface FieldLabelProps extends React.ComponentProps<"label"> {
  /** Shown after the label text; pass `false` to force no asterisk. */
  required?: boolean;
}

export function FieldLabel({ className, required, children, ...props }: FieldLabelProps) {
  return (
    <label className={cn("text-sm font-medium text-foreground", className)} {...props}>
      {children}
      {required ? <span className="ml-0.5 text-destructive">*</span> : null}
    </label>
  );
}
