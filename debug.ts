let phone: Bun.ServerWebSocket<unknown> | undefined;

Bun.serve({
  port: 9090,
  fetch(req, server) {
    if (server.upgrade(req)) return;
    return new Response("debugger running");
  },
  websocket: {
    open(ws) {
      phone = ws;
      console.log("phone connected");
    },
    close() {
      phone = undefined;
      console.log("phone disconnected");
    },
    message(_, raw) {
      const text = String(raw);
      try {
        const { type, data } = JSON.parse(text);
        if (type === "log") console.log([].concat(data.message).join(" "));
        else console.log(text);
      } catch {
        console.log(text);
      }
    },
  },
});

console.log("debugger listening on :9090");

for await (const line of console) {
  if (!line.trim()) continue;
  if (phone) phone.send(line);
  else console.log("phone isn't connected");
}
