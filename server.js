const express = require("express");
const http = require("http");
const https = require("https");
const app = express();

app.get("/health", (req, res) => res.send("ok"));

app.all("*", (req, res) => {
  const target = req.headers["x-target-url"];
  if (!target) return res.status(400).send("Missing target");

  const parsed = new URL(target);
  console.log(`[${new Date().toISOString()}] ${parsed.hostname}${parsed.pathname}`);

  const client = target.startsWith("https") ? https : http;

  const proxyReq = client.request(
    {
      hostname: parsed.hostname,
      port: parsed.port || (target.startsWith("https") ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: req.method,
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android) AppleWebKit/537.36",
      },
    },
    (proxyRes) => {
      let body = "";
      proxyRes.on("data", (chunk) => (body += chunk));
      proxyRes.on("end", () => {
        if (res.headersSent) return;
        console.log(`  -> ${proxyRes.statusCode} (${body.length} bytes)`);
        res.set("Content-Type", "application/json");
        res.status(proxyRes.statusCode).send(body);
      });
    }
  );

  proxyReq.on("error", (e) => {
    if (res.headersSent) return;
    console.log(`  -> ERROR: ${e.message}`);
    res.status(502).send("Proxy error: " + e.message);
  });
  proxyReq.setTimeout(15000, () => {
    proxyReq.destroy();
    if (res.headersSent) return;
    console.log(`  -> TIMEOUT`);
    res.status(504).send("Timeout");
  });
  proxyReq.end();
});

app.listen(process.env.PORT || 3000, () => console.log("Relay running"));
