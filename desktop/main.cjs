const { app, BrowserWindow, nativeImage } = require("electron");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const PORT = 17831;

function resolveRoot() {
  if (fs.existsSync(path.join(__dirname, "host.mjs"))) return __dirname;
  return process.resourcesPath;
}

function startHost(root) {
  const host = path.join(root, "host.mjs");
  return spawn(process.execPath, [host], {
    cwd: root,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(PORT),
      HOST: "127.0.0.1",
    },
    stdio: "ignore",
  });
}

function waitPort(ms = 45000) {
  const t0 = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const req = http.get(`http://127.0.0.1:${PORT}/`, (res) => {
        res.resume();
        resolve(true);
      });
      req.on("error", () => {
        if (Date.now() - t0 > ms) resolve(false);
        else setTimeout(tick, 180);
      });
    };
    tick();
  });
}

function createWindow(iconPath) {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 880,
    minHeight: 560,
    fullscreen: true,
    autoHideMenuBar: true,
    icon: nativeImage.createFromPath(iconPath),
    title: "Book Club",
    backgroundColor: "#050816",
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  win.setMenuBarVisibility(false);
  win.loadURL(`http://127.0.0.1:${PORT}/`);
}

app.setName("Book Club");
app.whenReady().then(async () => {
  const root = resolveRoot();
  const icon = path.join(root, "icon.png");
  const child = startHost(root);
  await waitPort();
  createWindow(icon);
  app.on("before-quit", () => {
    try {
      child?.kill();
    } catch {
      /* ignore */
    }
  });
});

app.on("window-all-closed", () => app.quit());
