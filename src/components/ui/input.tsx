import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-md border border-brass/30 bg-ink/50 px-3 text-base text-parchment",
        "placeholder:text-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/60",
        "file:mr-3 file:border-0 file:bg-transparent file:font-display file:text-sm file:text-brass",
        className,
      )}
      {...props}
    />
  );
}
