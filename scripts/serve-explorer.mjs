#!/usr/bin/env node
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const workspaceRoot = resolve(__dirname, "..");
const nestedPublicRoot = resolve(workspaceRoot, "sites", "remote-sensing-band-explorer", "public", "explorer");
const publicRoot = existsSync(nestedPublicRoot) ? nestedPublicRoot : workspaceRoot;
const port = Number(readArg("--port") || process.env.PORT || 8070);
const host = readArg("--host") || process.env.HOST || "127.0.0.1";

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".geojson", "application/geo+json; charset=utf-8"],
  [".csv", "text/csv; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".ico", "image/x-icon"]
]);

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${host}:${port}`);
    const filePath = await resolveFile(normalizePath(url.pathname));
    const data = await readFile(filePath);

    response.writeHead(200, {
      "content-type": contentTypes.get(extname(filePath).toLowerCase()) || "application/octet-stream",
      "cache-control": "no-store"
    });
    response.end(data);
  } catch (error) {
    const status = error.statusCode || 404;
    response.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
    response.end(status === 403 ? "Forbidden" : "Not found");
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Stop Docker or run: npm run dev -- --port 8071`);
    process.exit(1);
  }
  throw error;
});

server.listen(port, host, () => {
  console.log(`Remote Sensing Band Explorer is running without Docker: http://${host}:${port}/index.html`);
});

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function normalizePath(pathname) {
  const decoded = decodeURIComponent(pathname);
  if (decoded === "/" || decoded === "") {
    return "/index.html";
  }
  return decoded;
}

async function resolveFile(pathname) {
  const requested = resolve(publicRoot, `.${pathname.replace(/\\/g, "/")}`);
  if (!requested.startsWith(publicRoot)) {
    const error = new Error("Forbidden");
    error.statusCode = 403;
    throw error;
  }

  const fileStat = await stat(requested);
  if (fileStat.isDirectory()) {
    return join(requested, "index.html");
  }
  return requested;
}
