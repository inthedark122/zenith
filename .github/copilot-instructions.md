# Copilot Agent Instructions

## Local Development Servers

Always start and restart backend and frontend using **background tasks** (bash tool with `mode="async"` and `detach: true`) so they remain visible in the `/tasks` panel and survive session shutdown.

### Backend

```bash
shellId: zenith-backend
cd /home/dev/zenith/backend && source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8011 --reload
```

- Port: **8011**
- Database: `zenith_local` (local PostgreSQL)
- Python venv: `backend/.venv`

To restart: kill the existing process first, then start again with the same shellId.

```bash
# Find and kill
ps aux | grep uvicorn | grep zenith | grep -v grep | awk '{print $2}' | xargs kill -9
```

### Frontend

```bash
shellId: zenith-frontend
cd /home/dev/zenith/frontend && npm run dev -- --host 0.0.0.0 --port 3000
```

- Port: **3000**
- Framework: Vite + React + TypeScript

To restart: kill the existing process first, then start again with the same shellId.

```bash
# Find and kill
ps aux | grep vite | grep zenith | grep -v grep | awk '{print $2}' | xargs kill -9
```

### Verify Both Are Running

```bash
curl -s -o /dev/null -w "backend: %{http_code}\n" http://localhost:8011/health
curl -s -o /dev/null -w "frontend: %{http_code}\n" http://localhost:3000
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
