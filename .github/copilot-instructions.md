# Copilot Agent Instructions

## Local Development Servers

**ALL** long-running processes (backend, frontend, worker) MUST be started using **background tasks only** — bash tool with `mode="async"` and **without** `detach: true`. This keeps them visible in the `/tasks` panel. Never use `nohup`, `&`, or `detach: true` for these processes.

To restart any process: use `stop_bash` with the shellId, then start again with the same shellId.

### Backend

```bash
shellId: zenith-backend
mode: async   # NO detach: true
cd /home/dev/zenith/backend && source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8011 --reload
```

- Port: **8011**
- Database: `zenith_local` (local PostgreSQL)
- Python venv: `backend/.venv`

### Frontend

```bash
shellId: zenith-frontend
mode: async   # NO detach: true
cd /home/dev/zenith/frontend && npm run dev -- --host 0.0.0.0 --port 3000
```

- Port: **3000**
- Framework: Vite + React + TypeScript

### Worker

```bash
shellId: zenith-worker
mode: async   # NO detach: true
cd /home/dev/zenith/backend && source .venv/bin/activate && python worker_main.py
```

### Verify All Are Running

```bash
curl -s -o /dev/null -w "backend: %{http_code}\n" http://localhost:8011/health
curl -s -o /dev/null -w "frontend: %{http_code}\n" http://localhost:3000
ps aux | grep worker_main | grep -v grep
```

## Git Workflow

**Never run `git push` automatically.** Always commit changes locally and stop there. The developer will push manually or explicitly request the agent to push.

## Project Structure

- **Backend**: FastAPI, SQLAlchemy, Alembic — `backend/`
- **Frontend**: React 18, Vite, TypeScript, Tailwind v4 — `frontend/`
- **Deploy**: Railway (auto-deploy from `main` branch)

## Tech Notes

- Tailwind v4: theme tokens are `--color-*` (e.g. `var(--color-input)`), not `--input`
- CSS variables do NOT resolve inside `-webkit-autofill` rules — use hardcoded hex values
- Inline `<style>` in `index.html` is unlayered CSS and beats `@layer utilities`; use it for autofill overrides
- Railway silent build fallback: if a build fails, Railway serves old assets with no obvious error
