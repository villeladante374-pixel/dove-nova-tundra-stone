import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

function keepFilePicker(event: { target: EventTarget | null; preventDefault: () => void }) {
  const target = event.target as HTMLElement | null;
  if (
    !target ||
    target === document.documentElement ||
    target === document.body ||
    Boolean(target.closest?.("[data-file-pick]"))
  ) {
    event.preventDefault();
  }
}

export function DialogOverlay(props: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      {...props}
      className={cn(
        "fixed inset-0 z-[100] bg-ink/80",
        props.className,
      )}
    />
  );
}

export function DialogContent({
  className,
  children,
  onPointerDownOutside,
  onFocusOutside,
  onInteractOutside,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        {...props}
        onFocusOutside={(event) => {
          event.preventDefault();
          onFocusOutside?.(event);
        }}
        onPointerDownOutside={(event) => {
          keepFilePicker(event);
          onPointerDownOutside?.(event);
        }}
        onInteractOutside={(event) => {
          keepFilePicker(event);
          onInteractOutside?.(event);
        }}
        className={cn(
          "fixed z-[100] inset-x-0 bottom-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
          "w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto",
          "border border-brass/30 bg-walnut text-parchment",
          "rounded-t-xl sm:rounded-xl p-6 shadow-[0_30px_80px_color-mix(in_oklab,#000_55%,transparent)]",
          className,
        )}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute right-3 top-3 size-11 inline-flex items-center justify-center rounded-md text-muted hover:text-parchment"
          aria-label="Cerrar"
        >
          <X className="size-5" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogTitle(props: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      {...props}
      className={cn("font-display text-xl text-parchment pr-10", props.className)}
    />
  );
}

export function DialogDescription(
  props: ComponentProps<typeof DialogPrimitive.Description>,
) {
  return (
    <DialogPrimitive.Description
      {...props}
      className={cn("mt-1 text-base text-muted", props.className)}
    />
  );
}
