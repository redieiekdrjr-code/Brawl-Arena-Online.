const MAX_PLAYERS = 6;
const allowedModes = new Set(["gem_grab", "showdown", "brawl_ball"]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "brawl-arena-cloudflare", time: Date.now() });
    }
    if (url.pathname === "/api/create-room" && request.method === "POST") {
      let body = {};
      try { body = await request.json(); } catch {}
      const code = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
      const mode = allowedModes.has(body.mode) ? body.mode : "showdown";
      const id = env.ROOMS.idFromName(code);
      const stub = env.ROOMS.get(id);
      const response = await stub.fetch("https://room.internal/init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, mode })
      });
      if (!response.ok) return new Response("Could not create room", { status: 500 });
      return Response.json({ code, mode });
    }
    if (url.pathname === "/ws") {
      const code = (url.searchParams.get("room") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
      if (code.length !== 6) return new Response("A six-character room code is required", { status: 400 });
      const id = env.ROOMS.idFromName(code);
      return env.ROOMS.get(id).fetch(request);
    }
    return new Response("Not found", { status: 404 });
  }
};

export class GameRoom {
  constructor(ctx) {
    this.ctx = ctx;
    this.state = { code: "", mode: "showdown", players: [] };
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/init" && request.method === "POST") {
      const data = await request.json();
      this.state.code = data.code;
      this.state.mode = data.mode;
      await this.ctx.storage.put("room", this.state);
      return Response.json({ ok: true });
    }

    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("WebSocket upgrade required", { status: 426 });
      }
      this.state = await this.ctx.storage.get("room") || this.state;
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      const id = crypto.randomUUID().slice(0, 8);
      const params = new URL(request.url).searchParams;
      const name = cleanName(params.get("name"));
      const fighter = ["Ranger", "Volt", "Titan"].includes(params.get("fighter")) ? params.get("fighter") : "Ranger";
      const player = { id, name, fighter, x: 0.5, y: 0.5, hp: 100, ready: false, facing: 0 };
      const current = this.ctx.getWebSockets().length;
      if (current >= MAX_PLAYERS) return new Response("Room is full", { status: 409 });
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment(player);
      server.send(JSON.stringify({ type: "joined_room", room: this.roomView([...this.ctx.getWebSockets(), server]), you: id }));
      this.broadcast({ type: "room_update", room: this.roomView(this.ctx.getWebSockets()) });
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not found", { status: 404 });
  }

  webSocketMessage(ws, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" })); }
    const player = ws.deserializeAttachment();
    if (!player || !msg || typeof msg.type !== "string") return;
    if (msg.type === "ping") return ws.send(JSON.stringify({ type: "pong", time: Date.now() }));
    if (msg.type === "move") {
      const x = Number(msg.x), y = Number(msg.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      player.x = clamp(x); player.y = clamp(y);
      player.facing = Number.isFinite(Number(msg.facing)) ? Math.max(-1, Math.min(1, Number(msg.facing))) : 0;
      ws.serializeAttachment(player);
      this.broadcast({ type: "snapshot", at: Date.now(), players: this.roomView(this.ctx.getWebSockets()).players });
    } else if (msg.type === "attack") {
      this.broadcast({ type: "attack", playerId: player.id, target: String(msg.target || "").slice(0, 32), attackId: crypto.randomUUID() });
    } else if (msg.type === "ready") {
      player.ready = Boolean(msg.value); ws.serializeAttachment(player);
      this.broadcast({ type: "room_update", room: this.roomView(this.ctx.getWebSockets()) });
    } else if (msg.type === "chat") {
      const text = String(msg.text || "").trim().slice(0, 120);
      if (text) this.broadcast({ type: "chat", playerId: player.id, name: player.name, text });
    } else if (msg.type === "leave_room") {
      ws.close(1000, "Left room");
    }
  }

  webSocketClose(ws) {
    try {
      const player = ws.deserializeAttachment();
      ws.close(1000, "Disconnected");
      this.broadcast({ type: "player_left", playerId: player?.id, room: this.roomView(this.ctx.getWebSockets()) });
    } catch {}
  }

  webSocketError(ws) {
    try { ws.close(1011, "Socket error"); } catch {}
  }

  roomView(sockets) {
    return {
      code: this.state.code,
      mode: this.state.mode,
      players: sockets.map(socket => {
        try { const p = socket.deserializeAttachment(); return { id:p.id, name:p.name, fighter:p.fighter, x:p.x, y:p.y, hp:p.hp, ready:p.ready }; }
        catch { return null; }
      }).filter(Boolean)
    };
  }

  broadcast(data) {
    const payload = JSON.stringify(data);
    for (const socket of this.ctx.getWebSockets()) {
      try { socket.send(payload); } catch {}
    }
  }
}

function cleanName(value) {
  return String(value || "Player").replace(/[^a-zA-Z0-9_ -]/g, "").trim().slice(0, 16) || "Player";
}
function clamp(value) { return Math.max(0, Math.min(1, value)); }
