const express = require("express");
const http = require("http");
const https = require("https");
const app = express();

app.get("/health", (req, res) => res.send("ok"));

app.all("*", (req, res) => {
  const target = req.headers["x-target-url"];
  if (!target) return res.status(400).send("Missing target");

  // Log each request (visible in Render dashboard logs)
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
        console.log(`  -> ${proxyRes.statusCode} (${body.length} bytes)`);
        res.set("Content-Type", "application/json");
        res.status(proxyRes.statusCode).send(body);
      });
    }
  );

  proxyReq.on("error", (e) => {
    console.log(`  -> ERROR: ${e.message}`);
    res.status(502).send("Proxy error: " + e.message);
  });
  proxyReq.setTimeout(15000, () => {
    proxyReq.destroy();
    console.log(`  -> TIMEOUT`);
    res.status(504).send("Timeout");
  });
  proxyReq.end();
});

app.listen(process.env.PORT || 3000, () => console.log("Relay running"));
