# Brawl Arena Online

Android client and multiplayer server prototype.

## Multiplayer server
- HTTP health check: `/health`
- Room listing: `/api/rooms`
- WebSocket endpoint: `/ws`
- Create/join room, player movement snapshots, attack events, ready state and simple room chat.
- Current room/player state is held in memory. It resets on restart and free hosting may sleep while idle.
- This is an early multiplayer foundation, not yet a complete authoritative combat/economy backend.

## Run locally
```bash
npm install
npm start
```

The server listens on `0.0.0.0:$PORT` (defaults to 10000).

## Build APK
GitHub Actions builds a debug APK on every push to `main`.
Open the **Actions** tab and download the `Brawl-Arena-Online-APK` artifact from the latest successful run.
