const http = require('node:http');
const crypto = require('node:crypto');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.PORT || 10000);
const rooms = new Map();
const clients = new Map();
const MAX_PLAYERS = 6;
const TICK_MS = 100;
const now = () => Date.now();
const id = () => crypto.randomBytes(8).toString('hex');
const cleanName = (v) => String(v || 'Player').replace(/[^a-zA-Z0-9_ -]/g, '').trim().slice(0, 16) || 'Player';
const send = (ws, data) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); };
function roomView(room) {
  return { code: room.code, mode: room.mode, players: [...room.players.values()].map(p => ({ id:p.id, name:p.name, fighter:p.fighter, x:p.x, y:p.y, hp:p.hp, ready:p.ready })) };
}
function broadcast(room, data) {
  for (const p of room.players.values()) send(p.ws, data);
}
function leave(ws) {
  const client = clients.get(ws);
  if (!client) return;
  clients.delete(ws);
  if (client.room) {
    const room = rooms.get(client.room);
    if (room) {
      room.players.delete(client.id);
      broadcast(room, { type:'player_left', playerId:client.id, room:roomView(room) });
      if (!room.players.size) rooms.delete(room.code);
    }
  }
}
function fail(ws, message) { send(ws, { type:'error', message }); }
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.url === '/health') return res.end(JSON.stringify({ ok:true, service:'brawl-arena-server', players:clients.size, rooms:rooms.size, time:now() }));
  if (req.url === '/api/rooms') return res.end(JSON.stringify({ rooms:[...rooms.values()].map(roomView) }));
  res.writeHead(404); res.end(JSON.stringify({ error:'not_found' }));
});
const wss = new WebSocketServer({ server, path:'/ws', maxPayload: 16 * 1024 });
wss.on('connection', ws => {
  const client = { id:id(), room:null, name:'Player', lastMessage:0 };
  clients.set(ws, client);
  send(ws, { type:'welcome', playerId:client.id, serverTime:now(), protocol:1 });
  ws.on('message', raw => {
    if (raw.length > 8192) return fail(ws, 'Message too large');
    if (now() - client.lastMessage < 20) return;
    client.lastMessage = now();
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return fail(ws, 'Invalid JSON'); }
    if (!msg || typeof msg.type !== 'string') return fail(ws, 'Invalid message');
    if (msg.type === 'ping') return send(ws, { type:'pong', time:now() });
    if (msg.type === 'create_room') {
      if (client.room) return fail(ws, 'Leave your current room first');
      const code = crypto.randomBytes(3).toString('hex').toUpperCase();
      const room = { code, mode:['gem_grab','showdown','brawl_ball'].includes(msg.mode) ? msg.mode : 'showdown', players:new Map(), createdAt:now() };
      rooms.set(code, room);
      addPlayer(room, client, ws, msg);
      return;
    }
    if (msg.type === 'join_room') {
      if (client.room) return fail(ws, 'Leave your current room first');
      const code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
      const room = rooms.get(code);
      if (!room) return fail(ws, 'Room not found');
      if (room.players.size >= MAX_PLAYERS) return fail(ws, 'Room is full');
      addPlayer(room, client, ws, msg);
      return;
    }
    if (msg.type === 'leave_room') { leave(ws); return send(ws, { type:'left_room' }); }
    if (!client.room) return fail(ws, 'Join a room first');
    const room = rooms.get(client.room);
    if (!room) { client.room = null; return fail(ws, 'Room expired'); }
    const player = room.players.get(client.id);
    if (!player) return fail(ws, 'Player not in room');
    if (msg.type === 'move') {
      const x = Number(msg.x), y = Number(msg.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      player.x = Math.max(0, Math.min(1, x));
      player.y = Math.max(0, Math.min(1, y));
      player.facing = Number.isFinite(Number(msg.facing)) ? Math.max(-1, Math.min(1, Number(msg.facing))) : 0;
    } else if (msg.type === 'attack') {
      const target = String(msg.target || '').slice(0, 32);
      broadcast(room, { type:'attack', playerId:client.id, target, attackId:id() });
    } else if (msg.type === 'ready') {
      player.ready = Boolean(msg.value);
      broadcast(room, { type:'room_update', room:roomView(room) });
    } else if (msg.type === 'chat') {
      const text = String(msg.text || '').trim().slice(0,120);
      if (text) broadcast(room, { type:'chat', playerId:client.id, name:player.name, text });
    }
  });
  ws.on('close', () => leave(ws));
  ws.on('error', () => leave(ws));
});
function addPlayer(room, client, ws, msg) {
  client.room = room.code;
  client.name = cleanName(msg.name);
  const fighter = ['Ranger','Volt','Titan'].includes(msg.fighter) ? msg.fighter : 'Ranger';
  room.players.set(client.id, { id:client.id, ws, name:client.name, fighter, x:0.5, y:0.5, hp:100, ready:false, facing:0 });
  send(ws, { type:'joined_room', room:roomView(room), you:client.id });
  broadcast(room, { type:'room_update', room:roomView(room) });
}
setInterval(() => {
  for (const room of rooms.values()) {
    const players = [...room.players.values()].map(p => ({ id:p.id, x:p.x, y:p.y, hp:p.hp, fighter:p.fighter, facing:p.facing }));
    broadcast(room, { type:'snapshot', at:now(), players });
  }
}, TICK_MS).unref();
setInterval(() => {
  for (const [code, room] of rooms) if (!room.players.size || now()-room.createdAt > 6*60*60*1000) rooms.delete(code);
}, 60_000).unref();
server.listen(PORT, '0.0.0.0', () => console.log('Brawl Arena server listening on ' + PORT));
