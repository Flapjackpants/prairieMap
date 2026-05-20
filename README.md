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
- Folder import with thumbnail timeline
- Pan & zoom (mouse wheel, drag, or hold **Space** + drag)
- Brush tool with size and opacity
- Text labels (click to place, double-click to edit, drag to move)
- Carry-over labels toggle between frames
- Faction color palette
- Per-frame date, markdown notes, and faction stats
- Playback controls (play/pause, scrubber)
- Export / import project JSON

## Project structure

```
src/
├── components/
│   ├── canvas/       MapCanvas, CanvasToolbar, PlaybackControls
│   ├── infoboard/    InfoBoard
│   ├── layout/       AppLayout, Header
│   └── sidebar/      FrameSidebar
├── context/          ProjectContext (global state)
├── hooks/            usePlayback
├── types/            project.ts
└── utils/            sortFiles.ts
```

## Scripts

| Command        | Description          |
|----------------|----------------------|
| `npm run dev`  | Start dev server     |
| `npm run build`| Production build     |
| `npm run preview` | Preview build     |
# prairieMap
