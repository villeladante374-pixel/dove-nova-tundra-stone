import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import archiver from "archiver";
import { createWriteStream } from "node:fs";

const require = createRequire(import.meta.url);
const packager = require("@electron/packager");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const desktop = join(root, "desktop");
const www = join(desktop, "www");
const server = join(desktop, "server");
const staticSrc = join(root, ".vercel/output/static");
const serverSrc = join(root, ".vercel/output/functions/__server.func");
const dist = join(root, "dist-packages");

function copyFiltered(from, to) {
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, {
    recursive: true,
    filter: (src) => !/en_GB-jenny|en_US-hfc_female|en_US-amy|[/\\]downloads[/\\]/.test(src),
  });
}

mkdirSync(dist, { recursive: true });
if (!existsSync(staticSrc) || !existsSync(serverSrc)) {
  throw new Error("Falta el build. Corre vite build primero.");
}
copyFiltered(staticSrc, www);
if (existsSync(join(desktop, "shell.html"))) {
  copyFileSync(join(desktop, "shell.html"), join(www, "index.html"));
} else {
  const { readdirSync } = await import("node:fs");
  const files = readdirSync(join(www, "assets"));
  const css = files.find((f) => f.startsWith("styles-") && f.endsWith(".css")) ?? "";
  const js = files.find((f) => f.startsWith("index-") && f.endsWith(".js")) ?? "";
  writeFileSync(
    join(www, "index.html"),
    `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><link rel="icon" href="/brand/icon-192.png"/><link rel="stylesheet" href="/assets/${css}"/><title>Book Club</title></head><body><script type="module" src="/assets/${js}"></script></body></html>`,
  );
}
rmSync(server, { recursive: true, force: true });
try {
  const cli = join(root, "node_modules/srvx/bin/srvx.mjs");
  if (existsSync(cli)) copyFileSync(cli, join(desktop, "srvx.mjs"));
} catch {
  /* optional */
}

writeFileSync(
  join(desktop, "Instalar.bat"),
  `@echo off
set DEST=%LOCALAPPDATA%\\BookClub
mkdir "%DEST%" >nul 2>&1
xcopy /E /I /Y "%~dp0*" "%DEST%\\" >nul
powershell -NoProfile -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\\Book Club.lnk'); $s.TargetPath='%DEST%\\Book Club.exe'; $s.WorkingDirectory='%DEST%'; $s.IconLocation='%DEST%\\Book Club.exe'; $s.Save()"
start "" "%DEST%\\Book Club.exe"
`,
);

const out = join(root, ".desktop-dist");
rmSync(out, { recursive: true, force: true });

const apps = await packager({
  dir: desktop,
  name: "Book Club",
  platform: "win32",
  arch: "x64",
  out,
  overwrite: true,
  asar: false,
  icon: join(desktop, "icon.ico"),
  electronVersion: "36.9.5",
  ignore: [/node_modules/, /\.map$/, /\/server(\/|$)/],
  prune: false,
  appVersion: "1.0.0",
  electronZipDir: undefined,
});

function zipDir(src, dest) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(dest);
    const archive = archiver("zip", { zlib: { level: 6 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(src, "Book Club");
    archive.finalize();
  });
}

const win = apps[0];
writeFileSync(
  join(win, "Instalar.bat"),
  `@echo off
title Book Club
set DEST=%LOCALAPPDATA%\\BookClub
mkdir "%DEST%" >nul 2>&1
xcopy /E /I /Y "%~dp0*" "%DEST%\\" >nul
powershell -NoProfile -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\\Book Club.lnk'); $s.TargetPath='%DEST%\\Book Club.exe'; $s.WorkingDirectory='%DEST%'; $s.Save()"
start "" "%DEST%\\Book Club.exe"
`,
);
writeFileSync(
  join(win, "LEEME.txt"),
  "Book Club\n\n1. Doble clic en Instalar.bat  (o en Book Club.exe para abrir ya)\n2. Se crea un acceso en el escritorio con el logo.\n3. Funciona sin internet.\n",
);
const zip = join(dist, "BookClub-Windows.zip");
await zipDir(win, zip);
console.log("packed", zip);
