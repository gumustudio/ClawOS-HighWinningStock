<div align="center">

<img src="frontend/public/favicon.svg" width="80" height="80" alt="ClawOS" />

# ClawOS

### Lightweight Personal Cloud Desktop + AI Stock Analysis Workbench

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

ClawOS is a self-hosted, single-user Web desktop that brings AI stock analysis, OpenCode remote coding, OpenClaw chat, files, notes, music, video, downloads, RSS daily briefs, and system monitoring into one browser workspace.

**[> 中文文档 / Chinese Docs](README.md)**

<img src=".github/screenshot.png" width="960" alt="ClawOS Desktop Screenshot" />

</div>

---

## What It Is

ClawOS is not a generic NAS dashboard. It is a lightweight personal cloud desktop for one machine and one user, designed for local use and Tailnet-style remote access. You open a browser, enter a desktop, launch apps as windows, and keep the data on your own computer.

The current public version focuses on:

- **AI Stock Analysis Workbench**: CSI 500 stock pool, full A-share watchlist search, 45-expert voting, pre-market analysis, intraday monitoring, risk control, positions, trade logs, memory replay, and model-group performance.
- **OpenCode Remote Coding**: OpenCode Web is embedded in the desktop through a backend reverse proxy and a second app lock.
- **RSS Daily Brief**: Reader is now RSS-only, keeping feed pulling, deduplication, categorization, daily briefs, read-later, AI summaries, and AI translation.
- **Personal Productivity Desktop**: Notes, Dida365 lite, downloads, system status, service monitor, file manager, local music, NetEase music, video, and cloud-drive entries.
- **Remote Access Friendly**: Works well over Tailscale, WireGuard, or a local reverse proxy, while core services bind to loopback by default.

## Screenshots

<div align="center">
<img src=".github/stock-trading-proof.png" width="960" alt="AI Stock Analysis Guide" />
<p><em>AI Stock Analysis guide page: pre-market analysis, opening execution, intraday monitoring, post-market learning, and weekly/monthly reports.</em></p>
</div>

## Core Features

| Module | Description |
|---|---|
| **Desktop Shell** | Top status bar, top mini dock, window management, wallpapers, notification center, widgets, and service state. |
| **AI Stock Analysis** | Data collection, market regime, candidate signals, triple-stream scoring, LLM expert voting, Conviction Filter, position risk, trade logs, and memory replay. |
| **OpenCode** | Local OpenCode Web embedded through `/proxy/opencode`; the backend injects Basic Auth and the frontend only receives a locked access cookie. |
| **OpenClaw** | Local OpenClaw Gateway embedded by iframe proxy without modifying the upstream gateway. |
| **Reader** | RSS feed pulling, deduplication, categorization, daily briefs, read-later, AI summary, and AI translation. |
| **Notes** | Local Markdown files, folders, rich-text editing, image drops, and task lists. |
| **Dida Lite** | Dida365 OAuth, inbox widget, natural-language quick task creation, task management, and calendar view. |
| **Music & Video** | Local music library, NetEase streaming, lyrics, video search, and HLS playback. |
| **Files & Cloud Drives** | FileBrowser for local files and AList proxy for Baidu/Quark cloud drives. |
| **Downloads** | Aria2 RPC queue, speed display, history, cleanup, and download path configuration. |
| **System Monitoring** | CPU, memory, disk, network, systemd health, and HTTP performance logs. |

## Desktop Features

- **Top Mini Dock**: Embedded in the status bar. It opens, switches, and minimizes apps like a taskbar. When enabled, the bottom dock is not rendered.
- **Window Management**: macOS-style red/yellow/green controls for close, minimize, fullscreen, and focus switching.
- **Desktop Widgets**: Dida inbox, Xiaoshan weather, system resources, download queue, and now-playing music.
- **Notification Center**: Backend-persisted notifications, polling fallback, toast messages, and local optimistic injection.
- **Persistent Settings**: Dock, wallpapers, widgets, paths, and media preferences are stored in backend UI config.

## AI Stock Analysis

The AI stock module is a local JSON-persisted A-share decision-support system. It is not a brokerage auto-trading program. It can generate signals, monitor risk, and record actions, but the user remains fully responsible for any trade decision.

Current daily flow:

| Time | Action |
|---|---|
| 07:30 | Morning supplemental analysis: merge overnight announcements, news, and sentiment into the previous trading day's FactPool. |
| 08:05 | Pre-market daily analysis: screen the stock pool, compute technical/quant/expert scores, and generate candidate signals. |
| 09:25 | Intraday monitor starts and begins polling holdings and quotes. |
| 09:31 | Opening execution handles `strong_buy` / `buy` / `watch` signals according to configuration. |
| 09:30-15:00 | Realtime quote refresh updates `signal.realtime` for latest price, percent change, and OHLC display. |
| Trading hours | Intraday risk control handles stop-loss, take-profit, overholding, abnormal volatility, and sector-move alerts. |
| 16:00 | Post-market analysis refreshes closing data, reevaluates positions, updates model performance, and writes daily memories. |
| Friday/month-end | Weekly and monthly reports summarize returns, win rate, drawdown, behavior profile, and model-group performance. |

Historical live-trading note: an early April 2026 personal run recorded 10 completed round trips, 9 profitable trades, and an average return of roughly +3.19% per trade. This is a historical personal record only, not a promise of future returns or investment advice.

## Architecture

```text
Browser
  │
  ▼
ClawOS Backend (:3001)
  ├── Static React SPA
  ├── REST API (/api/system/*)
  ├── OpenCode reverse proxy (:4096, 127.0.0.1 only)
  ├── OpenClaw reverse proxy (:18789)
  ├── FileBrowser reverse proxy (:18790)
  ├── Aria2 RPC (:6800)
  └── AList proxy (:5244)
```

| Layer | Stack |
|---|---|
| **Frontend** | React 19 + Vite 8 + TypeScript + Tailwind CSS 4 + Zustand + Framer Motion |
| **Backend** | Node.js + Express 5 + TypeScript + Winston logging |
| **AI Data** | Node/TypeScript main service + controlled Python/AKShare subprocesses for A-share data |
| **Editor** | Tiptap rich-text editor with Markdown files on disk |
| **Integrations** | OpenCode, OpenClaw, FileBrowser, AList, Aria2, NetEase Music API |

## Quick Start

### Requirements

- Linux, Ubuntu 24.04+ recommended.
- Node.js 20+.
- Python 3 for AKShare-backed AI stock data collection.
- Optional: Tailscale, OpenCode CLI, OpenClaw, Aria2, AList, FileBrowser.

### 1. Clone and Install

```bash
git clone https://github.com/gumustudio/ClawOS-HighWinningStock.git
cd ClawOS-HighWinningStock
npm install --prefix frontend
npm install --prefix backend
```

### 2. Configure Login Password

```bash
mkdir -p ~/.clawos
printf 'CLAWOS_PASSWORD=your_password\n' > ~/.clawos/.env
chmod 600 ~/.clawos/.env
```

### 3. Build and Run

```bash
./scripts/build.sh
./scripts/start-dev.sh
```

Development URLs:

| Service | URL |
|---|---|
| Frontend | `http://localhost:5173` |
| Backend | `http://localhost:3001` |

Production mode:

```bash
./scripts/install-systemd.sh
systemctl --user restart clawos.service
```

## Configuration

### Environment Variables

| Variable | Description |
|---|---|
| `CLAWOS_PASSWORD` | ClawOS login password. Username is always `clawos`. |
| `PORT` | Backend port. Default: `3001`. |
| `OPENCLAW_GATEWAY_TOKEN` | OpenClaw Gateway auth token. |
| `OPENCODE_SERVER_PASSWORD` | OpenCode Web Basic Auth password. Read by the backend only. |
| `CLAWOS_OPENCODE_APP_PASSWORD` | Internal ClawOS OpenCode app-lock password. Can differ from the OpenCode service password. |
| `DIDA_CLIENT_ID` / `DIDA_CLIENT_SECRET` | Dida365 OAuth credentials. |
| `BAIDU_NETDISK_CLIENT_ID` / `BAIDU_NETDISK_CLIENT_SECRET` | Baidu Netdisk OAuth credentials. |

Secrets must live in local environment files or systemd `EnvironmentFile` files. Do not commit them to the repository.

### Path Configuration

All working directories are configurable in Settings or `~/.clawos/config.json`:

```json
{
  "paths": {
    "downloadsDir": "~/Downloads",
    "musicDownloadsDir": "~/Music",
    "notesDir": "~/Documents/Notes",
    "readerDir": "~/Documents/RSS",
    "stockAnalysisDir": "~/Documents/StockAnalysis",
    "videoDownloadsDir": "~/Videos"
  }
}
```

## Security Boundary

- ClawOS backend binds to `127.0.0.1:3001` by default.
- All routes are protected by HTTP Basic Auth by default, with a custom frontend login screen.
- OpenCode Web listens on `127.0.0.1:4096` and is accessed through the ClawOS backend proxy.
- `/proxy/opencode` requires the ClawOS OpenCode app-lock cookie; the backend injects OpenCode Basic Auth.
- FileBrowser and local media streams use separate HttpOnly cookies because browser media tags cannot send Basic Auth headers.
- Reader is RSS-only and no longer accepts OpenClaw local inbox imports.

## External Services

All external services are optional. If a service is missing, its app shows an unavailable state while the core desktop continues to work.

| Service | Default Port | Purpose |
|---|---:|---|
| OpenCode Web | `4096` | Remote coding frontend, loopback-only. |
| OpenClaw Gateway | `18789` | AI chat gateway. |
| FileBrowser | `18790` | Local file UI. |
| Aria2 | `6800` | Download engine RPC. |
| AList | `5244` | Baidu/Quark cloud-drive mounting. |

## Testing

```bash
npm --prefix backend test
npm --prefix frontend test
npm --prefix backend run build
npm --prefix frontend run build
```

## Project Structure

```text
ClawOS/
├── frontend/           # React desktop frontend
│   ├── src/apps/       # Built-in apps
│   ├── src/components/ # Dock, notifications, widgets, windows
│   ├── src/lib/        # APIs, notification SDK, server config
│   └── public/         # Wallpapers and static assets
├── backend/            # Express APIs, proxies, and services
│   ├── src/routes/     # API routes
│   ├── src/services/   # AI stock, Reader, notifications, music, downloads
│   ├── src/utils/      # Config, logging, probes
│   └── tests/          # Backend tests
├── scripts/            # Build, deploy, and systemd scripts
└── filebrowser/        # Local FileBrowser integration files
```

## FAQ

**Can I use it without Aria2, AList, OpenClaw, or OpenCode?**

Yes. They are optional integrations. Their apps will show unavailable or require configuration, while the desktop, settings, Reader, Notes, and other core features continue to work.

**How should I access it remotely?**

Use Tailscale or WireGuard. Do not expose `3001`, `4096`, or `18789` directly to the public Internet.

**How do I update?**

```bash
git pull
./scripts/build.sh
systemctl --user restart clawos.service
```

## Disclaimer

The AI stock module provides analysis assistance, risk alerts, and local records only. It is not investment advice and does not guarantee returns. Users are fully responsible for their own trading decisions and capital risk.

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).

<div align="center">

---

Built with care by [gumustudio](https://github.com/gumustudio)

</div>
