# Lura Symbol Helper

Real-time symbol sequence sharing tool for World of Warcraft raid coordination.

Raid leader clicks symbols in order and all connected players instantly see the sequence in an overlay on top of the game (or on their phone via the web viewer). Built for coordinating boss mechanics like the L'ura memory puzzle.

> **⚠️ This tool does not interact with the World of Warcraft client.** It does not read game memory, modify game files, intercept network traffic, or automate anything. Players manually share information through an external WebSocket server — functionally similar to Discord with pictures. The overlay is an OS-level transparent window rendered by the operating system, not injected into the game process. See the [Disclaimer](#disclaimer) section for details.

## Features

- Real-time symbol sequence sharing via WebSocket
- Transparent always-on-top overlay (semicircle around boss)
- Mobile-friendly web viewer (read-only, keeps screen awake)
- Multiple raid leaders per session
- Connected player list
- Auto-reconnect with session rejoin
- Configurable hotkey for overlay toggle
- Czech + English UI (switchable per user)
- DPI scaling for 4K displays
- Cross-platform: Windows, macOS (Intel + Apple Silicon)

## Architecture

```
server/    Node.js + Socket.io WebSocket server (Docker ready)
           Also serves the mobile web viewer on the same port
client/    Electron desktop app with overlay window
```

## Download

Grab the latest release for your platform from the [Releases page](https://github.com/LordBoos/lura-symbol-helper/releases):

- **Windows** — portable `.exe`, no installation needed
- **macOS (Apple Silicon)** — `.dmg`
- **macOS (Intel)** — `.dmg`

The releases are pre-configured to connect to a public server. You can always change the server URL in the app settings, or self-host your own.

## Self-hosting the server

### With Docker

```bash
cd server
docker-compose up --build
```

### Locally

```bash
cd server
npm install
npm run build
npm start
```

The server runs on port 3000 by default. Environment variables:

- `PORT` — server port (default `3000`)
- `CORS_ORIGIN` — allowed origin for CORS (default `*`, set to your domain in production)

### Health check

```
GET /health
```

### Web viewer

Open `http://your-server:3000/` in a browser. Players enter a session ID to view the sequence in real-time (read-only).

## Building the client from source

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
npm run build:win
```

### Build DMG (macOS)

```bash
cd client
npm run build:mac
```

Artifacts are created in `client/release/`.

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

1. Download and launch the client (or start your self-hosted server + client)
2. The app auto-connects to the configured server
3. Enter your name, check **"I am a raid leader"** if applicable
4. Create a session or join one with a 6-character session ID
5. Leader clicks symbols in the overlay to set the sequence — all players see it in real-time
6. Press your configured hotkey to show/hide the overlay
7. WoW must run in **Windowed Fullscreen** mode for the overlay to appear on top of the game

Mobile players can open the server URL in a browser to view sequences without installing anything.

## Disclaimer

**Lura Symbol Helper is an external coordination tool. It does not interact with the World of Warcraft game client in any way.**

Specifically, this application:

- ❌ Does **not** modify the World of Warcraft client or game files
- ❌ Does **not** read World of Warcraft memory or processes
- ❌ Does **not** parse the combat log
- ❌ Does **not** intercept network traffic with Blizzard servers
- ❌ Does **not** automate any gameplay action
- ❌ Does **not** inject into the WoW process
- ✅ **Only** displays information that users manually enter and share with each other

The overlay is an OS-level transparent window (same mechanism as Discord's overlay or OBS). All data is manually entered by the raid leader by clicking symbols in the UI. Players receive that data through an independent WebSocket server. This is functionally equivalent to players sharing information via Discord chat, voice, or a shared whiteboard — just with a nicer presentation.

This project is not affiliated with, endorsed by, or sponsored by Blizzard Entertainment. World of Warcraft is a trademark of Blizzard Entertainment, Inc.
