# IdeaFarming

An internal web application for collecting, rating, and acting on employee ideas through quarterly **Innovation Days**.

> **Status:** Active development — pre-production

---

## What it does

Employees submit improvement ideas year-round. Ideas are rated on Business Impact and Effort, discussed via threaded comments, and periodically promoted into **Challenges** on an Innovation Day. During an Innovation Day, employees self-organize into teams, work on their challenges, and produce a structured report. Outstanding work can be marked as Featured by an Admin.

Key concepts: **Ideas → Challenges → Innovation Days → Teams → Reports**

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, TypeScript |
| Backend API | Fastify 5, Node.js 20, TypeScript |
| Database | PostgreSQL 16 |
| Containerisation | Docker / Docker Compose |

---

## Getting started (local dev)

**Prerequisites:** Docker Desktop

```bash
git clone https://github.com/remipaquette/IdeaFarming.git
cd IdeaFarming
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3000 |
| Health check | http://localhost:3000/health |

Default admin credentials (dev only): `admin@company.com` / `Admin1234!`

---

## Project structure

```
├── backend/          # Fastify API + PostgreSQL migrations
│   ├── src/          # Route handlers and service layer
│   ├── migrations/   # SQL migration files (auto-applied on start)
│   └── scripts/      # One-off admin utilities
├── frontend/         # React SPA
│   └── src/
├── docs/
│   ├── prd.md              # Product Requirements Document
│   ├── deployment-guide.md # IT deployment guide
│   └── adr/                # Architecture Decision Records
├── docker-compose.yml
└── CONTEXT.md        # Domain glossary
```

---

## CI

GitHub Actions runs on every push:

- **Backend:** type-check → lint → test → build
- **Frontend:** type-check → lint → build

---

## Deployment

See [docs/deployment-guide.md](docs/deployment-guide.md) for the full IT deployment guide, including environment variables, production architecture, and known pre-production gaps.
