import { useRef } from "react";
import { cn } from "@/lib/utils";
import { useUiPrefs } from "@/lib/ui-prefs";
import { prepCanvas, toHiResBlob } from "@/lib/hires-image";

type Props = {
  size?: "sm" | "md";
  className?: string;
};

export function BrandCrest({ className }: { className?: string }) {
  const custom = useUiPrefs((s) => s.logoUrl);
  return (
    <img
      src={custom || "/brand/book-club-mark.jpg"}
      alt=""
      className={cn("brand-crest is-photo", className)}
      draggable={false}
      decoding="async"
    />
  );
}

export function BrandMark({ size = "sm", className }: Props) {
  return <BrandCrest className={cn("brand-mark", size === "md" && "is-md", className)} />;
}

type BadgeProps = {
  size?: "sm" | "md";
  className?: string;
  upload?: boolean;
};

export async function bakeLogo(file: File) {
  const bmp = await createImageBitmap(file);
  const size = 1024;
  const { canvas, ctx } = prepCanvas(size);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  const side = Math.min(bmp.width, bmp.height);
  const sx = (bmp.width - side) / 2;
  const sy = (bmp.height - side) / 2;
  ctx.drawImage(bmp, sx, sy, side, side, 0, 0, size, size);
  bmp.close();
  return toHiResBlob(canvas, "image/png");
}

export function BrandBadge({ size = "md", className, upload = false }: BadgeProps) {
  const setLogoFile = useUiPrefs((s) => s.setLogoFile);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <span className={cn("picker-orbit brand-badge", size === "sm" ? "is-sm" : "is-md", className)}>
      <i className="ring-spin" aria-hidden />
      <span className="picker-badge">
        <BrandCrest className="picker-logo" />
        <i className="picker-shine" aria-hidden />
      </span>
      {upload ? (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.currentTarget.value = "";
              if (!file) return;
              void bakeLogo(file).then(setLogoFile);
            }}
          />
          <button
            type="button"
            className="brand-upload"
            aria-label="Subir logo"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              fileRef.current?.click();
            }}
          />
        </>
      ) : null}
    </span>
  );
}
