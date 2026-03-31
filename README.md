# Watch Together

Self-hosted watch party app for Plex. Watch movies and TV shows with friends in perfect sync using MPV.

## Quick Start

### Prerequisites
- Docker Desktop
- MPV (for watching)

### Run locally
```bash
git clone <repo>
cd watch-together
docker-compose up
```

Open http://localhost:3000

### MPV Setup (one-time, per machine)

**macOS / Linux:**
```bash
echo "input-ipc-server=/tmp/mpvsocket" >> ~/.config/mpv/mpv.conf
```

**Windows** (`%APPDATA%\mpv\mpv.conf`):
```
input-ipc-server=\\.\pipe\mpv
```

## How to Use

1. Open http://localhost:3000
2. Click **Create Party**, select a video, enter your name
3. Copy the join link and send to friends
4. Everyone opens MPV (`mpv --idle`)
5. Use the Play/Pause/Seek controls — everyone stays in sync

## Deploy to Mini-PC

```bash
ssh ubuntu@<mini-pc-ip>
git clone <repo> && cd watch-together
docker-compose -f docker-compose.prod.yml up -d
```

Friends visit: `http://<tailscale-ip>:3000`

## Tech Stack

- **Backend**: Node.js, Express, Socket.io
- **Frontend**: React 18, Vite, React Router
- **Player**: MPV (via IPC socket)
- **Infra**: Docker, Tailscale
