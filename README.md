# PrairieMap

A war/map visualization tool for building chronological map timelapses. Import a folder of map images, draw territories, add labels, and document events per frame.

## Stack

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS v4, Konva
- **Backend:** FastAPI, Pydantic, Shapely (polygon logic), ffmpeg (video compile)

Map images stay in the browser (folder picker). Project data and geometry mutations are handled by the Python API.

## Getting started

### 1. Backend (Python 3.11+)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 2. Frontend

```bash
npm install
npm run dev
```

Or run both together:

```bash
npm install
npm run dev:all
```

Open http://localhost:5173. The Vite dev server proxies `/api` to the backend.

**Video compile** requires `ffmpeg` on your PATH.

## Features

- 3-panel layout: timeline, map canvas, intel board
- Assets + timeline model with folder reconciliation
- Territory area-select with overlap transfer (server-side Shapely)
- Duplicate frame, drag reorder, playback
- Per-frame date, markdown notes, faction stats
- JSON export/import (v2; v1 migrated on import)
- Save/load project via API (`backend/projects/`)
- Compile timeline to MP4 (client renders frames → server ffmpeg)

## Project structure

```
backend/
  app/
    main.py           FastAPI app
    api/              REST routes
    models/           Pydantic schemas
    services/         geometry, project, video, export
  projects/           Saved JSON projects (gitignored)
src/
  api/                HTTP client
  components/         React UI + Konva canvas
  context/            ProjectContext (UI + API sync)
  hooks/              playback, video export
  utils/              client-only helpers (snap, reconcile files)
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server only |
| `npm run dev:api` | FastAPI only |
| `npm run dev:all` | API + frontend |
| `npm run build` | Production frontend build |
| `cd backend && pytest` | Backend unit tests |

## API overview

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check |
| POST | `/api/projects` | Create project |
| GET/PUT | `/api/projects/{id}` | Load/save |
| POST | `/api/geometry/add-region` | Add territory polygon |
| POST | `/api/timeline/duplicate` | Duplicate frame |
| POST | `/api/video/compile` | Build MP4 from PNG frames |
