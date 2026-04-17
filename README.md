# Lura Symbol Helper

Real-time symbol sequence sharing overlay for World of Warcraft raid coordination.

Raid leader clicks symbols in order and all connected players instantly see the sequence in an overlay on top of the game. Built for coordinating boss mechanics like the L'ura memory puzzle.

## Features

- Real-time symbol sequence sharing via WebSocket
- Transparent always-on-top overlay (semicircle around boss)
- Multiple raid leaders per session
- Connected player list
- Auto-reconnect with session rejoin
- Configurable hotkey for overlay toggle
- DPI scaling for 4K displays

## Architecture

```
server/    Node.js + Socket.io WebSocket server (Docker ready)
client/    Electron desktop app with overlay
```

## Server

### Run with Docker

```bash
cd server
docker-compose up --build
```

### Run locally

```bash
cd server
npm install
npm run build
npm start
```

The server runs on port 3000 by default. Set the `PORT` environment variable to change it.

### Health check

```
GET /health
```

## Client

### Prerequisites

- Node.js 18+

### Development

```bash
cd client
npm install
npm start
```

### Build portable exe (Windows)

```bash
cd client
npm run build
```

The exe is created in `client/release/`.

### Custom server URL

Set the `LURA_SERVER_URL` environment variable before building to bake in a custom default server address:

```bash
# Linux / macOS
LURA_SERVER_URL=https://my-server.example.com npm run build

# Windows (PowerShell)
$env:LURA_SERVER_URL="https://my-server.example.com"; npm run build

# Windows (cmd)
set LURA_SERVER_URL=https://my-server.example.com && npm run build
```

Without the variable, the default is `http://localhost:3000`. Users can always change the server URL in the app settings.

## Usage

1. Start the server (Docker or locally)
2. Launch the client
3. Enter your name, check "I am a raid leader" if applicable
4. Create a session or join one with a 6-character session ID
5. Leader clicks symbols to set the sequence, all players see it in real-time
6. WoW must run in **Windowed Fullscreen** mode for the overlay to work
7. Use the configurable hotkey to toggle the overlay
