// Small local relay for the demo recordings. Each port stands for one demo
// machine: requests are passed unchanged to the demo instance, with an
// X-Forwarded-For header that gives the machine a neutral address
// (10.0.10.x) instead of 127.0.0.1. The demo instance trusts 127.0.0.0/8 as
// a proxy, exactly like a real reverse proxy setup.
//   node relay.mjs            ports 18111..18120 -> 10.0.10.11..20
import http from "node:http";
const TARGET = { host: "127.0.0.1", port: 18086 };
for (let i = 11; i <= 20; i++) {
  http.createServer((req, res) => {
    const up = http.request({ ...TARGET, method: req.method, path: req.url, headers: { ...req.headers, "x-forwarded-for": `10.0.10.${i}` } }, (r) => {
      res.writeHead(r.statusCode, r.headers);
      r.pipe(res);
    });
    up.on("error", () => { res.writeHead(502); res.end(); });
    req.pipe(up);
  }).listen(18100 + i, "127.0.0.1");
}
console.log("relay on 127.0.0.1:18111-18120");

// Browser proxy on 18099: the recording browser opens http://cachencarry.lan:8080
// (the example address of docs/CLIENTS.md) and lands on the demo instance, so
// the dashboard shows that address in its client snippets.
http.createServer((req, res) => {
  const u = new URL(req.url);
  const up = http.request({ ...TARGET, method: req.method, path: u.pathname + u.search, headers: req.headers }, (r) => {
    res.writeHead(r.statusCode, r.headers);
    r.pipe(res);
  });
  up.on("error", () => { res.writeHead(502); res.end(); });
  req.pipe(up);
}).listen(18099, "127.0.0.1");
