import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { SfxArm } from "@/components/library/sfx-arm";
import { LiveClock } from "@/components/library/live-clock";
import { InstallAppButton } from "@/components/library/install-app";
import { SpotifyRoot } from "@/components/library/spotify-dock";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "Book Club";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "description", content: "Book Club: sube tus PDFs y ábrelos como tomos de pasta gruesa." },
      { name: "theme-color", content: "#050816" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/brand/icon-192.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap",
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/brand/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="es" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <SfxArm />
        <LiveClock />
        <InstallAppButton />
        <AuthProvider>
          <SpotifyRoot>
            <Outlet />
          </SpotifyRoot>
        </AuthProvider>
        <Toaster
          theme="dark"
          position="bottom-center"
          closeButton
          toastOptions={{
            className: "scriptorium-toast",
          }}
        />
        <Scripts />
      </body>
    </html>
  ),
});
