# PrairieMap

A modern war/map visualization tool for building chronological map timelapses. Import a folder of map images, color regions, add labels, and document events per frame.

## Stack

- **React 19** + **Vite** + **TypeScript**
- **Tailwind CSS v4** (dark cyberpunk/military theme)
- **Konva / react-konva** for canvas layers
- **Lucide React** icons

## Getting started

```bash
npm install
npm run dev
```

Open the dev server URL, click **Load Folder**, and select a directory of map images (PNG, JPG, etc.). Frames are sorted alphanumerically by filename.

## Features (current)

- 3-panel layout: timeline, map canvas, intel board
- **Assets + timeline** data model: multiple copies per filename, independent timeline order
- Folder import with smart reconciliation (new files auto-append; missing assets show placeholders)
- Drag-and-drop timeline reordering
- Duplicate frame (map / drawings / info board toggles)
- Delete frame with orphan asset cleanup
- Pan & zoom (mouse wheel, drag, or hold **Space** + drag)
- Brush tool with size and opacity
- Text labels (click to place, double-click to edit, drag to move)
- Carry-over labels toggle between frames
- Faction color palette
- Per-frame date, markdown notes, and faction stats
- Playback controls (play/pause, scrubber)
- Export / import project JSON (v2 schema; v1 auto-migrated)

## Project structure

```
src/
├── components/
│   ├── canvas/       MapCanvas, CanvasToolbar, PlaybackControls
│   ├── infoboard/    InfoBoard
│   ├── layout/       AppLayout, Header
│   └── sidebar/      FrameSidebar, DuplicateFrameModal
├── context/          ProjectContext (assets + timeline state)
├── hooks/            usePlayback
├── types/            project.ts
└── utils/            sortFiles, cloneFrameData, exportSchema, reconcileFolder, projectHelpers
```

### JSON export schema (v2)

```json
{
  "version": 2,
  "projectName": "Strategic_Campaign",
  "assets": {
    "europe_1939.png": [
      { "drawings": [], "labels": [], "infoBoard": { "date": "", "text": "", "factionStats": [] } }
    ]
  },
  "timeline": [
    { "id": "uuid", "filename": "europe_1939.png", "copyIndex": 0 }
  ]
}
```

## Scripts

| Command        | Description          |
|----------------|----------------------|
| `npm run dev`  | Start dev server     |
| `npm run build`| Production build     |
| `npm run preview` | Preview build     |
# prairieMap
