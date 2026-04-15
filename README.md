> ⚠️ **LICENSED MATERIAL — DO NOT REDISTRIBUTE**
>
> This source code is the exclusive property of **Derrick Tantra** (meetbob.tech).
> Redistribution, selling, or publishing this code in any form is **strictly prohibited**
> and will result in **legal action** under Indonesian copyright law (UU Hak Cipta No. 28 Tahun 2014)
> and the Berne Convention.
>
> By accessing this repository, you agree to the full terms in [LICENSE](./LICENSE).
>
---

# OpenClaw Dashboard

A universal dashboard for managing your [OpenClaw](https://github.com/nickthecook/openclaw) AI agent fleet. Monitor live sessions, manage tasks, coordinate agents, and view your digital office — all from a single, real-time control surface.

## Prerequisites

- **OpenClaw** running locally (gateway accessible)
- **Node.js** 18+
- **npm** or equivalent package manager

## Quick Start

```bash
# Clone the repository
git clone <repo-url> openclaw-dashboard
cd openclaw-dashboard

# Install dependencies
npm install

# Copy environment template and configure
cp .env.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENCLAW_GATEWAY_URL` | Yes | `http://127.0.0.1:18789` | Your OpenClaw gateway HTTP endpoint |
| `OPENCLAW_GATEWAY_TOKEN` | No | — | Bearer token if gateway auth is enabled |
| `OPENCLAW_GATEWAY_RPC_PATHS` | No | `/rpc,/api/rpc` | Comma-separated RPC endpoint paths |
| `OPENCLAW_DEFAULT_MODEL` | No | — | Default model for spawned subagents |
| `OPENCLAW_TOOLS_PROFILE` | No | `coding` | Tool profile for spawned subagents |
| `OPENCLAW_RUN_TIMEOUT_MAX` | No | `1800` | Max run timeout in seconds |
| `NEXT_PUBLIC_DASHBOARD_TITLE` | No | `OpenClaw Dashboard` | Title shown in nav and browser tab |
| `NEXT_PUBLIC_DASHBOARD_LOGO` | No | `/logo.png` | Path to your logo image |
| `NEXT_PUBLIC_DASHBOARD_ACCENT_COLOR` | No | `#FF6B2B` | Primary accent color |
| `NEXT_PUBLIC_OWNER_NAME` | No | `Owner` | Display name for the dashboard owner |
| `NEXT_PUBLIC_DASHBOARD_SUBTITLE` | No | `Mission Control` | Subtitle shown in the nav rail |

## Features

- **Dashboard** — Overview of all agents, tasks, and system health
- **Digital Office** — Galaxy-themed visual command center with real-time agent orbs
- **Task Board** — Kanban-style task management with goal filtering
- **Agent Inbox** — QA workspace for reviewing agent work and transcripts
- **Calendar** — Week view with event management and cron job visibility
- **Cron Management** — View and manage scheduled agent jobs
- **Team Structure** — Role-based team view with spawn controls

## Agents

Agents are discovered dynamically from your OpenClaw gateway sessions. Any agent registered with your gateway will automatically appear in the dashboard — no configuration needed.

## Customization

Place your logo file in the `public/` directory and set `NEXT_PUBLIC_DASHBOARD_LOGO` to its path (e.g., `/my-logo.png`).

## API

`POST /api/panels/:panelId/run`

Body:
```json
{
  "task": "implement x",
  "model": "GPT-5.3 Codex",
  "timeoutSeconds": 900
}
```

Behavior:
- Validates allowed panel ids.
- Calls OpenClaw Gateway `sessions_spawn` using JSON-RPC.
- Uses run timeout bounds and explicit error mapping (400/404/502/504/500).
- Returns `sessionId` / `runId` when available.

## Tech Stack

- **Next.js 14** (App Router)
- **React 18**
- **TypeScript**
- **Tailwind CSS**
- **GSAP** (animations)
- **Zustand** (state management)

## Development

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # Run ESLint
npm run start    # Start production server
```
