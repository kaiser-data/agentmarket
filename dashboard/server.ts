// Live demo dashboard: receives agent events (POST /event) and fans them out to
// the browser over Server-Sent Events. Serves a single static page.

import "dotenv/config";
import express from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

const clients = new Set<express.Response>();

app.get("/", (_req, res) => res.type("html").send(readFileSync(join(__dirname, "index.html"), "utf8")));

app.get("/stream", (req, res) => {
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.flushHeaders();
  clients.add(res);
  req.on("close", () => clients.delete(res));
});

app.post("/event", (req, res) => {
  const payload = `data: ${JSON.stringify(req.body)}\n\n`;
  for (const c of clients) c.write(payload);
  res.sendStatus(204);
});

const port = Number(process.env.DASHBOARD_PORT ?? 4000);
app.listen(port, () => console.log(`dashboard on http://localhost:${port}`));
