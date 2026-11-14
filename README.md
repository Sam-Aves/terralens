# TERRALENS

**Learn to read flooding from space.** TERRALENS is a browser-based investigation game that teaches people how to interpret Sentinel-1 satellite radar (SAR) imagery. Players take on missions over real river systems, compare before/after radar scenes, mark where open water has spread, and answer questions about how radar "sees" water, vegetation and buildings. A built-in Radar Lab runs change detection on real satellite tiles directly in the browser, and a FastAPI backend keeps each player's progress.

> **Important:** TERRALENS reports *observed new-water extent* derived from radar backscatter thresholds. It does **not** confirm flooding, identify causes, or determine timing. See [Limitations](#limitations-and-scientific-honesty).

---

## Table of contents

1. [Why this project exists](#why-this-project-exists)
2. [Features](#features)
3. [Missions](#missions)
4. [How it works](#how-it-works)
5. [Architecture and project structure](#architecture-and-project-structure)
6. [Tech stack](#tech-stack)
7. [Getting started](#getting-started)
8. [Configuration](#configuration)
9. [Generating real SAR outputs (optional pipeline)](#generating-real-sar-outputs-optional-pipeline)
10. [API reference](#api-reference)
11. [Game system](#game-system)
12. [Testing](#testing)
13. [Deployment](#deployment)
14. [Troubleshooting](#troubleshooting)
15. [Limitations and scientific honesty](#limitations-and-scientific-honesty)
16. [Data sources and credits](#data-sources-and-credits)
17. [License](#license)

---

## Why this project exists

Synthetic Aperture Radar (SAR) sees through cloud and works day and night, which makes it one of the most useful tools for flood mapping. But radar images look nothing like photographs, and most people have never learned to read them. TERRALENS turns Earth observation data into a hands-on lesson, building flood and climate-risk literacy for anyone with a web browser, especially in flood-prone river basins such as Bangladesh.

## Features

- **Three investigator missions** on real rivers in Bangladesh, India and Brazil.
- **Real Sentinel-1 radar imagery** shown on an interactive map, with a swipe/compare view for before vs. after.
- **Drawing tools** to mark suspected water extent on the map.
- **Radar Lab**: in-browser water classification and change detection with a new-water area estimate in km², and markers for potentially exposed settlements.
- **Mission questions** covering specular reflection, VV vs. VH polarization and double-bounce returns.
- **Player progression**: ranks, XP, coins, callsign, avatar colours and a mission journal.
- **Server-side answer checking** and XP caps in the FastAPI backend, with progress stored in SQLite.
- **Offline-capable**: if the backend is not running, the game keeps working and saves progress to the browser (`localStorage`).
- **Tested backend** with unit tests for the API, gamification, change detection and data scripts.

## Missions

| # | Mission | Location | Before date | After date |
|---|---------|----------|-------------|------------|
| 01 | The Changing Jamuna | Jamuna River, Bangladesh | 2024-05-17 | 2024-07-16 |
| 02 | Brahmaputra Surge | Brahmaputra River, Assam, India | 2024-05-19 | 2024-07-06 |
| 03 | Amazon Wetland Dynamics | Solimões River near Coari, Amazon Basin, Brazil | 2023-11-22 | 2024-06-01 |

The mission dates above come from the mission definitions in `terralens-frontend/src/data/`. The Radar Lab uses its own Sentinel-1 scene lists (in `sentinel1.ts`), so its scene dates can differ slightly from the mission dates.

## How it works

### 1. Radar imagery in the browser

Sentinel-1A IW scenes, radiometrically terrain-corrected (RTC), are loaded as map tiles from the Microsoft Planetary Computer data API (public, no key). Basemaps come from Esri.

### 2. Change detection in the Radar Lab (`src/data/sentinel1.ts`)

1. Read **VH** backscatter in dB for the study area on each date.
2. Classify a pixel as **open water** when VH is below **-20 dB**.
   VH is used instead of VV because wind-roughened water often rises above a VV threshold, which made rivers "vanish" on windy dates.
3. Remove isolated water pixels (speckle).
4. **New water** = water on the later date **and** not water on the baseline date.
5. **Area** = the sum of the true ground area of each pixel, which varies with latitude.

### 3. Offline pipeline (`scripts/data` and `src/compute/change.py`)

A separate Python pipeline processes Sentinel-1 scenes through ASF HyP3 into 10 m RTC products and runs a before/after **VV** analysis:

- Default water threshold: **-15 dB** (an initial heuristic, configurable).
- Connected components (8-connectivity) smaller than a minimum pixel count are removed.
- Outputs: `before_water.tif`, `after_water.tif`, `new_water.tif` and `results.json`, which the API serves as colored map tiles.

### 4. Game layer

The backend owns the player side: progress, callsign, journal, rank, XP, coins, reset, and answer checking. Mission content, scenes and analysis numbers are served from the browser.

## Architecture and project structure

```
terralens/
├── src/
│   ├── api.py                  # FastAPI app: health, status, results, raster tiles, CORS
│   ├── compute/
│   │   └── change.py           # Threshold-based water change detection
│   └── gamification/
│       ├── player_api.py       # /api/game routes used by the frontend
│       ├── routes.py           # /api/gamification routes (training missions)
│       ├── grading.py          # Server-side answer keys and grading
│       ├── missions.py         # Training mission catalog
│       └── store.py            # SQLite storage, XP and ranks
├── scripts/data/
│   ├── prepare_sar.py          # Submit/download HyP3 RTC jobs, build VV/VH COGs
│   └── run_change_detection.py # Before/after VV change analysis
├── tests/                      # Backend unit tests
├── terralens-frontend/
│   ├── src/
│   │   ├── App.tsx             # Main app: dashboard, explorer, lab, journal, arcade
│   │   ├── screens/            # WelcomeScreen
│   │   ├── components/         # RadarMap, WorldMap, Avatar, Memories, Fun, evidence badges
│   │   ├── api/terralensApi.ts # The only place the frontend talks to the backend
│   │   ├── data/               # Missions, Sentinel-1 scene configs, optional context slots
│   │   ├── types/              # TypeScript API and mission types
│   │   └── utils/              # Audio helpers
│   ├── public/                 # Fonts, fixtures, SAR sample image
│   ├── API_CONTRACT.md         # Frontend/backend contract
│   ├── DEPLOY.md               # Static hosting notes
│   ├── radar_lab.html          # Standalone Radar Lab page
│   └── standalone_preview.html # Standalone preview
├── requirements-data.txt       # Python dependencies
├── RUN.md                      # Quick run instructions
└── LICENSE                     # Apache 2.0
```

Runtime data lives in `cache/` (git-ignored): `cache/sar/` (downloaded products), `cache/outputs/` (analysis results) and `cache/gamification.sqlite3` (player data).

The app has these screens, reachable by hash links such as `#/lab`: `welcome`, `dashboard`, `explorer`, `lab`, `journal`, `arcade`.

## Tech stack

**Frontend**
- React 18, TypeScript, Vite 5
- Tailwind CSS
- Zustand (state), React Router
- MapLibre GL JS, maplibre-gl-compare (swipe view), Terra Draw (drawing)
- Lucide icons

**Backend and data**
- Python 3.10+, FastAPI, Uvicorn, SQLite
- rasterio, NumPy, SciPy, Pillow, HTTPX
- ASF `hyp3_sdk` for Sentinel-1 RTC processing

## Getting started

### Prerequisites

- **Python 3.10+** (3.11 or 3.12 recommended if a package fails to install on very new Python versions)
- **Node.js 20+** and npm
- Internet access (map imagery is loaded from external services)

### 1. Backend

**Windows (Command Prompt)**
```bat
py -m venv .venv
.venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements-data.txt
python -m uvicorn src.api:app --host 127.0.0.1 --port 8000 --reload
```

**Windows (PowerShell)**
```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-data.txt
python -m uvicorn src.api:app --host 127.0.0.1 --port 8000 --reload
```

**macOS / Linux**
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-data.txt
python -m uvicorn src.api:app --host 127.0.0.1 --port 8000 --reload
```

The API runs at <http://127.0.0.1:8000>. Interactive docs are at <http://127.0.0.1:8000/docs>.

### 2. Frontend

Open a second terminal:

```bash
cd terralens-frontend
npm install
npm run dev
```

The app opens at <http://localhost:3000>.

### One-terminal option (macOS / Linux)

```bash
python -m uvicorn src.api:app --host 127.0.0.1 --port 8000 > backend.log 2>&1 &
cd terralens-frontend && npm install && npm run dev
```

> The backend is optional. Without it, the game still runs and saves progress in the browser.

## Configuration

Frontend settings live in `terralens-frontend/.env` (copy from `.env.example`):

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_API_BASE` | `http://127.0.0.1:8000` | Backend address. Restart `npm run dev` after changing it. |

Backend notes:

- **CORS** only allows `localhost` and `127.0.0.1` origins (any port). Open the app at `localhost:3000`, not through a LAN IP.
- **Port**: if you change the backend port, update `VITE_API_BASE` to match.

## Generating real SAR outputs (optional pipeline)

The map-tile endpoints and `/api/results` read files from `cache/outputs/`. These are not included in the repository. The game itself does not need them, because the in-browser Radar Lab uses Planetary Computer tiles.

**Requirements:** a free [NASA Earthdata](https://www.earthdata.nasa.gov) account.

**Step 1: Prepare Sentinel-1 RTC products via HyP3**

```bash
# Preview the job requests without authenticating or submitting
python scripts/data/prepare_sar.py --after-scene <S1_GRDH_SCENE_ID> --dry-run

# Submit the jobs (publicly visible HyP3 processing jobs)
python scripts/data/prepare_sar.py --after-scene <S1_GRDH_SCENE_ID> --confirm-submit
```

| Option | Description |
|--------|-------------|
| `--after-scene` | Required. ESA Sentinel-1 GRDH scene ID acquired after the fixed before-scene. |
| `--auth {token,netrc}` | Earthdata token prompt (default) or `.netrc` lookup. |
| `--dry-run` | Print the prepared job requests with no network access. |
| `--confirm-submit` | Explicitly authorize submitting two HyP3 jobs. |
| `--timeout-seconds` | Maximum monitoring time (default 10800). |
| `--poll-interval-seconds` | Seconds between status checks (default 60). |

The fixed before-scene is `S1A_IW_GRDH_1SDV_20200713T120451_20200713T120516_033436_03DFD8_67E8`. RTC options: sigma0, 10 m, power scale, Copernicus DEM.

**Step 2: Run change detection**

```bash
python scripts/data/run_change_detection.py --threshold-db -15 --min-component-pixels 1
```

This writes `before_water.tif`, `after_water.tif`, `new_water.tif` and `results.json` into `cache/outputs/`.

## API reference

Base URL: `http://127.0.0.1:8000`

### SAR outputs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/status` | Whether SAR output files are available |
| GET | `/api/results` | Contents of `results.json` |
| GET | `/tiles/{layer}/tiles.json` | TileJSON for `before_water`, `after_water` or `new_water` |
| GET | `/tiles/{layer}/{z}/{x}/{y}.png` | 256 px colored raster tile |

### Player API (used by the frontend, prefix `/api/game`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/players/{id}/progress` | Player progress |
| PUT | `/players/{id}` | Save profile (callsign) |
| GET | `/players/{id}/journal` | Journal entries |
| GET | `/players/{id}/rank` | Rank, XP and XP needed for next rank |
| DELETE | `/players/{id}` | Reset player |
| POST | `/players/{id}/xp` | Award XP (capped at 150 per call) |
| POST | `/players/{id}/coins/spend` | Spend coins |
| POST | `/investigations/{mission}/players/{id}/submit` | Submit an investigation for server-side checking |

`{id}` is a random id the browser keeps in `localStorage`.

### Training missions API (prefix `/api/gamification`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/missions` | Training mission catalog |
| GET | `/config` | Gamification configuration |
| POST | `/players/{id}/answers` | Submit a training answer |
| GET | `/players/{id}/progress` | Training progress |
| GET | `/players/{id}/journal` | Training journal |
| POST | `/players/{id}/reset` | Reset training progress |

See `terralens-frontend/API_CONTRACT.md` for the full frontend/backend contract and TypeScript types.

## Game system

**Ranks (by total XP)**

| XP | Rank |
|----|------|
| 0 | Radar Rookie |
| 100 | Signal Explorer |
| 350 | Change Detective |
| 600 | Earth Investigator |
| 850 | Earth's Guardian |

- Answers are checked on the server. Mark counts and bonus XP reported by the browser are capped, not re-verified, by the server.
- If the backend is unreachable, player calls fall back to `localStorage`.

## Testing

From the repository root, with the virtual environment active:

```bash
python -m unittest discover -s tests
```

Test files cover the API (`test_api.py`), player API (`test_player_api.py`), gamification (`test_gamification.py`), change detection (`test_change.py`), the change-detection script (`test_run_change_detection.py`) and SAR preparation (`test_prepare_sar.py`).

Frontend type-check and production build:

```bash
cd terralens-frontend
npm run build
```

## Deployment

The frontend is a static site.

1. `cd terralens-frontend && npm install && npm run build` (output in `dist/`).
2. Preview locally with `npm run preview`.
3. Host `dist/` on any static host (Netlify, Vercel, GitHub Pages). For GitHub Pages under a sub-path, set `base: '/<repo-name>/'` in `vite.config.ts`.
4. Set `VITE_API_BASE` **before building** if you host a backend. The backend's CORS rule only allows `localhost`/`127.0.0.1`, so update it in `src/api.py` for a hosted setup.
5. Screens use `#/` links, so no rewrite rules are needed.

Visitors need an internet connection for the map imagery.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `No module named uvicorn` | The requirements are not installed in the active Python. Create and activate the venv, then `pip install -r requirements-data.txt`. Your prompt should start with `(.venv)`. |
| `pip install` fails on `rasterio` | Upgrade pip first. If it still fails, use Python 3.11 or 3.12 (`py -3.12 -m venv .venv`). |
| Frontend can't reach the backend | Check the backend is running on port 8000, `VITE_API_BASE` matches, and you opened `http://localhost:3000`. |
| CORS errors | Open the app via `localhost` or `127.0.0.1`, not a LAN IP. |
| Map tile endpoints return errors | `cache/outputs/` is empty. Run the [pipeline](#generating-real-sar-outputs-optional-pipeline). The game itself does not need it. |
| Blank map | Check your internet connection, since imagery loads from external servers. |
| Progress missing | Progress is tied to a random id in `localStorage`. Clearing browser data creates a new player. |

## Limitations and scientific honesty

- Results are **threshold-based observations**, not proof of flooding.
- A single fixed threshold is a starting point, not a calibration. Thresholds can vary with surface conditions, wind and soil moisture.
- Smooth dry sand and other low-backscatter surfaces can look like water.
- Flooded vegetation can look like land, and urban double-bounce can be bright.
- Detections should be validated against independent evidence before any real-world use.
- The in-browser analysis is experimental and has not been validated.
- Mark counts and bonus XP are only capped by the server, not independently verified.

## Data sources and credits

**NASA / NASA-hosted**
- [NASA Earthdata](https://www.earthdata.nasa.gov): account used for data access and HyP3 processing
- [ASF DAAC](https://asf.alaska.edu): NASA Distributed Active Archive Center that distributes Sentinel-1 data
- [ASF Data Search](https://search.asf.alaska.edu): scene discovery
- [ASF HyP3](https://hyp3-docs.asf.alaska.edu): on-demand Sentinel-1 RTC processing

**Other data**
- [ESA Copernicus Sentinel-1](https://sentinel.esa.int/web/sentinel/missions/sentinel-1): contains modified Copernicus Sentinel data (2020, 2023-2024)
- [Copernicus DEM](https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model): terrain model used for RTC
- [Microsoft Planetary Computer, Sentinel-1 RTC](https://planetarycomputer.microsoft.com/dataset/sentinel-1-rtc): browser map tiles
- Esri World Imagery and World Boundaries and Places: basemap and labels

**Open-source software**
React, Vite, TypeScript, Tailwind CSS, Zustand, React Router, MapLibre GL JS, maplibre-gl-compare, Terra Draw, Lucide, FastAPI, Uvicorn, rasterio, NumPy, SciPy, Pillow, HTTPX and `hyp3_sdk`. Fonts: Bagel Fat One and Lilita One (SIL Open Font License).

## License

Licensed under the **Apache License, Version 2.0**. See [LICENSE](LICENSE). Copyright 2026 TERRALENS Contributors.
