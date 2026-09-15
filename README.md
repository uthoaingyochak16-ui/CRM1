# Quantum Foundation

Quantum Foundation is a web platform for registrations, customer
relationship management (CRM), and task tracking. It also includes team
performance reports, an internal feed, and an AI assistant widget — all in
one app.

---

## Overview

The app has two parts:

- **Backend** — a FastAPI service. Handles login, registrations, customers,
  tasks, reports, notifications, the internal feed, and the AI assistant.
- **Frontend** — a React (Vite) app, built and served as static files.

Login uses **JWT tokens**. The backend issues a token, and the frontend
stores it and sends it with each request.

---

## Architecture

- **Backend:** FastAPI + SQLAlchemy. Database changes go through **Alembic**
  migrations, which run automatically when the backend starts.
- **Frontend:** built with Vite, served by nginx. nginx also forwards
  `/api/*` and `/uploads/*` requests to the backend, and is the only
  container reachable from outside Docker.
- **Database:** PostgreSQL.

There's no reverse proxy or TLS layer inside this project — the frontend
container is published directly on a host port, over plain HTTP. If you
need HTTPS, put something in front of it (a reverse proxy, load balancer,
or Cloudflare) and point that at the frontend's host port.

### Two separate stacks

In production, the app runs as **two separate Docker Compose stacks**. Each
one is its own project, and they only talk to each other over one shared
network (`quantum_internal`):

| Stack | Files | What it does |
| --- | --- | --- |
| **Database** | `docker-compose.db.yml` | Creates the shared network. Stays running all the time — you start it once and leave it alone. |
| **App** | `docker-compose.yml` + `docker-compose.prod.yml` | Backend and frontend. Joins the network. You redeploy this one whenever the code changes. |

This split means redeploying the app never restarts the database. The
database holds real data, and it shouldn't be touched just because you
shipped a new build.

`docker-compose.yml` by itself has safe default values, so it can run
without a `.env` file. `docker-compose.prod.yml` is what turns it into a
real production setup — it adds `restart: unless-stopped`, some container
hardening, and requires the real values for things like `JWT_SECRET`,
`CORS_ORIGINS`, `DOMAIN`, and the database credentials instead of silently
using a default.

---

## Project Structure

```
Quantum-Communication/
├── backend/                    # FastAPI application
│   ├── app/                    # routers, models, config, auth
│   ├── migrations/             # Alembic migration scripts
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                   # React (Vite) app
│   ├── src/
│   ├── nginx.conf              # serves the built app + proxies /api, /uploads
│   └── Dockerfile.prod
├── scripts/
│   ├── backup-to-r2.sh         # backs up the database and uploads to Cloudflare R2
│   └── restore-database-from-r2.sh
├── docker-compose.yml          # app stack (backend, frontend)
├── docker-compose.prod.yml     # production settings for the app stack
├── docker-compose.db.yml       # database stack
└── .env.example                # template for all settings and secrets
```

---

## Tech Stack

- **Backend:** FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL, PyJWT, bcrypt, APScheduler
- **Frontend:** React 19, Vite, Tailwind CSS, TanStack Query, React Router
- **Infra:** Docker + Docker Compose, nginx

---

## How It Runs (containers)

| Service | Image | Role |
| --- | --- | --- |
| `db` | `postgres:16-alpine` | The database. Not reachable from outside Docker. |
| `backend` | `python:3.12-slim` | The FastAPI app, on port `8000`. Published directly to the host. |
| `frontend` | `nginx:1.27-alpine` | Serves the built app, on port `80`. Published directly to the host, and also forwards API/upload requests to the backend. |

The frontend is published on host port `80` by default (change it with
`FRONTEND_HOST_PORT` in `.env`), and the backend on host port `8000`
(change it with `BACKEND_HOST_PORT`). Only the database stays unreachable
from outside Docker.

Every time the backend starts, it:

1. Runs any pending **Alembic** migrations.
2. Creates the **initial admin account** from `.env` — or, if that account
   already exists, just makes sure it still has admin rights. Safe to run
   on every redeploy; it never creates duplicates.

---

## Production Deployment

You'll need Docker Engine and the Docker Compose plugin on the server.

### 1. Prepare the server

- Ubuntu/Debian Linux server
- Firewall open on the ports the frontend and backend will use (`80` and
  `8000` by default)
- Docker Engine and the Docker Compose plugin installed

Get the project onto the server, then move into the project folder.

### 2. Configure `.env`

Copy the example file:

```bash
cp .env.example .env
```

Now open `.env` and replace every `CHANGE_ME` value. `DOMAIN` should just be
the hostname — no `http://`/`https://`, no trailing slash. Here's what a
filled-in `.env` looks like:

```dotenv
DOMAIN=crm.example.com
FRONTEND_HOST_PORT=80
BACKEND_HOST_PORT=8000

POSTGRES_USER=quantum_user
POSTGRES_PASSWORD=CHANGE_ME_URL_SAFE_DATABASE_PASSWORD
POSTGRES_DB=quantum_communication

JWT_SECRET=CHANGE_ME_RANDOM_SECRET_AT_LEAST_48_CHARACTERS
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=480

INITIAL_ADMIN_NAME="Super Admin"
INITIAL_ADMIN_EMAIL=admin@example.com
INITIAL_ADMIN_PASSWORD=CHANGE_ME_STRONG_ADMIN_PASSWORD

CORS_ORIGINS=https://crm.example.com
PUBLIC_BASE_URL=https://crm.example.com
PASSWORD_MIN_LENGTH=10

# Optional AI integration
AI_PROVIDER=anthropic
AI_MODEL=claude-haiku-4-5-20251001
AI_API_ENDPOINT=https://api.anthropic.com
AI_API_KEY=
```

`CORS_ORIGINS` and `PUBLIC_BASE_URL` should still use `https://` here even
though the app itself only speaks plain HTTP — these describe the public
address people actually use in their browser. If nothing in front of this
server terminates HTTPS, use `http://` instead; just make sure both agree
with each other and with `DOMAIN`.

The frontend always calls the API on its own origin — nginx forwards `/api`
and `/uploads` to the backend no matter what domain the page was loaded
from — so there's no API URL to configure.

To generate a random secret:

```bash
openssl rand -hex 48
```

Keep `POSTGRES_PASSWORD` URL-safe (letters and numbers). **Never commit
`.env` to Git.**

The AI API key can come from two places: `AI_API_KEY` in `.env` is the
fallback, or an admin can set it from the AI widget's settings after
logging in. A value saved there wins over `.env`. Regular users can't
change the AI settings.

### 3. Deploy

Start the database first — it creates the shared network the app stack
needs:

```bash
docker compose --env-file .env -f docker-compose.db.yml up -d
```

Then build and start the app:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

**The order matters the first time.** If the app command fails with a
network error, it means the database stack isn't running yet — start that
first.

Check that everything is working:

```bash
curl -fsS http://localhost/api/health
docker compose --env-file .env -f docker-compose.db.yml ps
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps
```

The first startup creates the database schema and the initial admin
account from `.env`. Log in and change the admin password right away.

### Update

```bash
git pull --ff-only
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

This only touches the app stack — the database keeps running as it is.

### If you already have a database

Back up the database and the `uploads` folder first. If that database
already has the full schema, stamp the initial migration instead of letting
Alembic try to create it again:

```bash
docker compose --env-file .env -f docker-compose.db.yml up -d
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml run --rm backend alembic stamp 20260810_0001
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Don't do this on an empty database — a normal deploy already creates the
schema for you.
