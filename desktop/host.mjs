import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT || 17831);
const root = path.dirname(fileURLToPath(import.meta.url));
const www = path.join(root, "www");
const dataRoot = path.join(os.homedir(), "BookClubData");
const metaFile = path.join(dataRoot, "club.json");
const filesRoot = path.join(dataRoot, "files");

fs.mkdirSync(dataRoot, { recursive: true });
fs.mkdirSync(filesRoot, { recursive: true });

process.on("uncaughtException", (err) => {
  try {
    fs.appendFileSync(path.join(root, "host.log"), String(err?.stack || err) + "\n");
  } catch {
    /* ignore */
  }
});

function mime(file) {
  return (
    {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".mjs": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".svg": "image/svg+xml",
      ".webp": "image/webp",
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
      ".mp4": "video/mp4",
      ".pdf": "application/pdf",
      ".woff2": "font/woff2",
      ".onnx": "application/octet-stream",
      ".wasm": "application/wasm",
    }[path.extname(file).toLowerCase()] || "application/octet-stream"
  );
}

function send(res, status, body, type = "text/plain; charset=utf-8") {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  res.writeHead(status, { "content-type": type, "content-length": buf.length });
  res.end(buf);
}

function readMeta() {
  try {
    return JSON.parse(fs.readFileSync(metaFile, "utf8"));
  } catch {
    return { books: [], goneIds: [], marks: { scores: {}, spots: {} }, profiles: {}, settings: {} };
  }
}

function writeMeta(data) {
  fs.writeFileSync(metaFile, JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
      const method = (req.method || "GET").toUpperCase();

      if (url.pathname === "/api/club") {
        if (method === "GET") {
          send(res, 200, JSON.stringify(readMeta()), "application/json");
          return;
        }
        if (method === "POST") {
          const incoming = JSON.parse((await readBody(req)).toString() || "{}");
          const cur = readMeta();
          const gone = [...new Set([...(cur.goneIds || []), ...(incoming.goneIds || [])])];
          const goneSet = new Set(gone);
          const byId = new Map();
          for (const b of [...(cur.books || []), ...(incoming.books || [])]) {
            if (!b?.id || goneSet.has(b.id)) continue;
            byId.set(b.id, { ...(byId.get(b.id) || {}), ...b });
          }
          const next = {
            books: [...byId.values()],
            goneIds: gone,
            marks: incoming.marks || cur.marks,
            profiles: { ...(cur.profiles || {}), ...(incoming.profiles || {}) },
            settings: incoming.settings || cur.settings,
            savedAt: Date.now(),
          };
          writeMeta(next);
          send(res, 200, JSON.stringify({ books: next.books.length, gone: next.goneIds.length, savedAt: next.savedAt }), "application/json");
          return;
        }
      }

      const media = url.pathname.match(/^\/media\/([^/]+)\/([^/]+)$/);
      if (media) {
        const bookId = decodeURIComponent(media[1]);
        const kind = decodeURIComponent(media[2]);
        const dir = path.join(filesRoot, bookId);
        const file = path.join(dir, kind);
        const mimeFile = path.join(dir, `${kind}.mime`);
        if (method === "POST") {
          fs.mkdirSync(dir, { recursive: true });
          const buf = await readBody(req);
          fs.writeFileSync(file, buf);
          fs.writeFileSync(mimeFile, req.headers["content-type"] || "application/octet-stream");
          send(res, 200, JSON.stringify({ ok: true, bytes: buf.length }), "application/json");
          return;
        }
        if (fs.existsSync(file)) {
          let type = "application/octet-stream";
          if (fs.existsSync(mimeFile)) type = fs.readFileSync(mimeFile, "utf8").trim() || type;
          if (method === "HEAD") {
            res.writeHead(200, { "content-type": type, "content-length": fs.statSync(file).size });
            res.end();
            return;
          }
          res.writeHead(200, { "content-type": type });
          fs.createReadStream(file).pipe(res);
          return;
        }
        send(res, 404, "no");
        return;
      }

      let file = path.normalize(path.join(www, decodeURIComponent(url.pathname)));
      if (!file.startsWith(www)) {
        send(res, 403, "no");
        return;
      }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(www, "index.html");
      if (!fs.existsSync(file)) {
        send(res, 404, "App files missing");
        return;
      }
      res.writeHead(200, { "content-type": mime(file) });
      fs.createReadStream(file).pipe(res);
    } catch (err) {
      send(res, 500, String(err?.stack || err));
    }
  })
  .listen(PORT, "127.0.0.1", () => {
    try {
      fs.writeFileSync(path.join(root, "host.log"), `listening ${PORT}\n`);
    } catch {
      /* ignore */
    }
  });
