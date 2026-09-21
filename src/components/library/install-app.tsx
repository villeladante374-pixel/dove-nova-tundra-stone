import { Download } from "lucide-react";
import { toast } from "sonner";

const SOURCE_ZIP =
  "https://github.com/villeladante374-pixel/dove-nova-tundra-stone/archive/refs/heads/main.zip";

export function bootPwa() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
}

export function InstallAppButton() {
  function download() {
    const a = document.createElement("a");
    a.href = SOURCE_ZIP;
    a.rel = "noopener";
    a.target = "_blank";
    document.body.append(a);
    a.click();
    a.remove();
    toast.success("Descargando el código de Book Club");
  }

  return (
    <button type="button" className="app-dl" onClick={download} aria-label="Descargar app">
      <img src="/brand/icon-192.png" alt="" />
      <Download className="size-3.5" />
      <span>App</span>
    </button>
  );
}
