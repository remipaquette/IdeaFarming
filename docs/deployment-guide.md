# IdeaFarming — Deployment Guide

**Audience:** IT / Infrastructure team  
**Application status:** Active development (pre-production)  
**Date:** May 2026

---

## 1. Overview

IdeaFarming is a company-internal web application for collecting, rating, and acting on employee ideas through quarterly Innovation Days. It consists of three components:

| Component | Technology | Port |
|---|---|---|
| **Frontend** | React 18 / Vite / Tailwind | 5173 (dev) or 80/443 (prod) |
| **Backend API** | Node 20 / Fastify / TypeScript | 3000 |
| **Database** | PostgreSQL 16 | 5432 |

All three are containerised. The canonical way to run the full stack is via **Docker Compose**.

---

## 2. Prerequisites

| Requirement | Minimum version | Notes |
|---|---|---|
| Docker Engine | 24.x | CE edition is fine |
| Docker Compose | v2.x (`docker compose`) | Bundled with Docker Desktop |
| Outbound internet access | — | Required on first build to pull base images and npm packages |
| DNS / hostname | — | Needed before go-live so you can set `CORS_ORIGIN` correctly |
| TLS termination | — | Handled externally (reverse proxy — see section 6) |

> **No Node.js or npm installation is needed on the host.** Everything runs inside Docker.

---

## 3. Repository Layout

```
IdeaFarming_Vibe/
├── docker-compose.yml        ← orchestration file
├── backend/
│   ├── Dockerfile            ← multi-stage build (builder + runtime)
│   ├── migrations/           ← SQL files, applied automatically on start
│   ├── scripts/              ← one-off admin utilities (run from host, not container)
│   └── src/
├── frontend/
│   ├── Dockerfile
│   └── src/
```

---

## 4. Environment Variables

> **Critical:** The values shipped in `docker-compose.yml` are development defaults only. Replace every value marked **[CHANGE]** before any non-local deployment.

### 4.1 Backend

| Variable | Default (dev) | Description | Required |
|---|---|---|---|
| `DATABASE_URL` | `postgres://ideafarming:ideafarming@db:5432/ideafarming` | Full PostgreSQL connection string | Yes |
| `PORT` | `3000` | Port the API listens on | Yes |
| `JWT_SECRET` | `dev-secret-change-in-production-min-32-chars!!` | **[CHANGE]** Secret used to sign auth tokens. Min 32 characters. Generate with `openssl rand -hex 32`. | Yes |
| `CORS_ORIGIN` | `http://localhost:5173` | **[CHANGE]** Exact URL of the frontend as seen by the browser (e.g. `https://ideafarming.company.com`) | Yes |
| `NODE_ENV` | `development` | **[CHANGE]** Set to `production` for production deployments | Yes |
| `ADMIN_SEED_EMAIL` | `admin@company.com` | **[CHANGE]** Email for the first admin account (seeded on first boot only) | Recommended |
| `ADMIN_SEED_PASSWORD` | `Admin1234!` | **[CHANGE]** Password for the first admin account. Change immediately after first login. | Recommended |
| `UPLOAD_DIR` | `/app/uploads` | Internal path where uploaded images are stored. Mapped to a Docker volume. | Yes |

### 4.2 Database

| Variable | Default (dev) | Description |
|---|---|---|
| `POSTGRES_DB` | `ideafarming` | Database name |
| `POSTGRES_USER` | `ideafarming` | Database user |
| `POSTGRES_PASSWORD` | `ideafarming` | **[CHANGE]** Database password — update in both the `db` service and `DATABASE_URL` |

### 4.3 Recommended secrets management

Do **not** commit production secrets to source control. Options:
- Use a `.env` file (excluded from git via `.gitignore`) and reference it in `docker-compose.yml` with `env_file: .env`.
- Use Docker Swarm secrets or a secrets manager (HashiCorp Vault, AWS Secrets Manager, Azure Key Vault).

---

## 5. First Deployment (Docker Compose)

### Step 1 — Clone the repository

```bash
git clone <repo-url> ideafarming
cd ideafarming
```

### Step 2 — Create a production environment file

Create a file named `.env` in the project root (next to `docker-compose.yml`):

```env
# Database
POSTGRES_PASSWORD=<strong-random-password>

# Backend
DATABASE_URL=postgres://ideafarming:<strong-random-password>@db:5432/ideafarming
JWT_SECRET=<output-of-openssl-rand-hex-32>
CORS_ORIGIN=https://ideafarming.company.com
NODE_ENV=production
ADMIN_SEED_EMAIL=admin@company.com
ADMIN_SEED_PASSWORD=<strong-initial-password>
UPLOAD_DIR=/app/uploads
```

> Make sure `POSTGRES_PASSWORD` in `DATABASE_URL` matches `POSTGRES_PASSWORD` exactly.

### Step 3 — Update docker-compose.yml to use the env file

Add `env_file: .env` to the `db` and `backend` service definitions, or override specific values with the `environment:` block referencing variables from `.env`.

### Step 4 — Build and start

```bash
docker compose up --build -d
```

This will:
1. Build the backend TypeScript image (multi-stage: compile → slim runtime).
2. Build the frontend image.
3. Start PostgreSQL, run a health check.
4. Start the backend; on first boot it auto-runs all SQL migrations in `backend/migrations/` and seeds the initial admin account.
5. Start the frontend.

### Step 5 — Verify

```bash
# Check all three containers are running
docker compose ps

# Check the API health endpoint
curl http://localhost:3000/health
# Expected: {"status":"ok","database":"PostgreSQL 16..."}
```

### Step 6 — First login

Navigate to the application URL, log in with the `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` credentials, and **immediately change the admin password** from the admin settings screen.

---

## 6. Production Architecture (Recommended)

The current Docker Compose setup does **not** include TLS termination or a production-grade frontend server. For production:

```
Internet
   │
   ▼
[Reverse Proxy: nginx or Traefik]  ← handles TLS (port 443)
   │                  │
   │  /api/*          │  /*
   ▼                  ▼
[Backend :3000]   [Frontend :80]
                       │
                  [PostgreSQL :5432]  (internal only, not exposed)
```

### Recommended changes for production

1. **Frontend Dockerfile** — replace the dev server with a proper Nginx static build:

   ```dockerfile
   FROM node:20-alpine AS builder
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci
   COPY . .
   RUN npm run build

   FROM nginx:alpine
   COPY --from=builder /app/dist /usr/share/nginx/html
   COPY nginx.conf /etc/nginx/conf.d/default.conf
   EXPOSE 80
   ```

2. **Remove public port exposure for PostgreSQL** — in `docker-compose.yml`, remove the `ports:` section from the `db` service. The database should not be reachable from outside the Docker network.

3. **Reverse proxy** — place nginx or Traefik in front of both services to handle:
   - TLS (HTTPS with a valid certificate)
   - Routing `/api/` (or all non-asset paths) to the backend
   - Serving the frontend static files (or proxying to the frontend container)

4. **Persistent volume backup** — back up the `uploads_data` Docker volume (user-uploaded images) and the PostgreSQL data volume on a regular schedule.

---

## 7. Database Migrations

Migrations run **automatically** when the backend starts. They are idempotent: already-applied migrations are tracked in the `_migrations` table and skipped.

Migration files are located in `backend/migrations/` and applied in alphabetical (numeric prefix) order:

| File | Description |
|---|---|
| `001_initial.sql` | Schema placeholder |
| `002_auth.sql` | Employees table, password reset tokens |
| `003_categories.sql` | Idea categories |
| `004_ideas.sql` | Ideas table |
| `005_ratings.sql` | Business impact and effort ratings |
| `006_comments.sql` | Threaded comments |
| `007_idea_discovery.sql` | Idea discovery features |
| `008_innovation_day.sql` | Innovation Day scheduling |
| `009_challenge_promotion.sql` | Challenge / promotion workflow |
| `010_report.sql` | Reporting aggregates |

> **Note:** As the application is still in development, additional migration files will be added. No manual SQL execution is needed — simply pull the latest code and restart the backend container.

---

## 8. Health Check

The backend exposes a `/health` endpoint that also verifies database connectivity:

```
GET http://<backend-host>:3000/health

200 OK
{"status":"ok","database":"PostgreSQL 16.x ..."}
```

Configure your load balancer or monitoring tool to poll this endpoint.

---

## 9. File Uploads

- Uploaded images (attached to Ideas) are stored in the `uploads_data` Docker named volume, mounted at `/app/uploads` inside the backend container.
- The backend serves them at `/uploads/<filename>`.
- **Maximum file size:** 5 MB per file, 1 file per request.
- **Backup:** Include the `uploads_data` volume in your backup routine.

---

## 10. User Provisioning

There is no self-registration UI in v1. User accounts are created by an Admin through the application's admin interface.

To create additional admin accounts, use the `backend/scripts/create-admin.ts` script. **This must be run from the host machine** (or a CI runner) against the exposed database port — the production Docker image does not include `ts-node` and does not copy `scripts/`.

```bash
# From the backend/ directory on the host (requires Node.js + dependencies installed locally)
cd backend
npm install
$env:DATABASE_URL="postgres://ideafarming:<password>@localhost:5432/ideafarming"
npx ts-node --transpile-only --skip-project scripts/create-admin.ts admin@company.com <password>
```

Alternatively, set `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD` in the environment before first boot to have the backend seed the initial admin automatically (see Section 4.1).

---

## 11. Ports Summary

| Service | Internal port | Exposed (dev) | Notes |
|---|---|---|---|
| Frontend | 5173 | 5173 | Dev Vite server — replace with Nginx in prod |
| Backend API | 3000 | 3000 | Keep internal in prod; proxy from reverse proxy |
| PostgreSQL | 5432 | 5432 | **Remove from prod exposure** |

---

## 12. Stopping and Updating

```bash
# Stop all containers (keeps volumes/data)
docker compose down

# Pull latest code and redeploy
git pull
docker compose up --build -d
```

Migrations run automatically on restart. No manual database steps required for patch/minor updates.

---

## 13. Known Pre-Production Gaps

The following items are not yet production-ready and should be addressed before go-live:

| Gap | Description |
|---|---|
| **PostgreSQL data volume** | The `db` service in `docker-compose.yml` has **no named volume** for `/var/lib/postgresql/data`. Running `docker compose down` will destroy all database data. Add a named volume (e.g. `postgres_data`) to both the `db` service and the `volumes:` block before any non-throwaway deployment. |
| Frontend Dockerfile | Currently runs the Vite **dev server** — must be replaced with a static build + Nginx for production |
| TLS / HTTPS | Not configured in-app — must be handled by a reverse proxy |
| PostgreSQL port exposure | Port 5432 is published to the host in `docker-compose.yml` — remove for production |
| Email / SMTP | Password reset tokens are created in the database but no email delivery is implemented yet — users cannot complete self-service password resets |
| Log aggregation | Application logs go to stdout only — integrate with your logging stack (ELK, Loki, etc.) |
| Secrets management | Secrets are currently passed via environment variables — integrate with a secrets vault for production |

---

## 14. Support Contacts

| Role | Contact |
|---|---|
| Application owner / Product | *(fill in)* |
| Development team | *(fill in)* |
| Infrastructure / IT | *(fill in)* |
