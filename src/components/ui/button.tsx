import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-display text-sm tracking-wide transition-opacity duration-200 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/70",
  {
    variants: {
      variant: {
        brass:
          "bg-brass text-ink hover:opacity-90 rounded-md px-4 py-2.5 min-h-11",
        ghost:
          "bg-transparent text-parchment hover:bg-parchment/8 rounded-md px-3 py-2 min-h-11",
        wood:
          "border border-brass/35 bg-plank text-parchment hover:border-brass/60 rounded-md px-4 py-2.5 min-h-11",
        danger:
          "bg-oxblood text-parchment hover:opacity-90 rounded-md px-4 py-2.5 min-h-11",
      },
      size: {
        default: "",
        icon: "size-11 p-0",
        sm: "min-h-9 px-3 py-1.5 text-xs",
      },
    },
    defaultVariants: {
      variant: "brass",
      size: "default",
    },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
