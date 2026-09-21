import { useEffect } from "react";
import { bootPwa } from "@/components/library/install-app";
import { unlockUiSfx } from "@/lib/ui-sfx";

export function SfxArm() {
  useEffect(() => {
    bootPwa();
    unlockUiSfx();
    const arm = () => unlockUiSfx();
    window.addEventListener("pointerdown", arm, true);
    window.addEventListener("keydown", arm, true);
    window.addEventListener("touchstart", arm, true);
    return () => {
      window.removeEventListener("pointerdown", arm, true);
      window.removeEventListener("keydown", arm, true);
      window.removeEventListener("touchstart", arm, true);
    };
  }, []);
  return null;
}
