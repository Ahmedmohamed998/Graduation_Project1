# Hasibha – Docker Setup

A complete Docker Compose configuration for the **Hasibha** graduation project backend.

## Services

| Service | Image | Port | Tech |
|---------|-------|------|------|
| `auth-backend` | `hasibha/auth-backend` | **3210** | Node.js 20 / Express |
| `home-backend` | `hasibha/home-backend` | **5001** | Node.js 20 / Express |
| `ai-service` | `hasibha/ai-service` | **8000** | Python 3.11 / FastAPI |

> **MongoDB** is hosted on **Atlas** (cloud) – no local database container is needed.

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) ≥ 24
- Each service has its own `.env` file (see below)

---

## Quick Start

### 1 – Set up environment files

Copy the example files and fill in your real secrets:

```bash
cp auth-backend/.env.example   auth-backend/.env
cp home-backend/.env.example   home-backend/.env
cp grad_project_ai/.env.example grad_project_ai/.env
```

> ⚠️ **Important**: `JWT_SECRET` must be **identical** in both `auth-backend/.env` and `home-backend/.env`.

### 2 – Firebase service-account key

Make sure the file `hasibha-notificatio-firebase-adminsdk-fbsvc-ac5586ab12.json`
exists in the **project root** (next to `docker-compose.yml`).
It is bind-mounted read-only into the `home-backend` container automatically.

### 3 – Build & start everything

```bash
# From the project root:
docker compose up --build -d
```

### 4 – Verify services are healthy

```bash
docker compose ps
```

You should see all three services with status `healthy` (after ~40 s).

### 5 – Check logs

```bash
docker compose logs -f            # all services
docker compose logs -f auth-backend
docker compose logs -f home-backend
docker compose logs -f ai-service
```

---

## Health Endpoints

| Service | URL |
|---------|-----|
| auth-backend | `GET http://localhost:3210/health` |
| home-backend | `GET http://localhost:5001/health` |
| ai-service (docs) | `GET http://localhost:8000/docs` |

---

## Useful Commands

```bash
# Stop all containers (keep data)
docker compose stop

# Stop and remove containers + network
docker compose down

# Rebuild a single service after code changes
docker compose up --build auth-backend -d

# Open a shell in a running container
docker compose exec auth-backend sh
docker compose exec home-backend sh
docker compose exec ai-service bash
```

---

## Inter-service Communication

Inside the Docker network `hasibha-net`, services reach each other by their
**service name** (not `localhost`):

| From | To | URL |
|------|----|-----|
| `home-backend` | `ai-service` | `http://ai-service:8000` |

This is already configured via the `AI_AGENT_URL` environment override in
`docker-compose.yml`.

---

## Environment Variables Reference

### auth-backend
| Variable | Required | Notes |
|----------|----------|-------|
| `MONGO_URI` | ✅ | MongoDB Atlas connection string |
| `JWT_SECRET` | ✅ | Must match home-backend |
| `EMAIL_USER` / `EMAIL_PASS` | ✅ | Gmail app password |
| `TWILIO_*` | ✅ | SMS OTP |
| `GOOGLE_CLIENT_IDS` | ✅ | Google OAuth |

### home-backend
| Variable | Required | Notes |
|----------|----------|-------|
| `MONGODB_URI` | ✅ | Same Atlas cluster |
| `JWT_SECRET` | ✅ | Must match auth-backend |
| `AI_AGENT_URL` | ✅ | Auto-set to `http://ai-service:8000` |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | ✅ | Auto-set via volume mount |

### ai-service
| Variable | Required | Notes |
|----------|----------|-------|
| `AZURE_OPENAI_API_KEY` | ✅ | Chat / categorize |
| `AZURE_SPEECH_KEY` | ✅ | Voice transcription |
| `AZURE_DOC_INTEL_KEY` | ✅ | OCR scanning |
| `MONGODB_URI` | ✅ | Chat memory storage |
