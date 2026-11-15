# Cloudflare multiplayer server

This folder contains the Cloudflare Worker and Durable Object room server.

## Deploy

1. Sign in to https://dash.cloudflare.com/
2. Open **Workers & Pages** → **Create** → **Workers** → **Connect to Git**.
3. Authorize GitHub and select `redieiekdrjr-code/Brawl-Arena-Online.`.
4. Set the root directory to `cloudflare-worker`.
5. Set the deploy command to `npx wrangler deploy` and leave the build command empty.
6. Deploy. Cloudflare should create the Worker named `brawl-arena-online`.

After deployment, test `https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/health`.

## API

- `POST /api/create-room` with JSON `{"mode":"showdown"}` returns a six-character room code.
- `GET /ws?room=CODE&name=Player&fighter=Ranger` upgrades to WebSocket.
- WebSocket messages: `move`, `attack`, `ready`, `chat`, `leave_room`, `ping`.

The Android client still needs to be updated to use this server URL. Combat validation, accounts, persistent player progress, and currency are not implemented yet.
